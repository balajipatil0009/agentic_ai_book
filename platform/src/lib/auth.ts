import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users, type User } from '@/db/schema';

const COOKIE = 'studymate_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error('AUTH_SECRET is not set');
  return new TextEncoder().encode(value);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ scope: 'session' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

/** Deduped per request so a page can call it freely. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const id = await getSessionUserId();
  if (!id) return null;
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
});

/** For authed pages/layouts — redirects to login when there's no session. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export async function hashPassword(password: string) {
  const { hash } = await import('bcryptjs');
  return hash(password, 10);
}

export async function verifyPassword(password: string, passwordHash: string) {
  const { compare } = await import('bcryptjs');
  return compare(password, passwordHash);
}
