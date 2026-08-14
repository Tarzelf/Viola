'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Sign in.
 *
 * Two screens, six digits, no password. The whole flow is one field at a time
 * because the audience is one-handed on a phone.
 *
 * When no email provider is configured the code is shown on screen rather than
 * sent, so the app is fully usable on a fresh clone. That path is clearly
 * labelled as development-only so nobody mistakes it for production behaviour.
 */
export function SignInForm({ next = '/' }: { next?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitEmail(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/request-code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json()) as {
        devCode?: string;
        devMode?: boolean;
        error?: { message?: string };
      };

      if (!response.ok) throw new Error(data.error?.message ?? 'Could not send a code');
      if (data.devMode && data.devCode) setDevCode(data.devCode);
      setStep('code');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = (await response.json()) as {
        claimedBlooms?: number;
        error?: { message?: string };
      };

      if (!response.ok) throw new Error(data.error?.message ?? 'That did not work');

      router.push(next);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[380px]">
      <h1 className="display text-[34px] leading-tight text-white">
        {step === 'email' ? 'Sign in' : 'Check your email'}
      </h1>
      <p className="mt-2 text-[15px] text-[var(--color-text-secondary)]">
        {step === 'email'
          ? 'No password. We send a six-digit code.'
          : `We sent a code to ${email}.`}
      </p>

      {step === 'email' ? (
        <form onSubmit={submitEmail} className="mt-7 flex flex-col gap-3">
          <input
            type="email"
            required
            autoFocus
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface)] px-4 py-3.5 text-[15px] text-white placeholder:text-[var(--color-text-tertiary)]"
          />
          <button
            type="submit"
            disabled={busy || email.length < 4}
            className="rounded-full bg-[var(--color-viola)] px-5 py-3.5 text-[15px] font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-45"
          >
            {busy ? 'Sending…' : 'Send code'}
          </button>
        </form>
      ) : (
        <form onSubmit={submitCode} className="mt-7 flex flex-col gap-3">
          <input
            type="text"
            required
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="stat w-full rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface)] px-4 py-3.5 text-center text-[24px] tracking-[0.4em] text-white placeholder:text-[var(--color-text-tertiary)]"
          />
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="rounded-full bg-[var(--color-viola)] px-5 py-3.5 text-[15px] font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-45"
          >
            {busy ? 'Checking…' : 'Continue'}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep('email');
              setCode('');
              setDevCode(null);
              setError(null);
            }}
            className="text-[13px] text-[var(--color-text-tertiary)] transition-colors hover:text-white"
          >
            Use a different email
          </button>
        </form>
      )}

      {devCode && (
        <div className="mt-5 rounded-[var(--radius-lg)] border border-[rgba(240,195,107,0.28)] bg-[rgba(240,195,107,0.07)] px-4 py-3">
          <p className="label-caps text-[var(--color-warning)]">Development mode</p>
          <p className="mt-1.5 text-[13px] text-[var(--color-text-secondary)]">
            No email provider configured, so your code is{' '}
            <span className="stat text-white">{devCode}</span>
          </p>
        </div>
      )}

      {error && <p className="mt-4 text-[13px] text-[var(--color-danger)]">{error}</p>}

      <p className="mt-8 text-[12px] leading-relaxed text-[var(--color-text-tertiary)]">
        Anything you bloomed before signing in is kept and moved to your account.
      </p>
    </div>
  );
}
