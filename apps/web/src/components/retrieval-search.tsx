'use client';

import { FormEvent, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase';

type SearchDocument = { id: string; title: string };
type SearchResult = { id: string; documentId: string; text: string; startOffset: number; endOffset: number; similarityScore: number };

function getMatchBadge(score: number) {
  if (score >= 0.35) return { label: 'High match', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (score >= 0.22) return { label: 'Good match', className: 'bg-blue-50 text-blue-700 border-blue-200' };
  return { label: 'Relevant', className: 'bg-slate-100 text-slate-700 border-slate-200' };
}

export function RetrievalSearch({ documents }: { documents: SearchDocument[] }) {
  const [query, setQuery] = useState('');
  const [selectedRfpId, setSelectedRfpId] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);


  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setError('Enter a question or phrase to search.');
      setResults([]);
      setSearched(false);
      return;
    }
    setIsSearching(true);
    setError(null);
    setSearched(true);
    try {
      const { data } = await createClient().auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error('Your session expired. Sign in again to search.');
      const response = await fetch('/api/retrieval/search', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmedQuery, rfpId: selectedRfpId || undefined }),
      });
      const payload = await response.json() as { results?: SearchResult[]; notice?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Search failed.');
      setNotice(payload.notice || null);
      setResults(payload.results || []);
    } catch (searchError) {
      setResults([]);
      setNotice(null);
      setError(searchError instanceof Error ? searchError.message : 'Search failed.');
    } finally {
      setIsSearching(false);
    }
  }

  function clearSearch() {
    setQuery('');
    setResults([]);
    setError(null);
    setNotice(null);
    setSearched(false);
  }

  return <section className="mt-10" aria-labelledby="retrieval-heading">
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-blue-600">Document retrieval</p><h2 id="retrieval-heading" className="mt-1 text-xl font-semibold text-slate-900">Search your RFPs</h2><p className="mt-2 text-sm text-slate-600">Ask a question to find the most relevant sections in your ready documents.</p></div>{searched && <Button type="button" variant="ghost" size="sm" onClick={clearSearch} aria-label="Clear search"><X className="mr-1 h-4 w-4" /> Clear</Button>}</div>
      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3 sm:flex-row"><label htmlFor="retrieval-query" className="sr-only">Search query</label><div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input id="retrieval-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. What are the security requirements?" className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none ring-blue-500 focus:ring-2" disabled={isSearching} /></div><label htmlFor="retrieval-rfp" className="sr-only">Limit search to an RFP</label><select id="retrieval-rfp" value={selectedRfpId} onChange={(event) => setSelectedRfpId(event.target.value)} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none ring-blue-500 focus:ring-2" disabled={isSearching}><option value="">All ready RFPs</option>{documents.map((document) => <option key={document.id} value={document.id}>{document.title}</option>)}</select><Button type="submit" disabled={isSearching}>{isSearching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isSearching ? 'Searching…' : 'Search'}</Button></form>
      {error && <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">{notice}</p>}
      {searched && !isSearching && !error && !notice && results.length === 0 && <p className="mt-5 rounded-md bg-slate-50 px-3 py-3 text-sm text-slate-600">No matching sections were found. Try a broader search term.</p>}

      {results.length > 0 && <div className="mt-6 space-y-3" aria-live="polite"><p className="text-sm font-medium text-slate-700">{results.length} matching {results.length === 1 ? 'section' : 'sections'}</p>{results.map((result) => {
        const badge = getMatchBadge(result.similarityScore);
        return <article key={result.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium text-slate-900">{documents.find((document) => document.id === result.documentId)?.title || 'RFP document'}</p><div className="flex items-center gap-2"><span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span><span className="text-xs text-slate-500">{Math.round(result.similarityScore * 100)}% · characters {result.startOffset}–{result.endOffset}</span></div></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{result.text}</p></article>;
      })}</div>}
    </div>
  </section>;
}
