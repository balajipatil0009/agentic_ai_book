import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/* ------------------------------------------------------------------ */
/* Accounts                                                            */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull(),
    name: text('name'),
    passwordHash: text('password_hash').notNull(),
    dailyGoalMinutes: integer('daily_goal_minutes').notNull().default(60),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('users_email_idx').on(t.email)],
);

/* ------------------------------------------------------------------ */
/* Content — a Course is a syllabus. Ship a new one by seeding rows.   */
/* ------------------------------------------------------------------ */

export const courses = pgTable(
  'courses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    tagline: text('tagline').notNull().default(''),
    description: text('description').notNull().default(''),
    level: text('level').notNull().default('Beginner → Production'),
    estHours: integer('est_hours').notNull().default(0),
    accent: text('accent').notNull().default('#10b981'),
    order: integer('order').notNull().default(0),
    published: boolean('published').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('courses_slug_idx').on(t.slug)],
);

export const chapters = pgTable(
  'chapters',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    kicker: text('kicker').notNull().default(''),
    bodyMd: text('body_md').notNull(),
    order: integer('order').notNull().default(0),
    estMinutes: integer('est_minutes').notNull().default(15),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('chapters_slug_idx').on(t.slug), index('chapters_course_idx').on(t.courseId)],
);

/** Headings scraped from a chapter — the unit of reading progress. */
export const sections = pgTable(
  'sections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    chapterId: uuid('chapter_id')
      .notNull()
      .references(() => chapters.id, { onDelete: 'cascade' }),
    heading: text('heading').notNull(),
    anchor: text('anchor').notNull(),
    level: integer('level').notNull().default(2),
    order: integer('order').notNull().default(0),
  },
  (t) => [
    uniqueIndex('sections_chapter_anchor_idx').on(t.chapterId, t.anchor),
    index('sections_chapter_idx').on(t.chapterId),
  ],
);

/** Syllabus: modules → topics/labs (imported from the tracker CSV). */
export const syllabusModules = pgTable(
  'syllabus_modules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    order: integer('order').notNull().default(0),
    title: text('title').notNull(),
    estHours: integer('est_hours').notNull().default(0),
  },
  (t) => [index('syllabus_modules_course_idx').on(t.courseId)],
);

export const syllabusTopics = pgTable(
  'syllabus_topics',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    moduleId: uuid('module_id')
      .notNull()
      .references(() => syllabusModules.id, { onDelete: 'cascade' }),
    order: integer('order').notNull().default(0),
    title: text('title').notNull(),
    keyPoints: text('key_points').notNull().default(''),
    lab: text('lab').notNull().default(''),
    estHours: integer('est_hours').notNull().default(0),
    isLab: boolean('is_lab').notNull().default(false),
  },
  (t) => [index('syllabus_topics_module_idx').on(t.moduleId)],
);

/* ------------------------------------------------------------------ */
/* Per-user progress                                                   */
/* ------------------------------------------------------------------ */

export const sectionProgress = pgTable(
  'section_progress',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sectionId: uuid('section_id')
      .notNull()
      .references(() => sections.id, { onDelete: 'cascade' }),
    seenAt: timestamp('seen_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.sectionId] }), index('section_progress_user_idx').on(t.userId)],
);

export const chapterProgress = pgTable(
  'chapter_progress',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    chapterId: uuid('chapter_id')
      .notNull()
      .references(() => chapters.id, { onDelete: 'cascade' }),
    completedAt: timestamp('completed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.chapterId] }), index('chapter_progress_user_idx').on(t.userId)],
);

export const topicProgress = pgTable(
  'topic_progress',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    topicId: uuid('topic_id')
      .notNull()
      .references(() => syllabusTopics.id, { onDelete: 'cascade' }),
    completedAt: timestamp('completed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.topicId] }), index('topic_progress_user_idx').on(t.userId)],
);

/* ------------------------------------------------------------------ */
/* Time logger — one row per study session                             */
/* ------------------------------------------------------------------ */

export const studySessions = pgTable(
  'study_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    chapterId: uuid('chapter_id').references(() => chapters.id, { onDelete: 'set null' }),
    /** Local calendar day the work happened, 'YYYY-MM-DD'. */
    day: text('day').notNull(),
    minutes: integer('minutes').notNull().default(0),
    source: text('source').notNull().default('manual'), // 'timer' | 'manual'
    note: text('note').notNull().default(''),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('study_sessions_user_idx').on(t.userId), index('study_sessions_user_day_idx').on(t.userId, t.day)],
);

export type User = typeof users.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Chapter = typeof chapters.$inferSelect;
export type Section = typeof sections.$inferSelect;
export type StudySession = typeof studySessions.$inferSelect;
