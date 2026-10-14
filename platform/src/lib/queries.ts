import { and, asc, desc, eq, gte, ilike, isNull, or, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';

import { db } from '@/db';
import {
  chapters,
  chapterProgress,
  courses,
  loginEvents,
  sectionProgress,
  sections,
  studySessions,
  syllabusModules,
  syllabusTopics,
  topicProgress,
  users,
  userSessions,
} from '@/db/schema';
import { addDays, computeStreak, lastNDays, todayKey } from '@/lib/dates';

/* ------------------------------------------------------------------ */
/* Course + chapters                                                   */
/* ------------------------------------------------------------------ */

export type ChapterRow = {
  id: string;
  slug: string;
  title: string;
  kicker: string;
  order: number;
  estMinutes: number;
  totalSections: number;
  seenSections: number;
  completedSections: number;
  completedAt: Date | null;
};

export async function getCourse() {
  const [course] = await db.select().from(courses).where(eq(courses.published, true)).limit(1);
  return course ?? null;
}

/** Chapters in reading order with per-chapter progress counts. */
export async function getChaptersWithProgress(userId: string): Promise<ChapterRow[]> {
  const rows = await db
    .select({
      id: chapters.id,
      slug: chapters.slug,
      title: chapters.title,
      kicker: chapters.kicker,
      order: chapters.order,
      estMinutes: chapters.estMinutes,
      totalSections: sql<number>`count(${sections.id})::int`,
      seenSections: sql<number>`count(${sectionProgress.seenAt})::int`,
      completedSections: sql<number>`count(${sectionProgress.completedAt})::int`,
      completedAt: chapterProgress.completedAt,
    })
    .from(chapters)
    .leftJoin(sections, eq(sections.chapterId, chapters.id))
    .leftJoin(
      sectionProgress,
      and(
        eq(sectionProgress.sectionId, sections.id),
        eq(sectionProgress.userId, userId),
      ),
    )
    .leftJoin(chapterProgress, and(eq(chapterProgress.chapterId, chapters.id), eq(chapterProgress.userId, userId)))
    .groupBy(
      chapters.id,
      chapters.slug,
      chapters.title,
      chapters.kicker,
      chapters.order,
      chapters.estMinutes,
      chapterProgress.completedAt,
    )
    .orderBy(asc(chapters.order));

  return rows;
}

/** First chapter the learner hasn't finished — the "continue" target. */
export function nextChapter(rows: ChapterRow[]): ChapterRow | null {
  return rows.find((row) => !row.completedAt) ?? rows[rows.length - 1] ?? null;
}

/* ------------------------------------------------------------------ */
/* Reader                                                              */
/* ------------------------------------------------------------------ */

export type ReaderSection = {
  id: string;
  heading: string;
  anchor: string;
  level: number;
  order: number;
  seen: boolean;
  completed: boolean;
};

export type ReaderData = {
  chapter: {
    id: string;
    slug: string;
    title: string;
    kicker: string;
    order: number;
    estMinutes: number;
    bodyMd: string;
  };
  sections: ReaderSection[];
  prev: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
  chapterCompleted: boolean;
  siblingChapters: Array<{
    id: string;
    slug: string;
    title: string;
    order: number;
    completed: boolean;
    percent: number;
  }>;
  seenPercent: number;
};

export async function getReaderData(userId: string, slug: string): Promise<ReaderData> {
  const [chapter] = await db.select().from(chapters).where(eq(chapters.slug, slug)).limit(1);
  if (!chapter) notFound();

  const allChapters = await getChaptersWithProgress(userId);
  const index = allChapters.findIndex((row) => row.id === chapter.id);
  const row = allChapters[index];

  const sectionRows = await db
    .select({
      id: sections.id,
      heading: sections.heading,
      anchor: sections.anchor,
      level: sections.level,
      order: sections.order,
      seenAt: sectionProgress.seenAt,
      completedAt: sectionProgress.completedAt,
    })
    .from(sections)
    .leftJoin(
      sectionProgress,
      and(eq(sectionProgress.sectionId, sections.id), eq(sectionProgress.userId, userId)),
    )
    .where(eq(sections.chapterId, chapter.id))
    .orderBy(asc(sections.order));

  const sectionList: ReaderSection[] = sectionRows.map((s) => ({
    id: s.id,
    heading: s.heading,
    anchor: s.anchor,
    level: s.level,
    order: s.order,
    seen: Boolean(s.seenAt),
    completed: Boolean(s.completedAt),
  }));

  const total = sectionList.length || 1;
  const seen = sectionList.filter((s) => s.seen).length;

  return {
    chapter: {
      id: chapter.id,
      slug: chapter.slug,
      title: chapter.title,
      kicker: chapter.kicker,
      order: chapter.order,
      estMinutes: chapter.estMinutes,
      bodyMd: chapter.bodyMd,
    },
    sections: sectionList,
    prev: index > 0 ? allChapters[index - 1] : null,
    next: index < allChapters.length - 1 ? allChapters[index + 1] : null,
    chapterCompleted: Boolean(row?.completedAt),
    siblingChapters: allChapters.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      order: c.order,
      completed: Boolean(c.completedAt),
      percent: c.totalSections
        ? Math.round((c.completedSections / c.totalSections) * 100)
        : c.completedAt
          ? 100
          : 0,
    })),
    seenPercent: Math.round((seen / total) * 100),
  };
}

