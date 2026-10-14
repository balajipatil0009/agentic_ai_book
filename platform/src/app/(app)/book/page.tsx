import type { Metadata } from 'next';
import { BookOpen, Layers, ListChecks, Timer } from 'lucide-react';

import { CourseTabs, type ChapterCard, type SyllabusModule } from '@/components/course-tabs';
import { requireUser } from '@/lib/auth';
import { getChaptersWithProgress, getCourse, getSyllabus } from '@/lib/queries';

export const metadata: Metadata = { title: 'The Book' };

export default async function BookPage() {
  const user = await requireUser();

  const [course, chapters, modules] = await Promise.all([
    getCourse(),
    getChaptersWithProgress(user.id),
    getSyllabus(user.id),
  ]);

  const chapterCards: ChapterCard[] = chapters.map((chapter) => ({
    id: chapter.id,
    slug: chapter.slug,
    title: chapter.title,
    kicker: chapter.kicker,
    estMinutes: chapter.estMinutes,
    totalSections: chapter.totalSections,
    completedSections: chapter.completedSections,
    seenSections: chapter.seenSections,
    completed: Boolean(chapter.completedAt),
  }));

  const syllabus: SyllabusModule[] = modules.map((module) => ({
    id: module.id,
    title: module.title,
    estHours: module.estHours,
    completed: module.completed,
    total: module.total,
    topics: module.topics.map((topic) => ({
      id: topic.id,
      title: topic.title,
      keyPoints: topic.keyPoints,
      lab: topic.lab,
      estHours: topic.estHours,
      isLab: topic.isLab,
      completed: Boolean(topic.completedAt),
    })),
  }));

  const totalSections = chapters.reduce((sum, chapter) => sum + chapter.totalSections, 0);
  const doneSections = chapters.reduce((sum, chapter) => sum + chapter.completedSections, 0);
  const totalMinutes = chapters.reduce((sum, chapter) => sum + chapter.estMinutes, 0);
  const labs = syllabus.reduce(
    (sum, module) => sum + module.topics.filter((topic) => topic.isLab).length,
    0,
  );

  const stats = [
    { icon: BookOpen, label: 'Chapters', value: `${chapters.length}` },
    { icon: Layers, label: 'Sections', value: `${doneSections}/${totalSections}` },
    { icon: Timer, label: 'Reading time', value: `${Math.round(totalMinutes / 60)}h` },
    { icon: ListChecks, label: 'Labs to build', value: `${labs}` },
  ];

  return (
    <div className="mx-auto max-w-[1180px] fade-up">
      <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-gradient-to-br from-white/[0.05] via-white/[0.02] to-transparent p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 glow-emerald" aria-hidden />
        <div className="relative">
          <span className="pill">Project-oriented · learn by doing</span>
          <h1 className="mt-4 text-[2rem] font-semibold leading-tight tracking-tight sm:text-[2.4rem]">
            {course?.title ?? 'The Book'}
          </h1>
          <p className="mt-3 max-w-2xl text-[0.98rem] leading-relaxed text-[var(--muted)]">
            {course?.tagline}
          </p>

          <div className="mt-6 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-[var(--line)] bg-black/25 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-[0.66rem] uppercase tracking-[0.12em] text-[var(--faint)]">
                  <stat.icon className="h-3 w-3" />
                  {stat.label}
                </div>
                <div className="mt-1 text-[1.05rem] font-semibold tabular-nums">{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <CourseTabs chapters={chapterCards} modules={syllabus} />
    </div>
  );
}
