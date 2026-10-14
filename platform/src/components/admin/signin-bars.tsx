import { fromDayKey, prettyDay } from '@/lib/dates';
import { cn } from '@/lib/utils';

/** Sign-ins per day — same visual language as the dashboard's week bars. */
export function SignInBars({ series }: { series: Array<{ day: string; count: number }> }) {
  const max = Math.max(1, ...series.map((point) => point.count));
  const total = series.reduce((sum, point) => sum + point.count, 0);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[0.95rem] font-semibold">Sign-ins, last {series.length} days</h2>
          <p className="text-[0.78rem] text-[var(--muted)]">{total} total</p>
        </div>
      </div>

      <div className="mt-4 flex h-28 items-stretch gap-1.5">
        {series.map((point, index) => {
          const height = point.count === 0 ? 3 : Math.max(8, Math.round((point.count / max) * 100));
          const isToday = index === series.length - 1;
          return (
            <div key={point.day} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex w-full flex-1 items-end">
                <div
                  className={cn(
                    'w-full rounded-t-[5px]',
                    point.count > 0
                      ? isToday
                        ? 'bg-gradient-to-t from-violet-500 to-violet-300'
                        : 'bg-gradient-to-t from-violet-600/60 to-violet-400/70'
                      : 'bg-white/[0.06]',
                  )}
                  style={{ height: `${height}%` }}
                  title={`${prettyDay(point.day)} · ${point.count} sign-in${point.count === 1 ? '' : 's'}`}
                />
              </div>
              <span className="text-[0.58rem] uppercase text-[var(--faint)]">
                {index % 2 === 0 || isToday
                  ? fromDayKey(point.day).toLocaleDateString(undefined, { weekday: 'narrow' })
                  : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
