import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

type Accent = 'emerald' | 'violet' | 'amber';

const tones: Record<Accent, string> = {
  emerald: 'from-emerald-400/20 text-emerald-300',
  violet: 'from-violet-500/20 text-violet-300',
  amber: 'from-amber-400/20 text-amber-300',
};

export function StatCell({
  icon: Icon,
  label,
  value,
  sub,
  accent = 'emerald',
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  accent?: Accent;
}) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.12em] text-[var(--faint)]">
        <span className={cn('grid h-6 w-6 place-content-center rounded-md bg-gradient-to-br', tones[accent])}>
          <Icon className="h-3.5 w-3.5" />
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
