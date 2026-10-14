import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Clock,
  Flame,
  Target,
  Trophy,
} from 'lucide-react';

import { ProgressRing } from '@/components/progress-ring';
import { requireUser } from '@/lib/auth';
import { buildHeatmap, fromDayKey, lastNDays, prettyDay } from '@/lib/dates';
import {
  getCourse,
  getDashboardData,
  getRecentSessions,
  nextChapter,
} from '@/lib/queries';
import { cn, formatHours, formatMinutes } from '@/lib/utils';

export const metadata: Metadata = { title: 'Dashboard' };

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: 'emerald' | 'violet' | 'amber';
}) {
  const tones = {
    emerald: 'from-emerald-400/20 text-emerald-300',
    violet: 'from-violet-500/20 text-violet-300',
    amber: 'from-amber-400/20 text-amber-300',
  } as const;
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.12em] text-[var(--faint)]">
        <span className={cn('grid h-6 w-6 place-content-center rounded-md bg-gradient-to-br', tones[accent ?? 'emerald'])}>
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-3 text-[1.85rem] font-semibold leading-none tracking-tight tabular-nums">
        {value}
      </div>
      {sub ? <div className="mt-1.5 text-[0.8rem] text-[var(--muted)]">{sub}</div> : null}
    </div>
  );
}

