'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** ← / → move between chapters, unless the learner is typing somewhere. */
export function KeyboardNav({ prev, next }: { prev: string | null; next: string | null }) {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === 'ArrowLeft' && prev) router.push(`/book/${prev}`);
      if (event.key === 'ArrowRight' && next) router.push(`/book/${next}`);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [prev, next, router]);

  return null;
}
