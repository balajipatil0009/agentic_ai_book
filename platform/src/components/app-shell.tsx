'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { BookOpen, Check, Clock, LayoutDashboard, LogOut, Menu, Shield, X } from 'lucide-react';

import { TimerPill } from '@/components/timer-pill';
import { ProgressRing } from '@/components/progress-ring';
import { SessionPulse } from '@/components/session-pulse';
import { logoutAction } from '@/lib/actions/auth';
import { cn } from '@/lib/utils';

type ChapterNavItem = {
  id: string;
  slug: string;
  title: string;
  kicker: string;
  percent: number;
  completed: boolean;
};

type Props = {
  user: { name: string | null; email: string; role: string };
  chapters: ChapterNavItem[];
  activeTimer: { id: string; startedAt: string; chapterId: string | null } | null;
  children: ReactNode;
};

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/book', label: 'The Book', icon: BookOpen },
  { href: '/time', label: 'Time Log', icon: Clock },
];

const ADMIN_NAV = { href: '/admin', label: 'Admin', icon: Shield };

export function AppShell({ user, chapters, activeTimer, children }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const initials = (user.name || user.email).trim().slice(0, 1).toUpperCase();

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="grid h-7 w-7 place-content-center rounded-lg bg-emerald-400/15 text-sm font-bold text-emerald-300">
          S
        </span>
        <span className="text-[0.95rem] font-semibold tracking-tight">StudyMate</span>
        <button
          type="button"
          className="ml-auto text-[var(--muted)] lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex flex-col gap-1 px-3">
        {(user.role === 'admin' ? [...NAV, ADMIN_NAV] : NAV).map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                active
                  ? 'bg-white/[0.07] text-white shadow-[inset_0_0_0_1px_var(--line)]'
                  : 'text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)]',
              )}
            >
              <Icon className={cn('h-4 w-4', active && 'text-emerald-300')} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-7 px-5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]">
        Chapters
      </div>
      <div className="mt-2 flex-1 overflow-y-auto px-3 pb-4">
        {chapters.map((chapter, index) => {
          const active = pathname === `/book/${chapter.slug}`;
          return (
            <Link
              key={chapter.id}
              href={`/book/${chapter.slug}`}
              onClick={() => setOpen(false)}
              className={cn(
                'group flex items-start gap-2.5 rounded-lg px-3 py-2 transition',
                active ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 grid h-5 w-5 shrink-0 place-content-center rounded-md border text-[0.62rem] font-mono',
                  chapter.completed
                    ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-300'
                    : 'border-white/10 text-[var(--faint)] group-hover:border-white/20',
                )}
                title={chapter.completed ? 'Completed' : `${chapter.percent}% read`}
              >
                {chapter.completed ? <Check className="h-3 w-3" /> : index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    'block truncate text-[0.83rem] leading-snug',
                    active ? 'text-white' : 'text-[var(--muted)] group-hover:text-[var(--text)]',
                  )}
                >
                  {chapter.title.replace(/^Chapter \d+ — /, '')}
                </span>
                {!chapter.completed && chapter.percent > 0 ? (
                  <span className="mt-1 block h-[3px] w-full overflow-hidden rounded-full bg-white/8">
                    <span
                      className="block h-full rounded-full bg-emerald-400/80"
                      style={{ width: `${chapter.percent}%` }}
                    />
                  </span>
                ) : null}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="border-t border-[var(--line)] p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <span className="grid h-8 w-8 shrink-0 place-content-center rounded-full bg-gradient-to-br from-emerald-400/25 to-violet-500/25 text-xs font-semibold text-white">
            {initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.82rem]">{user.name || 'Learner'}</span>
            <span className="block truncate text-[0.7rem] text-[var(--faint)]">{user.email}</span>
          </span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-md p-1.5 text-[var(--muted)] transition hover:bg-white/[0.06] hover:text-white"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <SessionPulse />
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-[var(--line)] bg-[#0a0b0f]/90 backdrop-blur lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-[var(--line)] bg-[#0a0b0f]">
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-[var(--line)] bg-[#08090d]/85 px-4 backdrop-blur-md sm:px-6">
          <button
            type="button"
            className="rounded-md p-1.5 text-[var(--muted)] hover:bg-white/[0.06] lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden items-center gap-2 sm:flex">
            <ProgressRing value={chapterAverage(chapters)} size={22} stroke={3} showLabel={false} />
            <span className="text-[0.78rem] text-[var(--muted)]">
              {chapterAverage(chapters)}% complete
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2.5">
            <TimerPill
              key={activeTimer ? `${activeTimer.id}:${activeTimer.startedAt}` : 'idle'}
              chapters={chapters}
              initial={activeTimer}
            />
          </div>
        </header>

        <main className="px-4 py-7 sm:px-6 lg:px-9">{children}</main>
      </div>
    </div>
  );
}

function chapterAverage(chapters: ChapterNavItem[]): number {
  if (chapters.length === 0) return 0;
  return Math.round(chapters.reduce((sum, c) => sum + c.percent, 0) / chapters.length);
}
