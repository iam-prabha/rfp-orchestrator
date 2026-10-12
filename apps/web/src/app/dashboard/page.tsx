import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createServerClient } from '@/lib/supabase';
import { NavbarProfile } from '@/components/navbar-profile';
import { RetryProcessingButton } from '@/components/retry-processing-button';

export const dynamic = 'force-dynamic';

type DashboardRfp = {
  id: string;
  title: string;
  status: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
  extractionError?: string | null;
  chunkingError?: string | null;
  embeddingError?: string | null;
  chunkCount?: number | null;
};

export default async function DashboardPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: profile }, rfpQuery] = await Promise.all([
    supabase.from('profiles').select('username, display_name').eq('id', user.id).maybeSingle(),
    supabase.from('rfps').select('id, title, status, fileName, fileSize, createdAt, extractionError, chunkingError, embeddingError, chunkCount').eq('userId', user.id).order('createdAt', { ascending: false }),
  ]);
  // Keep previously uploaded documents visible while an environment is being
  // migrated to the chunking columns.
  const { data: fallbackRfps } = rfpQuery.error
    ? await supabase.from('rfps').select('id, title, status, fileName, fileSize, createdAt, extractionError').eq('userId', user.id).order('createdAt', { ascending: false })
    : { data: null };
  const rfps = (rfpQuery.data || fallbackRfps) as DashboardRfp[] | null;
  const username = profile?.username || user.email?.split('@')[0] || 'user';

  return <main className="min-h-screen bg-slate-50"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8"><span className="font-semibold tracking-tight">RFP Orchestrator</span><NavbarProfile username={username} displayName={profile?.display_name} email={user.email || ''} /></div></header><section className="mx-auto max-w-7xl px-6 py-16 lg:px-8"><div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-blue-600">Your workspace</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Welcome, @{username}.</h1><p className="mt-3 text-slate-600">Keep your customer responses moving from upload to review.</p></div><Button asChild><Link href="/dashboard/rfp/new">New RFP</Link></Button></div><section className="mt-12" aria-labelledby="rfps-heading"><h2 id="rfps-heading" className="text-xl font-semibold">Your RFPs</h2>{rfps && rfps.length > 0 ? <div className="mt-5 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">{rfps.map((rfp) => <div key={rfp.id} className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium text-slate-900">{rfp.title}</p><p className="mt-1 text-sm text-slate-500">{formatFileSize(rfp.fileSize)} · {formatDate(rfp.createdAt)}</p>{rfp.status === 'ready' && <p className="mt-1 text-sm text-emerald-700">Ready for retrieval{typeof rfp.chunkCount === 'number' ? ` · ${rfp.chunkCount} chunks` : ''}.</p>}{rfp.status === 'failed' && <><p className="mt-1 text-sm text-red-600">{rfp.extractionError || rfp.chunkingError || rfp.embeddingError || 'Processing failed.'}</p><div className="mt-3"><RetryProcessingButton rfpId={rfp.id} /></div></>}</div><span className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass(rfp.status)}`}>{statusLabel(rfp.status)}</span></div>)}</div> : <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><h3 className="text-xl font-semibold">No RFPs yet</h3><p className="mx-auto mt-3 max-w-lg text-slate-600">Upload your first questionnaire to create a response workspace.</p><Button asChild className="mt-6"><Link href="/dashboard/rfp/new">Upload an RFP</Link></Button></div>}</section></section></main>;
}

function statusLabel(status: string) {
  return ({ uploaded: 'Uploaded', processing: 'Processing', processed: 'Processing', ready: 'Ready for retrieval', failed: 'Failed' } as Record<string, string>)[status] || status;
}

function statusBadgeClass(status: string) {
  if (status === 'failed') return 'bg-red-50 text-red-700';
  if (status === 'ready') return 'bg-emerald-50 text-emerald-700';
  return 'bg-blue-50 text-blue-700';
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value));
}