/* ------------------------------------------------------------------ */
/* Syllabus                                                            */
/* ------------------------------------------------------------------ */

export async function getSyllabus(userId: string) {
  const modules = await db
    .select()
    .from(syllabusModules)
    .orderBy(asc(syllabusModules.order));

  const topicRows = await db
    .select({
      id: syllabusTopics.id,
      moduleId: syllabusTopics.moduleId,
      order: syllabusTopics.order,
      title: syllabusTopics.title,
      keyPoints: syllabusTopics.keyPoints,
      lab: syllabusTopics.lab,
      estHours: syllabusTopics.estHours,
      isLab: syllabusTopics.isLab,
      completedAt: topicProgress.completedAt,
    })
    .from(syllabusTopics)
    .leftJoin(
      topicProgress,
      and(eq(topicProgress.topicId, syllabusTopics.id), eq(topicProgress.userId, userId)),
    )
    .orderBy(asc(syllabusTopics.order));

  return modules.map((mod) => ({
    ...mod,
    topics: topicRows.filter((t) => t.moduleId === mod.id),
    completed: topicRows.filter((t) => t.moduleId === mod.id && t.completedAt).length,
    total: topicRows.filter((t) => t.moduleId === mod.id).length,
  }));
}

/* ------------------------------------------------------------------ */
/* Time log + dashboard                                                */
/* ------------------------------------------------------------------ */

export async function getActiveTimer(userId: string) {
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
  return row ?? null;
}

export type TimeSummary = {
  all: number;
  today: number;
  week: number;
  month: number;
  sessions: number;
  activeDays: number;
};

export async function getTimeSummary(userId: string): Promise<TimeSummary> {
  const today = todayKey();
  const weekStart = addDays(today, -6);
  const monthStart = addDays(today, -29);

  const [row] = await db
    .select({
      all: sql<number>`coalesce(sum(${studySessions.minutes}), 0)::int`,
      today: sql<number>`coalesce(sum(case when ${studySessions.day} >= ${today} then ${studySessions.minutes} else 0 end), 0)::int`,
      week: sql<number>`coalesce(sum(case when ${studySessions.day} >= ${weekStart} then ${studySessions.minutes} else 0 end), 0)::int`,
      month: sql<number>`coalesce(sum(case when ${studySessions.day} >= ${monthStart} then ${studySessions.minutes} else 0 end), 0)::int`,
      sessions: sql<number>`count(*)::int`,
      activeDays: sql<number>`count(distinct ${studySessions.day})::int`,
    })
    .from(studySessions)
    .where(eq(studySessions.userId, userId));

  return {
    all: row?.all ?? 0,
    today: row?.today ?? 0,
    week: row?.week ?? 0,
    month: row?.month ?? 0,
    sessions: row?.sessions ?? 0,
    activeDays: row?.activeDays ?? 0,
  };
}

export async function getRecentSessions(userId: string, limit = 8) {
  return db
    .select({
      id: studySessions.id,
      day: studySessions.day,
      minutes: studySessions.minutes,
      source: studySessions.source,
      note: studySessions.note,
      startedAt: studySessions.startedAt,
      chapterTitle: chapters.title,
      chapterSlug: chapters.slug,
    })
    .from(studySessions)
    .leftJoin(chapters, eq(chapters.id, studySessions.chapterId))
    .where(eq(studySessions.userId, userId))
    .orderBy(desc(studySessions.startedAt))
    .limit(limit);
}

