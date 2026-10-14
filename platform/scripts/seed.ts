import fs from 'node:fs';
import path from 'node:path';

import { and, asc, eq } from 'drizzle-orm';

import { db } from '../src/db';
import { chapters, courses, sections, syllabusModules, syllabusTopics } from '../src/db/schema';
import { chapterNumber, parseChapter, slugFromFilename } from '../src/lib/content';

const ROOT = path.join(__dirname, '../..');
const BOOK_DIR = path.join(ROOT, 'book');
const CSV_PATH = path.join(ROOT, 'Production RAG & AI Automation Learning Tracker (2026) - Sheet1.csv');

const COURSE = {
  slug: 'building-agentic-ai-products',
  title: 'Building Agentic AI Products',
  tagline: 'Build a real, working agentic product on Day 1 — theory arrives only when the product demands it.',
  description:
    'A project-oriented book for people who already know Python and Node. Seven compounding projects plus a capstone cover the full production RAG & AI automation syllabus: retrieval, structured outputs, agents, evaluation and shipping — with the security layer built in as you go.',
  level: 'Python + Node → Production',
  estHours: 157,
  accent: '#10b981',
};

/* ------------------------------------------------------------------ */
/* Tiny CSV reader (quotes, escaped quotes, embedded newlines)         */
/* ------------------------------------------------------------------ */

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const clean = (value: string | undefined) => (value ?? '').trim();

/* ------------------------------------------------------------------ */
/* Seed                                                                */
/* ------------------------------------------------------------------ */

async function upsertCourse() {
  const [existing] = await db.select().from(courses).where(eq(courses.slug, COURSE.slug)).limit(1);
  if (existing) {
    await db
      .update(courses)
      .set({
        title: COURSE.title,
        tagline: COURSE.tagline,
        description: COURSE.description,
        level: COURSE.level,
        estHours: COURSE.estHours,
        accent: COURSE.accent,
        published: true,
      })
      .where(eq(courses.id, existing.id));
    return existing.id;
  }
  const [row] = await db.insert(courses).values(COURSE).returning({ id: courses.id });
  return row.id;
}

function kickerFor(number: number): string {
  if (number >= 8) return 'Capstone';
  return `Project P${number}`;
}

async function seedChapters(courseId: string) {
  const files = fs
    .readdirSync(BOOK_DIR)
    .filter((file) => file.endsWith('.md') && file !== 'README.md')
    .sort((a, b) => chapterNumber(a) - chapterNumber(b));

  const existing = await db.select().from(chapters).where(eq(chapters.courseId, courseId));
  const summary: string[] = [];

  for (const file of files) {
    const source = fs.readFileSync(path.join(BOOK_DIR, file), 'utf8');
    const parsed = parseChapter(source);
    const slug = slugFromFilename(file);
    const order = chapterNumber(file);
    const kicker = kickerFor(order);

    const match = existing.find((row) => row.slug === slug);
    let chapterId: string;
    if (match) {
      await db
        .update(chapters)
        .set({ title: parsed.title, kicker, bodyMd: source, order, estMinutes: parsed.estMinutes })
        .where(eq(chapters.id, match.id));
      chapterId = match.id;
    } else {
      const [row] = await db
        .insert(chapters)
        .values({
          courseId,
          slug,
          title: parsed.title,
          kicker,
          bodyMd: source,
          order,
          estMinutes: parsed.estMinutes,
        })
        .returning({ id: chapters.id });
      chapterId = row.id;
    }

    const sectionCount = await syncSections(chapterId, parsed.headings);
    summary.push(`  ${slug.padEnd(26)} ${String(parsed.headings.length).padStart(2)} headings → ${sectionCount} sections`);
  }

  // Drop chapters that no longer exist in the book folder.
  const liveSlugs = files.map(slugFromFilename);
  for (const row of existing) {
    if (!liveSlugs.includes(row.slug)) {
      await db.delete(chapters).where(eq(chapters.id, row.id));
    }
  }

  return files.length;
}

async function syncSections(
  chapterId: string,
  headings: ReturnType<typeof parseChapter>['headings'],
) {
  const current = await db.select().from(sections).where(eq(sections.chapterId, chapterId));
  const seenAnchors = new Set<string>();

  for (const heading of headings) {
    seenAnchors.add(heading.anchor);
    const match = current.find((row) => row.anchor === heading.anchor);
    if (match) {
      if (match.heading !== heading.heading || match.order !== heading.order || match.level !== heading.level) {
        await db
          .update(sections)
          .set({ heading: heading.heading, order: heading.order, level: heading.level })
          .where(eq(sections.id, match.id));
      }
    } else {
      await db.insert(sections).values({
        chapterId,
        heading: heading.heading,
        anchor: heading.anchor,
        level: heading.level,
        order: heading.order,
      });
    }
  }

  for (const row of current) {
    if (!seenAnchors.has(row.anchor)) {
      await db.delete(sections).where(eq(sections.id, row.id));
    }
  }

  return headings.length;
}