function Heatmap({ totals }: { totals: Record<string, number> }) {
  const grid = buildHeatmap(totals, 26);

  const monthLabels = grid.map((column, index) => {
    const first = fromDayKey(column[0].day);
    const previous = index > 0 ? fromDayKey(grid[index - 1][0].day) : null;
    const show = index === 0 || (previous !== null && previous.getMonth() !== first.getMonth());
    return show ? first.toLocaleDateString(undefined, { month: 'short' }) : '';
  });

  // A partial first week can land two month labels one column (15px) apart —
  // drop the earlier one so "AprMay" never collides.
  for (let i = 0; i < monthLabels.length - 1; i++) {
    if (monthLabels[i] && monthLabels[i + 1]) monthLabels[i] = '';
  }

  return (
    <div className="overflow-x-auto pb-1">
      <div className="min-w-[540px]">
        <div className="mb-1.5 flex gap-[3px] pl-[26px]">
          {monthLabels.map((label, index) => (
            <div key={index} className="relative h-3 w-3">
              <span className="absolute text-[0.6rem] leading-none text-[var(--faint)]">
                {label}
              </span>
            </div>
          ))}
        </div>

        <div className="flex gap-1.5">
          <div className="grid grid-rows-7 gap-[3px] text-[0.58rem] leading-[12px] text-[var(--faint)]">
            <span />
            <span>Mon</span>
            <span />
            <span>Wed</span>
            <span />
            <span>Fri</span>
            <span />
          </div>

          <div className="flex gap-[3px]">
            {grid.map((column, index) => (
              <div key={index} className="grid grid-rows-7 gap-[3px]">
                {column.map((cell) => (
                  <div
                    key={cell.day}
                    className={cn(
                      'heat-cell',
                      cell.level > 0 && `heat-${cell.level}`,
                      cell.future && 'heat-future',
                    )}
                    title={
                      cell.future
                        ? undefined
                        : `${cell.minutes > 0 ? formatMinutes(cell.minutes) : 'No study'} · ${prettyDay(cell.day)}`
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function WeekBars({ totals }: { totals: Record<string, number> }) {
  const days = lastNDays(7);
  const values = days.map((day) => totals[day] ?? 0);
  const max = Math.max(60, ...values);

  return (
    <div className="flex h-28 items-stretch gap-2">
      {days.map((day, index) => {
        const minutes = values[index];
        const height = Math.max(3, Math.round((minutes / max) * 100));
        const isToday = index === days.length - 1;
        return (
          <div key={day} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex w-full flex-1 items-end">
              <div
                className={cn(
                  'w-full rounded-t-[5px] transition-all',
                  minutes > 0
                    ? isToday
                      ? 'bg-gradient-to-t from-emerald-500 to-emerald-300'
                      : 'bg-gradient-to-t from-emerald-600/60 to-emerald-400/70'
                    : 'bg-white/[0.06]',
                )}
                style={{ height: `${height}%` }}
                title={`${prettyDay(day)} · ${formatMinutes(minutes)}`}
              />
            </div>
            <span className="text-[0.6rem] uppercase text-[var(--faint)]">
              {fromDayKey(day).toLocaleDateString(undefined, { weekday: 'narrow' })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();

  const [data, sessions, course] = await Promise.all([
    getDashboardData(user.id),
    getRecentSessions(user.id, 5),
    getCourse(),
  ]);

  const upcoming = nextChapter(data.chapters);
  const completion = data.sectionsTotal
    ? Math.round((data.sectionsDone / data.sectionsTotal) * 100)
    : 0;
  const goal = user.dailyGoalMinutes;
  const goalPercent = Math.min(100, Math.round((data.todayMinutes / goal) * 100));

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="mx-auto max-w-[1180px] fade-up">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.8rem] uppercase tracking-[0.16em] text-[var(--faint)]">{today}</p>
          <h1 className="mt-1.5 text-[2rem] font-semibold tracking-tight">
            {greeting()}, {(user.name || 'learner').split(' ')[0]}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--muted)]">
            {data.streak.todayActive
              ? `Streak safe. ${formatMinutes(data.todayMinutes)} in today — keep the chain alive.`
              : data.streak.current > 0
                ? `${data.streak.current}-day streak on the line. One session keeps it alive.`
                : 'No streak yet — log your first session and start the chain.'}
          </p>
        </div>

        <Link href={upcoming ? `/book/${upcoming.slug}` : '/book'} className="btn btn-primary">
          {upcoming ? `Continue: Chapter ${upcoming.order}` : 'Open the book'}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Stat row */}
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          accent="amber"
          icon={<Flame className="h-3.5 w-3.5" />}
          label="Day streak"
          value={`${data.streak.current}`}
          sub={`Best ${data.streak.longest} · ${data.streak.todayActive ? 'done today' : 'not logged today'}`}
        />
        <StatCard
          accent="emerald"
          icon={<Trophy className="h-3.5 w-3.5" />}
          label="Chapters shipped"
          value={`${data.chaptersDone}/${data.chapters.length}`}
          sub={`${data.sectionsDone} of ${data.sectionsTotal} sections complete`}
        />
        <StatCard
          accent="violet"
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Time studied"
          value={formatHours(data.allTimeMinutes)}
          sub={`Syllabus target ${course?.estHours ?? 157}h`}
        />
        <StatCard
          accent="emerald"
          icon={<Target className="h-3.5 w-3.5" />}
          label="Completion"
          value={`${completion}%`}
          sub={`${data.topicsDone}/${data.topicsTotal} syllabus labs & topics ticked`}
        />
      </div>

      {/* Heatmap + goal */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[0.95rem] font-semibold">Study activity</h2>
              <p className="text-[0.78rem] text-[var(--muted)]">
                {data.streak.current}-day streak · last 26 weeks
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[0.68rem] text-[var(--faint)]">
              Less
              <span className="heat-cell heat-0" />
              <span className="heat-cell heat-1" />
              <span className="heat-cell heat-2" />
              <span className="heat-cell heat-3" />
              <span className="heat-cell heat-4" />
              More
            </div>
          </div>
          <div className="mt-4">
            <Heatmap totals={data.totals} />
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[0.95rem] font-semibold">Today&apos;s goal</h2>
              <p className="text-[0.78rem] text-[var(--muted)]">
                {formatMinutes(data.todayMinutes)} of {formatMinutes(goal)}
              </p>
            </div>
            <ProgressRing value={goalPercent} size={56} stroke={5} showLabel={false} />
          </div>

          <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-300 transition-all duration-700"
              style={{ width: `${goalPercent}%` }}
            />
          </div>

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-[0.72rem] uppercase tracking-[0.12em] text-[var(--faint)]">
              <span>This week</span>
              <span>{formatMinutes(lastNDays(7).reduce((sum, day) => sum + (data.totals[day] ?? 0), 0))}</span>
            </div>
            <WeekBars totals={data.totals} />
          </div>
        </div>
      </div>

      {/* Continue + recent */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="card card-hover p-5 lg:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.12em] text-[var(--faint)]">
                <BookOpen className="h-3.5 w-3.5 text-emerald-300" />
                {upcoming ? `Up next · ${upcoming.kicker}` : 'All chapters complete'}
              </div>
              <h2 className="mt-2 truncate text-[1.25rem] font-semibold tracking-tight">
                {upcoming ? upcoming.title : 'You finished the whole book.'}
              </h2>
              <p className="mt-1.5 text-sm text-[var(--muted)]">
                {upcoming
                  ? `${upcoming.totalSections} sections · about ${upcoming.estMinutes} min`
                  : 'Start the capstone project or log time on the time tracker.'}
              </p>
            </div>
            <ProgressRing
              value={
                upcoming?.totalSections
                  ? Math.round((upcoming.completedSections / upcoming.totalSections) * 100)
                  : 100
              }
              size={54}
              stroke={5}
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={upcoming ? `/book/${upcoming.slug}` : '/book'} className="btn btn-primary">
              {upcoming?.completedSections ? 'Resume reading' : 'Start reading'}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/book" className="btn btn-ghost">
              See syllabus
            </Link>
            <Link href="/time" className="btn btn-ghost">
              Log time
            </Link>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-[0.95rem] font-semibold">Recent sessions</h2>
          <div className="mt-3 space-y-2.5">
            {sessions.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                No sessions yet. Hit <span className="text-emerald-300">Start timer</span> up top and
                the streak starts counting.
              </p>
            ) : (
              sessions.map((session) => (
                <div key={session.id} className="flex items-center gap-3 text-sm">
                  <span
                    className={cn(
                      'h-1.5 w-1.5 shrink-0 rounded-full',
                      session.source === 'timer' ? 'bg-emerald-400' : 'bg-violet-400',
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate text-[var(--muted)]">
                    {session.chapterTitle ?? session.note ?? 'Study session'}
                  </span>
                  <span className="shrink-0 font-mono text-[0.75rem] text-[var(--faint)]">
                    {prettyDay(session.day)}
                  </span>
                  <span className="shrink-0 font-mono text-[0.78rem] tabular-nums text-emerald-300">
                    {formatMinutes(session.minutes)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
