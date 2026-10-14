import { LogIn, LogOut } from 'lucide-react';

import type { RecentLoginRow } from '@/lib/queries';
import { cn } from '@/lib/utils';

function browserOf(userAgent: string): string {
  if (!userAgent) return 'Unknown browser';
  if (/edg\//i.test(userAgent)) return 'Edge';
  if (/chrome\//i.test(userAgent)) return 'Chrome';
  if (/firefox\//i.test(userAgent)) return 'Firefox';
  if (/safari\//i.test(userAgent) && !/chrome/i.test(userAgent)) return 'Safari';
  return userAgent.slice(0, 40);
}

function stamp(date: Date): string {
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SigninsFeed({ rows }: { rows: RecentLoginRow[] }) {
  return (
    <div className="card p-5">
      <h2 className="text-[0.95rem] font-semibold">Recent sign-ins</h2>
      <p className="text-[0.78rem] text-[var(--muted)]">Last {rows.length} events</p>

      <div className="mt-3 space-y-2.5">
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            Nothing yet — sign-ins appear here the moment someone logs in.
          </p>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="flex items-center gap-3 text-sm">
              <span
                className={cn(
                  'grid h-6 w-6 shrink-0 place-content-center rounded-md',
                  row.kind === 'login'
                    ? 'bg-emerald-400/15 text-emerald-300'
                    : 'bg-white/[0.06] text-[var(--faint)]',
                )}
                title={row.kind === 'login' ? 'Sign-in' : 'Sign-out'}
              >
                {row.kind === 'login' ? (
                  <LogIn className="h-3.5 w-3.5" />
                ) : (
                  <LogOut className="h-3.5 w-3.5" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.85rem] text-[var(--text)]">
                  {row.name ?? row.email}
                </span>
                <span className="block truncate text-[0.7rem] text-[var(--faint)]">
                  {browserOf(row.userAgent)} · {row.ip || 'local'}
                </span>
              </span>
              <span className="shrink-0 font-mono text-[0.72rem] text-[var(--faint)]">
                {stamp(new Date(row.occurredAt))}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
