'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight, Beaker, Check, Clock } from 'lucide-react';

import { setTopicComplete } from '@/lib/actions/progress';
import { ProgressRing } from '@/components/progress-ring';
import { cn } from '@/lib/utils';

export type ChapterCard = {
  id: string;
  slug: string;
  title: string;
  kicker: string;
  estMinutes: number;
  totalSections: number;
  completedSections: number;
  seenSections: number;
  completed: boolean;
};

export type SyllabusTopic = {
  id: string;
  title: string;
  keyPoints: string;
  lab: string;
  estHours: number;
  isLab: boolean;
  completed: boolean;
};

export type SyllabusModule = {
  id: string;
  title: string;
  estHours: number;
  topics: SyllabusTopic[];
  completed: number;
  total: number;
};

function percent(done: number, total: number) {
  return total ? Math.round((done / total) * 100) : 0;
}

export function CourseTabs({
  chapters,
  modules,
}: {
  chapters: ChapterCard[];
  modules: SyllabusModule[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'path' | 'syllabus'>('path');
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(topicId: string, next: boolean) {
    setOverrides((prev) => ({ ...prev, [topicId]: next }));
    setBusy(topicId);
    try {
      await setTopicComplete(topicId, next);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-8">
      <div className="flex gap-1 rounded-xl border border-[var(--line)] bg-white/[0.03] p-1 w-fit">
        {(
          [
            ['path', 'Reading path'],
            ['syllabus', 'Syllabus & labs'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'rounded-lg px-4 py-1.5 text-sm transition',
              tab === key
                ? 'bg-white/[0.09] text-white shadow-[inset_0_0_0_1px_var(--line)]'
                : 'text-[var(--muted)] hover:text-[var(--text)]',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'path' ? (
        <div className="mt-5 grid gap-3.5 md:grid-cols-2">
          {chapters.map((chapter, index) => {
            const read = percent(chapter.completedSections, chapter.totalSections);
            const seen = percent(chapter.seenSections, chapter.totalSections);
            return (
              <Link
                key={chapter.id}
                href={`/book/${chapter.slug}`}
                className="card card-hover group flex gap-4 p-5"
              >
                <div className="pt-0.5">
                  <ProgressRing value={chapter.completed ? 100 : read} size={44} stroke={4} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[0.68rem] uppercase tracking-[0.14em] text-[var(--faint)]">
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 border',
                        chapter.completed
                          ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                          : 'border-white/10',
                      )}
                    >
                      {chapter.kicker}
                    </span>
                    <span>{chapter.totalSections} sections</span>
                  </div>
                  <h3 className="mt-2 text-[1.02rem] font-semibold leading-snug tracking-tight group-hover:text-emerald-200">
                    {index + 1}. {chapter.title.replace(/^Chapter \d+ — /, '')}
                  </h3>
                  <div className="mt-3 flex items-center gap-3">
                    <span className="flex items-center gap-1 text-[0.72rem] text-[var(--faint)]">
                      <Clock className="h-3 w-3" />
                      {chapter.estMinutes} min
                    </span>
                    {seen > 0 && !chapter.completed ? (
                      <span className="text-[0.72rem] text-amber-300/80">{seen}% skimmed</span>
                    ) : null}
                    <span className="ml-auto flex items-center gap-1 text-[0.75rem] font-medium text-emerald-300 opacity-0 transition group-hover:opacity-100">
                      Open <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {modules.map((module, moduleIndex) => (
            <div key={module.id} className="card overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] bg-white/[0.02] px-5 py-4">
                <span className="grid h-7 w-7 shrink-0 place-content-center rounded-lg bg-violet-500/15 text-[0.72rem] font-semibold text-violet-300">
                  {moduleIndex + 1}
                </span>
                <h3 className="flex-1 text-[0.98rem] font-semibold tracking-tight">{module.title}</h3>
                <span className="text-[0.72rem] text-[var(--faint)]">{module.estHours}h</span>
                <span className="text-[0.75rem] tabular-nums text-emerald-300">
                  {module.completed}/{module.total}
                </span>
              </div>

              <ul className="divide-y divide-white/[0.05]">
                {module.topics.map((topic) => {
                  const done = overrides[topic.id] ?? topic.completed;
                  return (
                    <li
                      key={topic.id}
                      className="flex items-start gap-3 px-5 py-3 transition hover:bg-white/[0.02]"
                    >
                      <button
                        type="button"
                        onClick={() => toggle(topic.id, !done)}
                        disabled={busy === topic.id}
                        aria-pressed={done}
                        className={cn(
                          'mt-0.5 grid h-[18px] w-[18px] shrink-0 place-content-center rounded-md border transition',
                          done
                            ? 'border-emerald-400/50 bg-emerald-400 text-[#04140e]'
                            : 'border-white/15 bg-black/30 hover:border-emerald-400/50',
                        )}
                      >
                        {done ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                      </button>

                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'text-[0.9rem] leading-snug',
                            done ? 'text-[var(--faint)] line-through' : 'text-[var(--text)]',
                          )}
                        >
                          {topic.title}
                        </p>
                        {topic.keyPoints ? (
                          <p className="mt-1 text-[0.75rem] text-[var(--faint)]">
                            {topic.keyPoints}
                            {topic.estHours ? ` · ${topic.estHours}h` : ''}
                          </p>
                        ) : null}
                        {topic.lab ? (
                          <div className="mt-2 flex items-start gap-2 rounded-lg border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-2">
                            <Beaker className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
                            <p className="text-[0.78rem] leading-relaxed text-emerald-100/85">
                              {topic.lab}
                            </p>
                          </div>
                        ) : null}
                      </div>

                      {topic.isLab ? (
                        <span className="mt-0.5 shrink-0 rounded border border-violet-400/25 bg-violet-500/10 px-1.5 py-0.5 text-[0.62rem] uppercase tracking-wider text-violet-300">
                          lab
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          <p className="text-[0.78rem] text-[var(--faint)]">
            Ticking a topic marks it done on your dashboard. Total estimated time:{' '}
            <span className="text-[var(--muted)]">
              {modules.reduce((sum, m) => sum + m.estHours, 0)}h
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
