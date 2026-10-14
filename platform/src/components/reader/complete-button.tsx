'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Check, CircleCheckBig } from 'lucide-react';

import { setChapterComplete } from '@/lib/actions/progress';

/**
 * Initial state comes from the server; the page re-keys this button per
 * chapter, so no prop-syncing effect is needed.
 */
export function CompleteButton({ chapterId, completed }: { chapterId: string; completed: boolean }) {
  const router = useRouter();
  const [done, setDone] = useState(completed);

  async function toggle() {
    const next = !done;
    setDone(next);
    await setChapterComplete(chapterId, next);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={done ? 'btn btn-ghost !text-emerald-200' : 'btn btn-primary'}
      aria-pressed={done}
    >
      {done ? (
        <>
          <Check className="h-4 w-4" /> Completed
        </>
      ) : (
        <>
          <CircleCheckBig className="h-4 w-4" /> Mark chapter complete
        </>
      )}
    </button>
  );
}
