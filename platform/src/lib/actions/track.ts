'use server';

import { getSession } from '@/lib/auth';
import { bumpSession } from '@/lib/presence';

/**
 * Called by the SessionPulse client component every minute (and immediately
 * when a hidden tab becomes visible again). Cookies issued before the `sid`
 * claim existed simply no-op here.
 */
export async function heartbeat(): Promise<void> {
  const session = await getSession();
  if (!session?.sid) return;
  await bumpSession(session.sid);
}
