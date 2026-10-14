import 'dotenv/config';
import { eq } from 'drizzle-orm';

import { db } from '../src/db';
import { users } from '../src/db/schema';

/**
 * Promotes a user to admin: `npm run db:admin -- you@example.com`
 * The /admin dashboard is gated on this role.
 */
async function main() {
  const email = (process.argv[2] ?? '').trim().toLowerCase();
  if (!email) {
    console.error('Usage: npm run db:admin -- <email>');
    process.exit(1);
  }

  const [row] = await db
    .update(users)
    .set({ role: 'admin' })
    .where(eq(users.email, email))
    .returning({ id: users.id, name: users.name });

  if (!row) {
    console.error(`No user with email "${email}".`);
    process.exit(1);
  }

  console.log(`Promoted ${row.name ?? row.id} <${email}> to admin.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
