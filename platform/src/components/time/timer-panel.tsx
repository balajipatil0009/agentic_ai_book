'use client';

import { useEffect, useState } from 'react';
import { Loader2, Play, Square } from 'lucide-react';

import { startTimer, stopTimer, type TimerState } from '@/lib/actions/time';
import { cn } from '@/lib/utils';

export type TimerChange =
  | { kind: 'started' }
  | { kind: 'stopped'; minutes?: number }
  | { kind: 'error'; message: string };

type Initial = { id: string; startedAt: string; chapterId: string | null } | null;

function formatElapsed(startedAt: string, now: number) {
  const total = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Owns the live timer's local state. The parent re-keys it whenever the
 * server-side session changes, so it never needs a prop-syncing effect.
 */
export function TimerPanel({
  initial,
  onChanged,
}: {
  initial: Initial;
  onChanged: (change: TimerChange) => void;
}) {
  const [session, setSession] = useState<Initial>(initial);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [session]);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      if (session) {
        const result = await stopTimer();
        setSession(null);
        onChanged({ kind: 'stopped', minutes: result.ok ? result.minutes : undefined });
      } else {
        const result: TimerState = await startTimer(null);
        if (result.ok) {
          setSession({ id: result.id, startedAt: result.startedAt, chapterId: result.chapterId });
          setNow(Date.now());
          onChanged({ kind: 'started' });
        } else {
          onChanged({ kind: 'error', message: result.error });
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card relative overflow-hidden p-6">
      <div
        className={cn(
          'pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-2xl transition-opacity duration-500',
          session ? 'bg-amber-400/20' : 'bg-emerald-400/10',
        )}
        aria-hidden
      />
      <div className="relative">
        <div className="text-[0.7rem] uppercase tracking-[0.16em] text-[var(--faint)]">
          {session ? 'Session in progress' : 'Focus timer'}
        </div>

        <div className="mt-4 font-mono text-[2.9rem] font-medium leading-none tabular-nums tracking-tight">
          {session ? formatElapsed(session.startedAt, now) : '00:00:00'}
        </div>

        <p className="mt-3 text-sm text-[var(--muted)]">
          {session
            ? 'Running — refresh, navigate, close the tab; it keeps counting from the server.'
            : 'Start the timer and every minute is credited to your streak and heatmap.'}
        </p>

        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className={cn('btn mt-5 w-full sm:w-auto', session ? 'btn-danger' : 'btn-primary')}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : session ? (
            <Square className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          {session ? 'Stop & log session' : 'Start timer'}
        </button>
      </div>
    </div>
  );
}
