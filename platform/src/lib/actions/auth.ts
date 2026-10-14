'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { loginEvents, users, userSessions } from '@/db/schema';
import {
  clientInfo,
  createSession,
  destroySession,
  getSession,
  hashPassword,
  verifyPassword,
} from '@/lib/auth';
import { bumpSession } from '@/lib/presence';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Opens the `user_sessions` row + audit event that back the admin dashboard. */
async function openSession(userId: string, sid: string) {
  const { ip, userAgent } = await clientInfo();
  await db.insert(userSessions).values({ id: sid, userId });
  await db.insert(loginEvents).values({ userId, kind: 'login', ip, userAgent });
}

export async function registerAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const name = String(formData.get('name') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!EMAIL_RE.test(email)) return { error: 'Enter a valid email address.' };
  if (password.length < 8) return { error: 'Password needs at least 8 characters.' };

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) return { error: 'An account with that email already exists.' };

  const passwordHash = await hashPassword(password);
  const [row] = await db
    .insert(users)
    .values({ email, name: name || null, passwordHash })
    .returning({ id: users.id });

  const sid = await createSession(row.id);
  await openSession(row.id, sid);
  redirect('/dashboard');
}

export async function loginAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  // Same message for every failure — never reveal which half was wrong.
  if (!row || !(await verifyPassword(password, row.passwordHash))) {
    return { error: 'Invalid email or password.' };
  }

  const sid = await createSession(row.id);
  await openSession(row.id, sid);
  redirect('/dashboard');
}

export async function logoutAction(): Promise<void> {
  const session = await getSession();

  if (session?.sid) {
    const { ip, userAgent } = await clientInfo();
    // Final heartbeat so the last visible stretch is credited, then close.
    await bumpSession(session.sid);
    await db
      .update(userSessions)
      .set({ endedAt: new Date() })
      .where(eq(userSessions.id, session.sid));
    await db
      .insert(loginEvents)
      .values({ userId: session.userId, kind: 'logout', ip, userAgent });
  }

  await destroySession();
  redirect('/');
}
