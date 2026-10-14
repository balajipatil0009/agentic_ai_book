import type { Metadata } from 'next';

import { AuthForm } from '@/components/auth-form';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-5 py-12">
      <div className="bg-grid pointer-events-none absolute inset-0 -z-10" aria-hidden />
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 glow-emerald -z-10"
        aria-hidden
      />
      <AuthForm mode="login" />
    </main>
  );
}
