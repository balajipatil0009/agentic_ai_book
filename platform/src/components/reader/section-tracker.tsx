'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

import { markSectionSeen } from '@/lib/actions/progress';

type Item = { id: string; anchor: string; seen: boolean };

/**
 * Passive progress: a section is marked "seen" as soon as it scrolls into
 * view. Completion stays explicit — the reader chooses when something is done.
 *
 * Seen-marks are batched into one throttled `router.refresh()` so the
 * "read %" panel climbs live without firing a request per heading.
 */
export function SectionTracker({ items }: { items: Item[] }) {
  const router = useRouter();
  const itemsRef = useRef(items);

  // Keep the observer's view of the world fresh without touching refs mid-render.
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    const reported = new Set<string>();
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        router.refresh();
      }, 1200);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const item = itemsRef.current.find((candidate) => candidate.anchor === entry.target.id);
          if (!item || item.seen || reported.has(item.id)) continue;
          reported.add(item.id);
          markSectionSeen(item.id)
            .then(scheduleRefresh)
            .catch(() => reported.delete(item.id));
        }
      },
      { rootMargin: '0px 0px -50% 0px', threshold: 0 },
    );

    const targets = itemsRef.current
      .map((item) => document.getElementById(item.anchor))
      .filter((node): node is HTMLElement => node !== null);
    targets.forEach((node) => observer.observe(node));

    return () => {
      observer.disconnect();
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [router]);

  return null;
}
