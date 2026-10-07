import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createServerClient } from '@/lib/supabase';
import { SignOutButton } from '@/components/sign-out-button';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { data: { user } } = await createServerClient().auth.getUser();
  if (!user) redirect('/login');
  return <main className="min-h-screen bg-slate-50"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8"><span className="font-semibold tracking-tight">RFP Orchestrator</span><SignOutButton /></div></header><section className="mx-auto max-w-7xl px-6 py-16 lg:px-8"><p className="text-sm font-medium text-blue-600">Your workspace</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Welcome{user.email ? `, ${user.email}` : ''}.</h1><div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="text-xl font-semibold">Your RFP workspace is coming soon</h2><p className="mx-auto mt-3 max-w-lg text-slate-600">Upload, draft, review, and export workflows will appear here as they become available.</p><Button className="mt-6" disabled>New RFP</Button></div></section></main>;
}
