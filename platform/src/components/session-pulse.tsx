'use client';

import { useEffect } from 'react';

import { heartbeat } from '@/lib/actions/track';

const TICK_MS = 60_000;

/**
 * Invisible presence probe. Mounted once in the app shell: every 60s it
 * credits the open session row; hidden tabs don't tick, and become visible
 * again they tick immediately so the gap isn't lost.
 */
export function SessionPulse() {
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = () => {
      void heartbeat();
    };

    const start = () => {
      if (timer !== null) return;
      tick();
      timer = setInterval(tick, TICK_MS);
    };

    const stop = () => {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') start();
      else stop();
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return null;
}
