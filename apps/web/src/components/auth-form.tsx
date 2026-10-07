'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase';

const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSignup = mode === 'signup';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const normalizedUsername = username.trim().toLowerCase();
    if (isSignup && !USERNAME_PATTERN.test(normalizedUsername)) {
      setError('Username must be 3–30 characters and use only lowercase letters, numbers, or underscores.');
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    const result = isSignup
      ? await supabase.auth.signUp({
          email,
          password,
          options: { data: { username: normalizedUsername } },
        })
      : await supabase.auth.signInWithPassword({ email, password });

    if (result.error) {
      const isDuplicateUsername = result.error.message.toLowerCase().includes('duplicate') || result.error.message.toLowerCase().includes('unique');
      setError(isDuplicateUsername ? 'That username is already taken. Choose another one.' : isSignup ? 'We could not create your account. Check your details and try again.' : 'That email and password do not match. Check them and try again.');
      setIsSubmitting(false);
      return;
    }

    if (isSignup && !result.data.session) {
      setError('Your account was created. Check your email for a confirmation link before signing in.');
      setIsSubmitting(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12"><div className="w-full max-w-md"><Link href="/" className="mb-10 inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to home</Link><div className="rounded-2xl bg-white p-8 shadow-2xl sm:p-10"><p className="text-sm font-semibold text-blue-600">RFP Orchestrator</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{isSignup ? 'Create your account' : 'Welcome back'}</h1><p className="mt-2 text-slate-600">{isSignup ? 'Join the early access group and help shape the product.' : 'Sign in to continue to your workspace.'}</p><form onSubmit={handleSubmit} className="mt-8 space-y-5">{isSignup && <div><label htmlFor="username" className="text-sm font-medium text-slate-700">Username</label><input id="username" type="text" required minLength={3} maxLength={30} pattern="[a-z0-9_]{3,30}" autoCapitalize="none" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())} placeholder="your_username" className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none ring-blue-500 transition focus:ring-2" /><p className="mt-1 text-xs text-slate-500">3–30 lowercase letters, numbers, or underscores.</p></div>}<div><label htmlFor="email" className="text-sm font-medium text-slate-700">Email address</label><input id="email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none ring-blue-500 transition focus:ring-2" /></div><div><label htmlFor="password" className="text-sm font-medium text-slate-700">Password</label><input id="password" type="password" required minLength={6} autoComplete={isSignup ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none ring-blue-500 transition focus:ring-2" /></div>{error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm leading-6 text-red-700">{error}</p>}<Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isSignup ? 'Create account' : 'Sign in'}</Button></form><p className="mt-6 text-center text-sm text-slate-600">{isSignup ? 'Already have an account?' : 'Need an account?'}{' '}<Link href={isSignup ? '/login' : '/signup'} className="font-medium text-blue-600 hover:underline">{isSignup ? 'Sign in' : 'Create one'}</Link></p></div></div></main>;
}
