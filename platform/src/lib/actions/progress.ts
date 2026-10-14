'use server';

import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { chapterProgress, sectionProgress, topicProgress } from '@/db/schema';
import { getSessionUserId } from '@/lib/auth';

async function requireUserId(): Promise<string | null> {
  return getSessionUserId();
}

/** Scroll-tracking: the reader calls this once per section as it enters view. */
export async function markSectionSeen(sectionId: string): Promise<void> {
  const userId = await requireUserId();
  if (!userId) return;
  await db
    .insert(sectionProgress)
    .values({ userId, sectionId, seenAt: new Date() })
    .onConflictDoUpdate({
      target: [sectionProgress.userId, sectionProgress.sectionId],
      set: { seenAt: new Date() },
    });
}

export async function setSectionComplete(sectionId: string, complete: boolean): Promise<void> {
  const userId = await requireUserId();
  if (!userId) return;

  if (complete) {
    await db
      .insert(sectionProgress)
      .values({ userId, sectionId, seenAt: new Date(), completedAt: new Date() })
      .onConflictDoUpdate({
        target: [sectionProgress.userId, sectionProgress.sectionId],
        set: { seenAt: new Date(), completedAt: new Date() },
      });
  } else {
    await db
      .update(sectionProgress)
      .set({ completedAt: null })
      .where(and(eq(sectionProgress.userId, userId), eq(sectionProgress.sectionId, sectionId)));
  }
}

export async function setChapterComplete(chapterId: string, complete: boolean): Promise<void> {
  const userId = await requireUserId();
  if (!userId) return;

  if (complete) {
    await db
      .insert(chapterProgress)
      .values({ userId, chapterId, completedAt: new Date() })
      .onConflictDoUpdate({
        target: [chapterProgress.userId, chapterProgress.chapterId],
        set: { completedAt: new Date() },
      });
  } else {
    await db
      .delete(chapterProgress)
      .where(and(eq(chapterProgress.userId, userId), eq(chapterProgress.chapterId, chapterId)));
  }
}

export async function setTopicComplete(topicId: string, complete: boolean): Promise<void> {
  const userId = await requireUserId();
  if (!userId) return;

  if (complete) {
    await db
      .insert(topicProgress)
      .values({ userId, topicId, completedAt: new Date() })
      .onConflictDoUpdate({
        target: [topicProgress.userId, topicProgress.topicId],
        set: { completedAt: new Date() },
      });
  } else {
    await db
      .delete(topicProgress)
      .where(and(eq(topicProgress.userId, userId), eq(topicProgress.topicId, topicId)));
  }
}
