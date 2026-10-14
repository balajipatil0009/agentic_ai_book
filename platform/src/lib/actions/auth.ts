'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';
import { createSession, destroySession, hashPassword, verifyPassword } from '@/lib/auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function registerAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const name = String(formData.get('name') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!EMAIL_RE.test(email)) return { error: 'Enter a valid email address.' };
  if (password.length < 8) return { error: 'Password needs at least 8 characters.' };

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) return { error: 'An account with that email already exists.' };

  const passwordHash = await hashPassword(password);
  const [row] = await db
    .insert(users)
    .values({ email, name: name || null, passwordHash })
    .returning({ id: users.id });

  await createSession(row.id);
  redirect('/dashboard');
}

export async function loginAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  // Same message for every failure — never reveal which half was wrong.
  if (!row || !(await verifyPassword(password, row.passwordHash))) {
    return { error: 'Invalid email or password.' };
  }

  await createSession(row.id);
  redirect('/dashboard');
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect('/');
}