export type DashboardData = {
  chapters: ChapterRow[];
  /** local day → minutes, last 200 days */
  totals: Record<string, number>;
  allTimeMinutes: number;
  todayMinutes: number;
  streak: { current: number; longest: number; todayActive: boolean };
  topicsDone: number;
  topicsTotal: number;
  sectionsDone: number;
  sectionsTotal: number;
  chaptersDone: number;
};

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const [chaptersRows, sessionRows, allTime, topicRows, sectionRows] = await Promise.all([
    getChaptersWithProgress(userId),
    db
      .select({ day: studySessions.day, minutes: studySessions.minutes })
      .from(studySessions)
      .where(and(eq(studySessions.userId, userId), gte(studySessions.day, lastNDays(200)[0]))),
    db
      .select({ total: sql<number>`coalesce(sum(${studySessions.minutes}), 0)::int` })
      .from(studySessions)
      .where(eq(studySessions.userId, userId)),
    db
      .select({
        done: sql<number>`count(${topicProgress.completedAt})::int`,
        total: sql<number>`count(${syllabusTopics.id})::int`,
      })
      .from(syllabusTopics)
      .leftJoin(
        topicProgress,
        and(eq(topicProgress.topicId, syllabusTopics.id), eq(topicProgress.userId, userId)),
      ),
    db
      .select({
        done: sql<number>`count(${sectionProgress.completedAt})::int`,
        total: sql<number>`count(${sections.id})::int`,
      })
      .from(sections)
      .leftJoin(
        sectionProgress,
        and(eq(sectionProgress.sectionId, sections.id), eq(sectionProgress.userId, userId)),
      ),
  ]);

  const totals: Record<string, number> = {};
  for (const row of sessionRows) totals[row.day] = (totals[row.day] ?? 0) + row.minutes;

  const today = todayKey();

  return {
    chapters: chaptersRows,
    totals,
    allTimeMinutes: allTime[0]?.total ?? 0,
    todayMinutes: totals[today] ?? 0,
    streak: computeStreak(Object.keys(totals)),
    topicsDone: topicRows[0]?.done ?? 0,
    topicsTotal: topicRows[0]?.total ?? 0,
    sectionsDone: sectionRows[0]?.done ?? 0,
    sectionsTotal: sectionRows[0]?.total ?? 0,
    chaptersDone: chaptersRows.filter((c) => c.completedAt).length,
  };
}

/* ------------------------------------------------------------------ */
/* Admin dashboard                                                     */
/* ------------------------------------------------------------------ */

/** A session counts as "online now" when it's open and seen in the last 2 min. */
const ONLINE_WINDOW = sql`interval '2 minutes'`;

export type AdminOverview = {
  totalUsers: number;
  onlineNow: number;
  signInsToday: number;
  /** Σ activeSeconds of sessions *started* today (per-day accrual isn't stored). */
  activeSecondsToday: number;
  newThisWeek: number;
};

export async function getAdminOverview(): Promise<AdminOverview> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [usersRow, onlineRow, signInsRow, activeRow, newRow] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(users),
    db
      .select({ n: sql<number>`count(distinct ${userSessions.userId})::int` })
      .from(userSessions)
      .where(
        and(
          isNull(userSessions.endedAt),
          sql`${userSessions.lastSeenAt} > now() - ${ONLINE_WINDOW}`,
        ),
      ),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(loginEvents)
      .where(and(eq(loginEvents.kind, 'login'), gte(loginEvents.occurredAt, startOfDay))),
    db
      .select({ s: sql<number>`coalesce(sum(${userSessions.activeSeconds}), 0)::int` })
      .from(userSessions)
      .where(gte(userSessions.startedAt, startOfDay)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(users)
      .where(gte(users.createdAt, sql`now() - interval '7 days'`)),
  ]);

  return {
    totalUsers: usersRow[0]?.n ?? 0,
    onlineNow: onlineRow[0]?.n ?? 0,
    signInsToday: signInsRow[0]?.n ?? 0,
    activeSecondsToday: activeRow[0]?.s ?? 0,
    newThisWeek: newRow[0]?.n ?? 0,
  };
}

export type AdminSort = 'last_seen' | 'active' | 'signins';

export type AdminUserRow = {
  id: string;
  name: string | null;
  email: string;
  role: 'user' | 'admin';
  createdAt: Date;
  lastSeenAt: Date | null;
  activeSeconds: number;
  sessions: number;
  online: boolean;
  signIns7d: number;
  studiedMinutes: number;
  chaptersCompleted: number;
};

