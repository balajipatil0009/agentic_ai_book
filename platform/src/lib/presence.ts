import { sql } from 'drizzle-orm';

import { db } from '@/db';
import { userSessions } from '@/db/schema';

/**
 * Idle gaps longer than this are never credited — a forgotten tab that
 * reappears after lunch counts at most 10 minutes, and multiple tabs can't
 * race because the whole update is one atomic statement.
 */
const IDLE_CAP_SECONDS = 10 * 60;

/**
 * Final + periodic heartbeat: credit elapsed time (capped) and refresh
 * `last_seen_at`, all in a single statement. No-ops for sessions that are
 * already closed or unknown.
 */
export async function bumpSession(sid: string): Promise<void> {
  await db
    .update(userSessions)
    .set({
      lastSeenAt: sql`now()`,
      activeSeconds: sql`
        ${userSessions.activeSeconds}
        + greatest(0, least(extract(epoch from (now() - ${userSessions.lastSeenAt}))::int, ${IDLE_CAP_SECONDS}))
      `,
    })
    .where(sql`${userSessions.id} = ${sid}::uuid and ${userSessions.endedAt} is null`);
}
