import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createServerClient } from '@/lib/supabase';
import { ProfileCard } from '@/components/profile-card';
import { Logo } from '@/components/logo';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const supabase = createServerClient();
  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user) {
      user = data.user;
    }
  } catch {
    user = null;
  }
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('username, display_name').eq('id', user.id).maybeSingle();
  const username = profile?.username || user.email?.split('@')[0] || 'user';

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4 lg:px-8">
          <Logo href="/dashboard" size="sm" />
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950">
            <ArrowLeft className="h-4 w-4" /> Back to workspace
          </Link>
        </div>
      </header>
      <section className="mx-auto max-w-4xl px-6 py-16 lg:px-8">
        <p className="text-sm font-medium text-blue-600">Account</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Your profile</h1>
        <p className="mt-3 text-slate-600">Manage the details your team sees. Your unique username cannot be changed.</p>
        <div className="mt-10 max-w-2xl">
          <ProfileCard username={username} email={user.email || ''} displayName={profile?.display_name || ''} />
        </div>
      </section>
    </main>
  );
}
