import type { Metadata } from 'next';
import { CalendarDays, CalendarRange, Flame, Timer } from 'lucide-react';

import { TimeLogTool } from '@/components/time/time-log-tool';
import { requireUser } from '@/lib/auth';
import { computeStreak, todayKey } from '@/lib/dates';
import {
  getActiveTimer,
  getChaptersWithProgress,
  getRecentSessions,
  getTimeSummary,
} from '@/lib/queries';
import { formatHours, formatMinutes } from '@/lib/utils';

export const metadata: Metadata = { title: 'Time Log' };

function Metric({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.12em] text-[var(--faint)]">
        {icon}
        {label}
      </div>
      <div className="mt-2.5 text-[1.6rem] font-semibold leading-none tracking-tight tabular-nums">
        {value}
      </div>
      <div className="mt-1.5 text-[0.75rem] text-[var(--muted)]">{sub}</div>
    </div>
  );
}

export default async function TimePage() {
  const user = await requireUser();

  const [summary, sessions, chapters, timer] = await Promise.all([
    getTimeSummary(user.id),
    getRecentSessions(user.id, 200),
    getChaptersWithProgress(user.id),
    getActiveTimer(user.id),
  ]);

  const streak = computeStreak(sessions.map((session) => session.day));

  return (
    <div className="mx-auto max-w-[1180px] fade-up">
      <div>
        <p className="text-[0.8rem] uppercase tracking-[0.16em] text-[var(--faint)]">
          Time logger
        </p>
        <h1 className="mt-1.5 text-[2rem] font-semibold tracking-tight">Your study time</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-[var(--muted)]">
          Run the timer while you work, or log sessions you did offline. Everything here feeds your
          streak, heatmap and completion numbers.
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={<Timer className="h-3.5 w-3.5 text-emerald-300" />}
          label="Today"
          value={formatMinutes(summary.today)}
          sub={`${summary.sessions} sessions all-time`}
        />
        <Metric
          icon={<CalendarRange className="h-3.5 w-3.5 text-violet-300" />}
          label="Last 7 days"
          value={formatHours(summary.week)}
          sub={`${formatMinutes(summary.week)} studied`}
        />
        <Metric
          icon={<CalendarDays className="h-3.5 w-3.5 text-sky-300" />}
          label="Last 30 days"
          value={formatHours(summary.month)}
          sub={`${summary.activeDays} active days ever`}
        />
        <Metric
          icon={<Flame className="h-3.5 w-3.5 text-amber-300" />}
          label="Current streak"
          value={`${streak.current}d`}
          sub={`Best ${streak.longest} · ${formatHours(summary.all)} total`}
        />
      </div>

      <div className="mt-5">
        <TimeLogTool
          chapters={chapters.map((chapter) => ({ id: chapter.id, title: chapter.title }))}
          sessions={sessions.map((session) => ({
            id: session.id,
            day: session.day,
            minutes: session.minutes,
            source: session.source,
            note: session.note,
            chapterId: null,
            chapterTitle: session.chapterTitle,
            startedAt: new Date(session.startedAt).toISOString(),
          }))}
          activeTimer={
            timer
              ? {
                  id: timer.id,
                  startedAt: new Date(timer.startedAt).toISOString(),
                  chapterId: timer.chapterId,
                }
              : null
          }
        />
      </div>

      <p className="mt-4 text-[0.75rem] text-[var(--faint)]">
        Streak days are your local calendar days ({todayKey()}) — a session logged at 11:58pm counts
        for that day.
      </p>
    </div>
  );
}