async function seedSyllabus(courseId: string) {
  const rows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'));
  type TopicDraft = {
    title: string;
    keyPoints: string;
    lab: string;
    estHours: number;
    isLab: boolean;
  };
  const modules: Array<{ title: string; estHours: number; topics: TopicDraft[] }> = [];
  let current: (typeof modules)[number] | null = null;

  for (const row of rows) {
    const moduleName = clean(row[1]);
    const topic = clean(row[2]);

    if (/^Module\s*\d+/i.test(moduleName)) {
      current = { title: moduleName, estHours: 0, topics: [] };
      modules.push(current);
    }

    const isHeader = !topic || /^Topic \/ Sub-point$/i.test(topic);
    if (!current || isHeader) continue;

    const draft: TopicDraft = {
      title: topic,
      keyPoints: clean(row[4]),
      lab: clean(row[5]),
      estHours: Number(clean(row[3])) || 0,
      isLab: /^Lab\s*\d*/i.test(topic),
    };
    current.topics.push(draft);
    current.estHours += draft.estHours;
  }

  const existingModules = await db
    .select()
    .from(syllabusModules)
    .where(eq(syllabusModules.courseId, courseId))
    .orderBy(asc(syllabusModules.order));

  for (const [index, mod] of modules.entries()) {
    let moduleId: string;
    const match = existingModules[index];
    if (match) {
      await db
        .update(syllabusModules)
        .set({ title: mod.title, estHours: mod.estHours })
        .where(eq(syllabusModules.id, match.id));
      moduleId = match.id;
    } else {
      const [row] = await db
        .insert(syllabusModules)
        .values({ courseId, order: index, title: mod.title, estHours: mod.estHours })
        .returning({ id: syllabusModules.id });
      moduleId = row.id;
    }

    const existingTopics = await db
      .select()
      .from(syllabusTopics)
      .where(eq(syllabusTopics.moduleId, moduleId))
      .orderBy(asc(syllabusTopics.order));

    for (const [position, topic] of mod.topics.entries()) {
      const values = {
        order: position,
        title: topic.title,
        keyPoints: topic.keyPoints,
        lab: topic.lab,
        estHours: topic.estHours,
        isLab: topic.isLab,
      };
      const topicMatch = existingTopics[position];
      if (topicMatch) {
        await db.update(syllabusTopics).set(values).where(eq(syllabusTopics.id, topicMatch.id));
      } else {
        await db.insert(syllabusTopics).values({ moduleId, ...values });
      }
    }
    for (const stale of existingTopics.slice(mod.topics.length)) {
      await db.delete(syllabusTopics).where(eq(syllabusTopics.id, stale.id));
    }
  }

  for (const stale of existingModules.slice(modules.length)) {
    await db.delete(syllabusModules).where(eq(syllabusModules.id, stale.id));
  }

  const topics = modules.reduce((sum, mod) => sum + mod.topics.length, 0);
  const labs = modules.reduce((sum, mod) => sum + mod.topics.filter((t) => t.isLab).length, 0);
  return { moduleCount: modules.length, topics, labs };
}

async function main() {
  console.log('Seeding from:', ROOT);
  const courseId = await upsertCourse();
  const chapterCount = await seedChapters(courseId);
  const syllabus = await seedSyllabus(courseId);

  const [chaptersRows, sectionsRows, topicsRows] = await Promise.all([
    db.select({ id: chapters.id }).from(chapters).where(eq(chapters.courseId, courseId)),
    db
      .select({ id: sections.id })
      .from(sections)
      .innerJoin(chapters, and(eq(chapters.id, sections.chapterId), eq(chapters.courseId, courseId))),
    db.select({ id: syllabusTopics.id }).from(syllabusTopics),
  ]);

  console.log(`
Course        : ${COURSE.title}
Chapters      : ${chapterCount} (${chaptersRows.length} in db)
Sections      : ${sectionsRows.length}
Syllabus      : ${syllabus.moduleCount} modules · ${syllabus.topics} topics · ${syllabus.labs} labs
Topic rows    : ${topicsRows.length}
`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