export async function getAdminUsers(options: {
  q?: string;
  sort?: AdminSort;
}): Promise<AdminUserRow[]> {
  const q = options.q?.trim() ?? '';
  const where = q
    ? or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`))
    : undefined;

  const [userRows, sessionRows, loginRows, studyRows, chapterRows] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(where)
      .orderBy(asc(users.email)),
    db
      .select({
        userId: userSessions.userId,
        lastSeenAt: sql<Date | null>`max(${userSessions.lastSeenAt})`,
        activeSeconds: sql<number>`coalesce(sum(${userSessions.activeSeconds}), 0)::int`,
        sessions: sql<number>`count(*)::int`,
        online: sql<boolean>`bool_or(${userSessions.endedAt} is null and ${userSessions.lastSeenAt} > now() - ${ONLINE_WINDOW})`,
      })
      .from(userSessions)
      .groupBy(userSessions.userId),
    db
      .select({ userId: loginEvents.userId, n: sql<number>`count(*)::int` })
      .from(loginEvents)
      .where(
        and(
          eq(loginEvents.kind, 'login'),
          gte(loginEvents.occurredAt, sql`now() - interval '7 days'`),
        ),
      )
      .groupBy(loginEvents.userId),
    db
      .select({
        userId: studySessions.userId,
        minutes: sql<number>`coalesce(sum(${studySessions.minutes}), 0)::int`,
      })
      .from(studySessions)
      .groupBy(studySessions.userId),
    db
      .select({ userId: chapterProgress.userId, n: sql<number>`count(*)::int` })
      .from(chapterProgress)
      .groupBy(chapterProgress.userId),
  ]);

  const byId = <T extends { userId: string }>(rows: T[]) =>
    new Map(rows.map((row) => [row.userId, row]));
  const sessions = byId(sessionRows);
  const logins = byId(loginRows);
  const study = byId(studyRows);
  const chaptersDone = byId(chapterRows);

  const mapped: AdminUserRow[] = userRows.map((row) => {
    const session = sessions.get(row.id);
    const lastSeen = session?.lastSeenAt ? new Date(session.lastSeenAt) : null;
    return {
      ...row,
      lastSeenAt: lastSeen,
      activeSeconds: session?.activeSeconds ?? 0,
      sessions: session?.sessions ?? 0,
      online: Boolean(session?.online),
      signIns7d: logins.get(row.id)?.n ?? 0,
      studiedMinutes: study.get(row.id)?.minutes ?? 0,
      chaptersCompleted: chaptersDone.get(row.id)?.n ?? 0,
    };
  });

  const sort = options.sort ?? 'last_seen';
  mapped.sort((a, b) => {
    if (sort === 'active') return b.activeSeconds - a.activeSeconds;
    if (sort === 'signins') return b.signIns7d - a.signIns7d;
    const at = a.lastSeenAt?.getTime() ?? 0;
    const bt = b.lastSeenAt?.getTime() ?? 0;
    return bt - at;
  });

  return mapped;
}

export type RecentLoginRow = {
  id: string;
  kind: 'login' | 'logout';
  occurredAt: Date;
  ip: string;
  userAgent: string;
  name: string | null;
  email: string;
};

export async function getRecentLogins(limit = 25): Promise<RecentLoginRow[]> {
  return db
    .select({
      id: loginEvents.id,
      kind: loginEvents.kind,
      occurredAt: loginEvents.occurredAt,
      ip: loginEvents.ip,
      userAgent: loginEvents.userAgent,
      name: users.name,
      email: users.email,
    })
    .from(loginEvents)
    .innerJoin(users, eq(users.id, loginEvents.userId))
    .orderBy(desc(loginEvents.occurredAt))
    .limit(limit);
}

/** Sign-ins per local calendar day, oldest → newest, zeros filled in. */
export async function getSignInSeries(days = 14): Promise<Array<{ day: string; count: number }>> {
  const dayKeys = lastNDays(days);
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const rows = await db
    .select({ occurredAt: loginEvents.occurredAt })
    .from(loginEvents)
    .where(and(eq(loginEvents.kind, 'login'), gte(loginEvents.occurredAt, since)));

  const counts = new Map(dayKeys.map((day) => [day, 0]));
  for (const row of rows) {
    const key = todayKey(new Date(row.occurredAt));
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return dayKeys.map((day) => ({ day, count: counts.get(day) ?? 0 }));
}
