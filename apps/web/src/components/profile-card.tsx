'use client';

import { FormEvent, useState } from 'react';
import { Check, Loader2, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase';

export function ProfileCard({ username, email, displayName }: { username: string; email: string; displayName: string }) {
  const [name, setName] = useState(displayName);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setIsSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError('Your session has expired. Sign in again to update your profile.');
      setIsSaving(false);
      return;
    }

    const { error: updateError } = await supabase.from('profiles').upsert({
      id: user.id,
      username,
      display_name: name.trim() || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    if (updateError) {
      setError('We could not save your profile. Please try again.');
      setIsSaving(false);
      return;
    }

    setName(name.trim());
    setSaved(true);
    setIsSaving(false);
  }

  return <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="profile-heading"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600"><UserRound className="h-5 w-5" aria-hidden="true" /></div><div><h2 id="profile-heading" className="font-semibold text-slate-950">Your profile</h2><p className="text-sm text-slate-500">Update your personal details.</p></div></div><form onSubmit={handleSubmit} className="mt-6 grid gap-5 sm:grid-cols-2"><div><label htmlFor="profile-username" className="text-sm font-medium text-slate-700">Username</label><input id="profile-username" value={`@${username}`} readOnly className="mt-2 h-11 w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500" /><p className="mt-1 text-xs text-slate-500">Your unique username cannot be changed.</p></div><div><label htmlFor="profile-email" className="text-sm font-medium text-slate-700">Email address</label><input id="profile-email" value={email} readOnly className="mt-2 h-11 w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500" /><p className="mt-1 text-xs text-slate-500">Your sign-in email is managed by authentication.</p></div><div className="sm:col-span-2"><label htmlFor="display-name" className="text-sm font-medium text-slate-700">Display name</label><input id="display-name" type="text" maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="How should we address you?" className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none ring-blue-500 transition focus:ring-2" /></div>{error && <p role="alert" className="sm:col-span-2 rounded-md bg-red-50 px-3 py-2 text-sm leading-6 text-red-700">{error}</p>}<div className="flex items-center gap-4 sm:col-span-2"><Button type="submit" disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{!isSaving && saved && <Check className="mr-2 h-4 w-4" />}{saved ? 'Saved' : 'Save profile'}</Button></div></form></section>;
}
