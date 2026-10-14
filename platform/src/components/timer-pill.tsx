'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Loader2, Play, Square } from 'lucide-react';

import { startTimer, stopTimer, type TimerState } from '@/lib/actions/time';

type ChapterRef = { id: string; slug: string };
type Active = { id: string; startedAt: string; chapterId: string | null } | null;

function elapsedFrom(startedAt: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Global start/stop study timer. Stays mounted in the top bar so it keeps
 * ticking across navigation, and attaches to whatever chapter is open.
 */
export function TimerPill({
  chapters,
  initial,
}: {
  chapters: ChapterRef[];
  initial: Active;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Active>(initial);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [session]);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  const slug = pathname.startsWith('/book/') ? pathname.slice('/book/'.length) : null;
  const currentChapterId = chapters.find((chapter) => chapter.slug === slug)?.id ?? null;

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      if (session) {
        const result = await stopTimer();
        setSession(null);
        if (result.ok && typeof result.minutes === 'number') {
          setFlash(`+${result.minutes}m logged`);
          if (flashTimer.current) clearTimeout(flashTimer.current);
          flashTimer.current = setTimeout(() => setFlash(null), 3200);
        }
      } else {
        const result: TimerState = await startTimer(currentChapterId);
        if (result.ok) {
          setSession({ id: result.id, startedAt: result.startedAt, chapterId: result.chapterId });
          setNow(Date.now());
        }
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (flash) {
    return (
      <span className="pill border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
        {flash}
      </span>
    );
  }

  if (!session) {
    return (
      <button type="button" onClick={toggle} disabled={busy} className="btn btn-ghost !py-1.5 !px-3 text-[0.8rem]">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 text-emerald-300" />}
        Start timer
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className="btn border-amber-400/30 bg-amber-400/10 !py-1.5 !px-3 text-[0.8rem] text-amber-200 hover:bg-amber-400/20"
      title="Stop and log this session"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
      </span>
      <span className="tabular-nums font-mono">{elapsedFrom(session.startedAt, now)}</span>
      <Square className="h-3 w-3" />
    </button>
  );
}
