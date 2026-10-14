import Link from 'next/link';

import type { AdminSort, AdminUserRow } from '@/lib/queries';
import { cn, formatMinutes, timeAgo } from '@/lib/utils';

const SORTS: Array<{ key: AdminSort; label: string }> = [
  { key: 'last_seen', label: 'Last seen' },
  { key: 'active', label: 'Logged-in time' },
  { key: 'signins', label: 'Sign-ins' },
];

function sortHref(sort: AdminSort, q: string) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  params.set('sort', sort);
  return `/admin?${params.toString()}`;
}

export function UsersTable({ rows, sort, q }: { rows: AdminUserRow[]; sort: AdminSort; q: string }) {
  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[0.95rem] font-semibold">Users</h2>
          <p className="text-[0.78rem] text-[var(--muted)]">
            {rows.length} {rows.length === 1 ? 'account' : 'accounts'}
            {q ? ` matching “${q}”` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[0.72rem]">
          <span className="text-[var(--faint)]">Sort by</span>
          {SORTS.map((option) => (
            <Link
              key={option.key}
              href={sortHref(option.key, q)}
              className={cn(
                'rounded-md px-2 py-1 transition',
                sort === option.key
                  ? 'bg-white/[0.08] text-white shadow-[inset_0_0_0_1px_var(--line)]'
                  : 'text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)]',
              )}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">
          {q ? 'No users match that search.' : 'No accounts yet.'}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-[0.68rem] uppercase tracking-[0.12em] text-[var(--faint)]">
                <th className="pb-2 pr-4 font-semibold">User</th>
                <th className="pb-2 pr-4 font-semibold">Role</th>
                <th className="pb-2 pr-4 font-semibold">Last seen</th>
                <th className="pb-2 pr-4 text-right font-semibold">Logged-in</th>
                <th className="pb-2 pr-4 text-right font-semibold">Sessions</th>
                <th className="pb-2 pr-4 text-right font-semibold">Sign-ins 7d</th>
                <th className="pb-2 pr-4 text-right font-semibold">Studied</th>
                <th className="pb-2 text-right font-semibold">Chapters</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--line)]/60 last:border-0">
                  <td className="py-2.5 pr-4">
                    <span className="flex items-center gap-2">
                      {row.online ? (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                          title="Online now"
                        />
                      ) : (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/15" />
                      )}
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-[var(--text)]">
                          {row.name ?? 'Unnamed'}
                        </span>
                        <span className="block truncate text-[0.72rem] text-[var(--faint)]">
                          {row.email}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[0.68rem] font-medium uppercase tracking-wide',
                        row.role === 'admin'
                          ? 'bg-violet-500/15 text-violet-300'
                          : 'bg-white/[0.06] text-[var(--muted)]',
                      )}
                    >
                      {row.role}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-[var(--muted)]">
                    {row.online ? (
                      <span className="text-emerald-300">online</span>
                    ) : (
                      timeAgo(row.lastSeenAt)
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-right font-mono text-[0.78rem] tabular-nums">
                    {formatMinutes(Math.round(row.activeSeconds / 60))}
                  </td>
                  <td className="py-2.5 pr-4 text-right font-mono text-[0.78rem] tabular-nums text-[var(--muted)]">
                    {row.sessions}
                  </td>
                  <td className="py-2.5 pr-4 text-right font-mono text-[0.78rem] tabular-nums text-[var(--muted)]">
                    {row.signIns7d}
                  </td>
                  <td className="py-2.5 pr-4 text-right font-mono text-[0.78rem] tabular-nums text-[var(--muted)]">
                    {formatMinutes(row.studiedMinutes)}
                  </td>
                  <td className="py-2.5 text-right font-mono text-[0.78rem] tabular-nums text-[var(--muted)]">
                    {row.chaptersCompleted}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
