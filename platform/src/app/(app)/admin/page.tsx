import type { Metadata } from 'next';
import { Search } from 'lucide-react';

import { KpiStrip } from '@/components/admin/kpi-strip';
import { SignInBars } from '@/components/admin/signin-bars';
import { SigninsFeed } from '@/components/admin/signins-feed';
import { UsersTable } from '@/components/admin/users-table';
import { requireAdmin } from '@/lib/auth';
import {
  getAdminOverview,
  getAdminUsers,
  getRecentLogins,
  getSignInSeries,
  type AdminSort,
} from '@/lib/queries';

export const metadata: Metadata = { title: 'Admin' };

const SORTS: AdminSort[] = ['last_seen', 'active', 'signins'];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q : '';
  const rawSort = typeof params.sort === 'string' ? params.sort : '';
  const sort: AdminSort = (SORTS as string[]).includes(rawSort) ? (rawSort as AdminSort) : 'last_seen';

  const [overview, users, logins, series] = await Promise.all([
    getAdminOverview(),
    getAdminUsers({ q, sort }),
    getRecentLogins(25),
    getSignInSeries(14),
  ]);

  return (
    <div className="mx-auto max-w-[1180px] fade-up">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.8rem] uppercase tracking-[0.16em] text-[var(--faint)]">Admin</p>
          <h1 className="mt-1.5 text-[2rem] font-semibold tracking-tight">Login activity</h1>
          <p className="mt-1.5 text-sm text-[var(--muted)]">
            Who&apos;s online, who signed in, and how long they stayed.
          </p>
        </div>

        <form method="get" action="/admin" className="flex items-center gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search name or email…"
            className="input w-56"
            aria-label="Search users"
          />
          <input type="hidden" name="sort" value={sort} />
          <button type="submit" className="btn btn-ghost" aria-label="Search">
            <Search className="h-4 w-4" />
            Search
          </button>
        </form>
      </div>

      <div className="mt-7">
        <KpiStrip overview={overview} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <UsersTable rows={users} sort={sort} q={q} />
        </div>
        <div className="flex flex-col gap-4">
          <SigninsFeed rows={logins} />
          <SignInBars series={series} />
        </div>
      </div>
    </div>
  );
}
