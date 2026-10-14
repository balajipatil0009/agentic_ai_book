'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';

import { setSectionComplete } from '@/lib/actions/progress';
import { cn } from '@/lib/utils';

export type TocItem = {
  id: string;
  anchor: string;
  heading: string;
  level: number;
  completed: boolean;
};

/** Sticky "On this page" rail: scrollspy + per-section completion. */
export function Toc({ items }: { items: TocItem[] }) {
  const router = useRouter();
  const [active, setActive] = useState(items[0]?.anchor ?? '');
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        let current = items[0]?.anchor ?? '';
        for (const item of items) {
          const node = document.getElementById(item.anchor);
          if (node && node.getBoundingClientRect().top <= 110) current = item.anchor;
        }
        setActive(current);
      });
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
      cancelAnimationFrame(frame);
    };
  }, [items]);

  async function toggle(item: TocItem) {
    const next = !(overrides[item.id] ?? item.completed);
    setOverrides((prev) => ({ ...prev, [item.id]: next }));
    await setSectionComplete(item.id, next);
    router.refresh();
  }

  if (items.length === 0) return null;

  return (
    <nav aria-label="On this page" className="text-sm">
      <div className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--faint)]">
        On this page
      </div>
      <ul className="space-y-0.5 border-l border-[var(--line)]">
        {items.map((item) => {
          const done = overrides[item.id] ?? item.completed;
          const isActive = active === item.anchor;
          return (
            <li key={item.id} className="group relative">
              <span
                className={cn(
                  'absolute -left-px top-0 h-full w-px transition-colors',
                  isActive ? 'bg-emerald-400' : 'bg-transparent',
                )}
              />
              <div
                className={cn(
                  'flex items-start gap-1.5 py-1',
                  item.level === 3 ? 'pl-6' : 'pl-3',
                )}
              >
                <button
                  type="button"
                  onClick={() => toggle(item)}
                  aria-label={done ? 'Mark as not complete' : 'Mark section complete'}
                  className={cn(
                    'mt-[3px] grid h-3.5 w-3.5 shrink-0 place-content-center rounded-[4px] border transition',
                    done
                      ? 'border-emerald-400/50 bg-emerald-400 text-[#04140e]'
                      : 'border-white/15 text-transparent hover:border-emerald-400/60 group-hover:text-white/25',
                  )}
                >
                  <Check className="h-2.5 w-2.5" strokeWidth={4} />
                </button>

                <a
                  href={`#${item.anchor}`}
                  className={cn(
                    'min-w-0 flex-1 break-words leading-snug transition',
                    item.level === 3 ? 'text-[0.78rem]' : 'text-[0.82rem]',
                    isActive
                      ? 'text-emerald-200'
                      : 'text-[var(--muted)] hover:text-[var(--text)]',
                    done && !isActive && 'opacity-70',
                  )}
                >
                  {item.heading}
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
