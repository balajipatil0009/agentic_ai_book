'use server';

import { and, desc, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { studySessions, type StudySession } from '@/db/schema';
import { getSessionUserId } from '@/lib/auth';
import { todayKey } from '@/lib/dates';

export type TimerState =
  | { ok: true; id: string; startedAt: string; chapterId: string | null }
  | { ok: false; error: string };

function serialize(session: StudySession): TimerState {
  return {
    ok: true,
    id: session.id,
    startedAt: new Date(session.startedAt).toISOString(),
    chapterId: session.chapterId,
  };
}

async function findActiveTimer(userId: string) {
  const [row] = await db
    .select()
    .from(studySessions)
    .where(
      and(
        eq(studySessions.userId, userId),
        eq(studySessions.source, 'timer'),
        isNull(studySessions.endedAt),
      ),
    )
    .orderBy(desc(studySessions.startedAt))
    .limit(1);
  return row;
}

/** One running timer per user — starting twice returns the live one. */
export async function startTimer(chapterId?: string | null): Promise<TimerState> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: 'Not signed in.' };

  const active = await findActiveTimer(userId);
  if (active) return serialize(active);

  const [row] = await db
    .insert(studySessions)
    .values({
      userId,
      chapterId: chapterId ?? null,
      day: todayKey(),
      minutes: 0,
      source: 'timer',
      startedAt: new Date(),
      endedAt: null,
    })
    .returning();

  return serialize(row);
}

export async function stopTimer(): Promise<{ ok: boolean; minutes?: number }> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false };

  const active = await findActiveTimer(userId);
  if (!active) return { ok: false };

  const startedAt = new Date(active.startedAt).getTime();
  // Minimum 1 minute so an accidental start/stop still records the session.
  const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));

  await db
    .update(studySessions)
    .set({
      endedAt: new Date(),
      minutes,
      // Credit the day the session began — a 23:50→00:10 run still counts.
      day: todayKey(new Date(startedAt)),
    })
    .where(eq(studySessions.id, active.id));

  return { ok: true, minutes };
}

export type ManualSessionInput = {
  day: string;
  minutes: number;
  note?: string;
  chapterId?: string | null;
};

export async function addManualSession(
  input: ManualSessionInput,
): Promise<{ ok: boolean; error?: string }> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: 'Not signed in.' };

  const day = String(input.day ?? '');
  const minutes = Math.round(Number(input.minutes));
  const note = String(input.note ?? '').slice(0, 200);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { ok: false, error: 'Pick a valid date.' };
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
    return { ok: false, error: 'Minutes must be between 1 and 1440.' };
  }

  await db.insert(studySessions).values({
    userId,
    chapterId: input.chapterId ?? null,
    day,
    minutes,
    note,
    source: 'manual',
    startedAt: new Date(),
    endedAt: new Date(),
  });

  return { ok: true };
}

export async function updateSession(
  id: string,
  patch: { day?: string; minutes?: number; note?: string },
): Promise<{ ok: boolean; error?: string }> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: 'Not signed in.' };

  const values: Partial<typeof studySessions.$inferInsert> = {};
  if (patch.day !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(patch.day)) return { ok: false, error: 'Invalid date.' };
    values.day = patch.day;
  }
  if (patch.minutes !== undefined) {
    const minutes = Math.round(Number(patch.minutes));
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
      return { ok: false, error: 'Minutes must be between 1 and 1440.' };
    }
    values.minutes = minutes;
  }
  if (patch.note !== undefined) values.note = patch.note.slice(0, 200);
  if (Object.keys(values).length === 0) return { ok: true };

  await db
    .update(studySessions)
    .set(values)
    .where(and(eq(studySessions.id, id), eq(studySessions.userId, userId)));

  return { ok: true };
}

export async function deleteSession(id: string): Promise<{ ok: boolean }> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false };

  await db
    .delete(studySessions)
    .where(and(eq(studySessions.id, id), eq(studySessions.userId, userId)));

  return { ok: true };
}
