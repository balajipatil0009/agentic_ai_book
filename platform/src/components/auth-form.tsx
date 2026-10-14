'use client';

import Link from 'next/link';
import { useActionState, useState, type ChangeEvent } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';

import { loginAction, registerAction } from '@/lib/actions/auth';

type Mode = 'login' | 'register';

const COPY: Record<
  Mode,
  { title: string; sub: string; cta: string; alt: string; altHref: string; altText: string }
> = {
  login: {
    title: 'Welcome back',
    sub: 'Pick up where your streak left off.',
    cta: 'Sign in',
    alt: 'No account yet?',
    altHref: '/register',
    altText: 'Create one in 20 seconds',
  },
  register: {
    title: 'Create your account',
    sub: 'Day 1: you leave with a working product, not a bookmark.',
    cta: 'Create account',
    alt: 'Already building?',
    altHref: '/login',
    altText: 'Sign in instead',
  },
};

export function AuthForm({ mode }: { mode: Mode }) {
  const action = mode === 'login' ? loginAction : registerAction;
  const [state, formAction, pending] = useActionState(action, {});
  const copy = COPY[mode];

  // React resets a server-action form after every submit, which would wipe a
  // mistyped email — the fields stay controlled so a failed attempt keeps them.
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const update = (field: 'name' | 'email' | 'password') => (event: ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({ ...prev, [field]: event.target.value }));

  return (
    <div className="relative w-full max-w-[420px] fade-up">
      <div className="absolute -inset-24 -z-10 glow-emerald opacity-60" aria-hidden />

      <div className="mb-7 text-center">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--text)] transition">
          <span className="grid h-6 w-6 place-content-center rounded-md bg-emerald-400/15 text-emerald-300 text-xs font-bold">
            S
          </span>
          StudyMate
        </Link>
      </div>

      <div className="card p-7">
        <h1 className="text-[1.6rem] font-semibold tracking-tight">{copy.title}</h1>
        <p className="mt-1.5 text-sm text-[var(--muted)]">{copy.sub}</p>

        <form action={formAction} className="mt-6 space-y-4">
          {mode === 'register' && (
            <div>
              <label className="label" htmlFor="name">
                Name <span className="normal-case tracking-normal text-[var(--faint)]">(optional)</span>
              </label>
              <input
                id="name"
                name="name"
                className="input"
                placeholder="Ada Lovelace"
                autoComplete="name"
                value={values.name}
                onChange={update('name')}
              />
            </div>
          )}

          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="input"
              placeholder="you@company.com"
              autoComplete="email"
              value={values.email}
              onChange={update('email')}
            />
          </div>

          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              className="input"
              placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={values.password}
              onChange={update('password')}
            />
          </div>

          {state?.error ? (
            <p
              role="alert"
              className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-300"
            >
              {state.error}
            </p>
          ) : null}

          <button type="submit" className="btn btn-primary w-full" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {copy.cta}
            {!pending ? <ArrowRight className="h-4 w-4" /> : null}
          </button>
        </form>
      </div>

      <p className="mt-5 text-center text-sm text-[var(--muted)]">
        {copy.alt}{' '}
        <Link href={copy.altHref} className="text-emerald-300 hover:text-emerald-200 underline underline-offset-4">
          {copy.altText}
        </Link>
      </p>
    </div>
  );
}
