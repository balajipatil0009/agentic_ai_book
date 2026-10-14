import { Activity, Clock, LogIn, Timer, Users } from 'lucide-react';

import { StatCell } from '@/components/admin/stat-cell';
import type { AdminOverview } from '@/lib/queries';
import { formatSeconds } from '@/lib/utils';

export function KpiStrip({ overview }: { overview: AdminOverview }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatCell
        icon={Users}
        label="Total users"
        value={`${overview.totalUsers}`}
        sub={`${overview.newThisWeek} new this week`}
      />
      <StatCell
        accent="emerald"
        icon={Activity}
        label="Online now"
        value={`${overview.onlineNow}`}
        sub="seen in the last 2 min"
      />
      <StatCell
        accent="violet"
        icon={LogIn}
        label="Sign-ins today"
        value={`${overview.signInsToday}`}
      />
      <StatCell
        accent="amber"
        icon={Timer}
        label="Active time today"
        value={formatSeconds(overview.activeSecondsToday)}
        sub="of open sessions started today"
      />
      <StatCell
        icon={Clock}
        label="New this week"
        value={`${overview.newThisWeek}`}
        sub="accounts created, last 7 days"
      />
    </div>
  );
}
