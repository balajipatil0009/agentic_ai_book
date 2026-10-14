import { cookies, headers } from 'next/headers';
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

/**
 * Issues the session cookie. The JWT carries a `sid` claim (also the
 * `user_sessions.id`) so presence tracking can attribute heartbeats.
 * Cookies issued before `sid` existed verify fine — heartbeats just no-op.
 */
export async function createSession(userId: string): Promise<string> {
  const sid = crypto.randomUUID();
  const token = await new SignJWT({ scope: 'session', sid })
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

  return sid;
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export type Session = { userId: string; sid: string | null };

export const getSession = cache(async (): Promise<Session | null> => {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.sub !== 'string') return null;
    return {
      userId: payload.sub,
      sid: typeof payload.sid === 'string' ? payload.sid : null,
    };
  } catch {
    return null;
  }
});

export async function getSessionUserId(): Promise<string | null> {
  return (await getSession())?.userId ?? null;
}

/** Deduped per request so a page can call it freely. */
export const getSessionUser = cache(
  async (): Promise<{ user: User; sid: string | null } | null> => {
    const session = await getSession();
    if (!session) return null;
    const [row] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    if (!row) return null;
    return { user: row, sid: session.sid };
  },
);

export async function getCurrentUser(): Promise<User | null> {
  return (await getSessionUser())?.user ?? null;
}

/** For authed pages/layouts — redirects to login when there's no session. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/** Admin-only pages — anonymous users go to /login, non-admins to /dashboard. */
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== 'admin') redirect('/dashboard');
  return user;
}

/** Client IP + user agent for the login audit trail. */
export async function clientInfo(): Promise<{ ip: string; userAgent: string }> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for');
  const ip = (forwarded?.split(',')[0] ?? h.get('x-real-ip') ?? '').trim() || 'local';
  const userAgent = (h.get('user-agent') ?? '').slice(0, 300);
  return { ip, userAgent };
}

export async function hashPassword(password: string) {
  const { hash } = await import('bcryptjs');
  return hash(password, 10);
}

export async function verifyPassword(password: string, passwordHash: string) {
  const { compare } = await import('bcryptjs');
  return compare(password, passwordHash);
}
