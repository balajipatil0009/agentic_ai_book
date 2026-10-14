import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Clock, ListTree } from 'lucide-react';

import { CompleteButton } from '@/components/reader/complete-button';
import { KeyboardNav } from '@/components/reader/keyboard-nav';
import { MarkdownView } from '@/components/markdown/markdown-view';
import { ReadingProgress } from '@/components/reader/reading-progress';
import { SectionTracker } from '@/components/reader/section-tracker';
import { Toc } from '@/components/reader/toc';
import { requireUser } from '@/lib/auth';
import { getReaderData } from '@/lib/queries';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) };
}

export default async function ChapterPage({ params }: Params) {
  const { slug } = await params;
  const user = await requireUser();
  const data = await getReaderData(user.id, slug);

  const tocItems = data.sections.map((section) => ({
    id: section.id,
    anchor: section.anchor,
    heading: section.heading,
    level: section.level,
    completed: section.completed,
  }));

  return (
    <div className="fade-up">
      <ReadingProgress />
      <KeyboardNav prev={data.prev?.slug ?? null} next={data.next?.slug ?? null} />
      <SectionTracker items={data.sections.map((s) => ({ id: s.id, anchor: s.anchor, seen: s.seen }))} />

      <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[minmax(0,1fr)_236px]">
        <article className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/book"
              className="flex items-center gap-1.5 text-[0.8rem] text-[var(--muted)] transition hover:text-[var(--text)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              All chapters
            </Link>
            <span className="h-3 w-px bg-white/10" />
            <span className="pill !py-1">{data.chapter.kicker}</span>
            <span className="flex items-center gap-1 text-[0.75rem] text-[var(--faint)]">
              <Clock className="h-3 w-3" />
              {data.chapter.estMinutes} min
            </span>
            <span className="flex items-center gap-1 text-[0.75rem] text-[var(--faint)]">
              <ListTree className="h-3 w-3" />
              {data.sections.length} sections
            </span>

            <div className="ml-auto">
              <CompleteButton
                key={data.chapter.id}
                chapterId={data.chapter.id}
                completed={data.chapterCompleted}
              />
            </div>
          </div>

          <div className="mt-6">
            <MarkdownView source={data.chapter.bodyMd} />
          </div>

          {/* Chapter footer navigation */}
          <div className="mt-14 grid gap-3 border-t border-[var(--line)] pt-6 sm:grid-cols-2">
            {data.prev ? (
              <Link
                href={`/book/${data.prev.slug}`}
                className="card card-hover group flex items-center gap-3 p-4"
              >
                <ArrowLeft className="h-4 w-4 shrink-0 text-[var(--faint)] transition group-hover:-translate-x-0.5 group-hover:text-emerald-300" />
                <span className="min-w-0">
                  <span className="block text-[0.68rem] uppercase tracking-[0.14em] text-[var(--faint)]">
                    Previous
                  </span>
                  <span className="block truncate text-[0.9rem]">{data.prev.title}</span>
                </span>
              </Link>
            ) : (
              <span />
            )}

            {data.next ? (
              <Link
                href={`/book/${data.next.slug}`}
                className="card card-hover group flex items-center justify-end gap-3 p-4 text-right"
              >
                <span className="min-w-0">
                  <span className="block text-[0.68rem] uppercase tracking-[0.14em] text-[var(--faint)]">
                    Next
                  </span>
                  <span className="block truncate text-[0.9rem]">{data.next.title}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-[var(--faint)] transition group-hover:translate-x-0.5 group-hover:text-emerald-300" />
              </Link>
            ) : null}
          </div>

          <p className="mt-4 text-center text-[0.75rem] text-[var(--faint)]">
            Tip: press <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[0.7rem]">←</kbd>{' '}
            and <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[0.7rem]">→</kbd> to move
            between chapters.
          </p>
        </article>

        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-6">
            <Toc items={tocItems} />

            <div className="rounded-xl border border-[var(--line)] bg-white/[0.02] p-3.5">
              <div className="text-[0.68rem] uppercase tracking-[0.14em] text-[var(--faint)]">
                Chapter progress
              </div>
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-300"
                  style={{ width: `${data.seenPercent}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[0.72rem] text-[var(--muted)]">
                <span>{data.seenPercent}% read</span>
                <span>
                  {data.sections.filter((s) => s.completed).length}/{data.sections.length} done
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
