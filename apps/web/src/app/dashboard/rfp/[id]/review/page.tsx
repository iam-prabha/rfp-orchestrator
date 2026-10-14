'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Edit3,
  RefreshCw,
  Check,
  X,
  FileSpreadsheet,
  FileText,
  Loader2,
  Search,
  Filter,
  BookOpen,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { createClient } from '@/lib/supabase';

interface QuestionWithAnswer {
  id: string;
  rfp_id: string;
  question_text: string;
  section: string;
  question_order: number;
  question_type: string;
  answer?: {
    id: string;
    generatedAnswer: string;
    finalAnswer?: string | null;
    confidenceScore: number;
    status: 'generated' | 'reviewing' | 'approved' | 'rejected';
    sources?: Array<{ documentTitle: string; chunkText: string }>;
  } | null;
}

export default function RfpReviewPage({ params }: { params: { id: string } }) {
  const [rfpTitle, setRfpTitle] = useState<string>('RFP Document');
  const [questions, setQuestions] = useState<QuestionWithAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unanswered' | 'reviewing' | 'approved' | 'rejected'>('all');
  const [selectedSection, setSelectedSection] = useState<string>('all');

  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.getSession();
      if (error && (error.message?.includes('Refresh Token') || error.message?.includes('refresh_token'))) {
        try {
          await supabase.auth.signOut();
        } catch {
          // ignore
        }
        return {};
      }
      const token = data?.session?.access_token;
      if (token) return { Authorization: `Bearer ${token}` };
    } catch {
      // fallback
    }
    return {};
  }, []);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();

      // Fetch RFP metadata for page title
      const supabase = createClient();
      const { data: rfpData } = await supabase
        .from('rfps')
        .select('title')
        .eq('id', params.id)
        .maybeSingle();
      if (rfpData?.title) {
        setRfpTitle(rfpData.title);
      }

      const res = await fetch(`/api/rfps/${params.id}/questions`, { headers });
      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        throw new Error(payload.error || 'Failed to load questions');
      }
      const data = (await res.json()) as { questions: QuestionWithAnswer[] };
      setQuestions(data.questions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching questions');
    } finally {
      setLoading(false);
    }
  }, [params.id, getAuthHeaders]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  async function handleGenerate(qid: string) {
    setGeneratingId(qid);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/rfps/${params.id}/questions/${qid}/draft`, {
        method: 'POST',
        headers,
      });
      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        throw new Error(payload.error || 'Draft generation failed');
      }
      await loadQuestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error generating draft');
    } finally {
      setGeneratingId(null);
    }
  }

  async function handleGenerateAllMissing() {
    const unanswered = questions.filter((q) => !q.answer);
    if (unanswered.length === 0) return;

    setBatchGenerating(true);
    setBatchProgress({ current: 0, total: unanswered.length });
    setError(null);

    const headers = await getAuthHeaders();
    for (let i = 0; i < unanswered.length; i++) {
      const q = unanswered[i];
      setBatchProgress({ current: i + 1, total: unanswered.length });
      setGeneratingId(q.id);
      try {
        await fetch(`/api/rfps/${params.id}/questions/${q.id}/draft`, {
          method: 'POST',
          headers,
        });
      } catch (err) {
        console.error(`Failed to generate draft for question ${q.id}:`, err);
      }
    }

    setGeneratingId(null);
    setBatchGenerating(false);
    await loadQuestions();
  }

  async function handleReviewAction(
    answerId: string,
    status: 'approved' | 'rejected' | 'reviewing',
    finalAnswer?: string
  ) {
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`/api/answers/${answerId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ status, finalAnswer }),
      });
      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        throw new Error(payload.error || 'Review action failed');
      }
      setEditingId(null);
      await loadQuestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error submitting review');
    }
  }

  function handleExport(format: 'docx' | 'xlsx') {
    window.open(`/api/rfps/${params.id}/export?format=${format}`, '_blank');
  }

  function toggleSources(questionId: string) {
    setExpandedSources((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  }

  // Statistics
  const stats = useMemo(() => {
    const total = questions.length;
    const answered = questions.filter((q) => !!q.answer).length;
    const approved = questions.filter((q) => q.answer?.status === 'approved').length;
    const rejected = questions.filter((q) => q.answer?.status === 'rejected').length;
    const reviewing = questions.filter(
      (q) => q.answer && (q.answer.status === 'reviewing' || q.answer.status === 'generated')
    ).length;
    const unanswered = total - answered;
    const completionPercent = total > 0 ? Math.round((answered / total) * 100) : 0;
    const approvedPercent = total > 0 ? Math.round((approved / total) * 100) : 0;

    return { total, answered, approved, rejected, reviewing, unanswered, completionPercent, approvedPercent };
  }, [questions]);

  // Unique sections
  const sections = useMemo(() => {
    const set = new Set<string>();
    questions.forEach((q) => {
      if (q.section) set.add(q.section);
    });
    return Array.from(set);
  }, [questions]);

  // Filtered questions
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesQuestion = q.question_text.toLowerCase().includes(query);
        const matchesAnswer =
          (q.answer?.finalAnswer || q.answer?.generatedAnswer || '').toLowerCase().includes(query);
        const matchesSection = q.section.toLowerCase().includes(query);
        if (!matchesQuestion && !matchesAnswer && !matchesSection) return false;
      }

      // Section filter
      if (selectedSection !== 'all' && q.section !== selectedSection) {
        return false;
      }

      // Status filter
      if (statusFilter === 'unanswered') return !q.answer;
      if (statusFilter === 'approved') return q.answer?.status === 'approved';
      if (statusFilter === 'rejected') return q.answer?.status === 'rejected';
      if (statusFilter === 'reviewing') {
        return q.answer && (q.answer.status === 'reviewing' || q.answer.status === 'generated');
      }

      return true;
    });
  }, [questions, searchQuery, statusFilter, selectedSection]);

  return (
    <main className="min-h-screen bg-slate-50/70 pb-20">
      {/* Top Sticky Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
              title="Back to workspace"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                  RFP Proposal Review
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-500 font-medium truncate max-w-xs sm:max-w-md">
                  {rfpTitle}
                </span>
              </div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 truncate max-w-md sm:max-w-xl">
                Questionnaire Answers & Grounding
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('xlsx')}
              className="h-9 gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span className="hidden sm:inline">Export</span> XLSX
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('docx')}
              className="h-9 gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
            >
              <FileText className="h-4 w-4 text-blue-600" />
              <span className="hidden sm:inline">Export</span> DOCX
            </Button>
            {stats.unanswered > 0 && (
              <Button
                size="sm"
                onClick={handleGenerateAllMissing}
                disabled={batchGenerating}
                className="h-9 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              >
                {batchGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>
                      Generating ({batchProgress.current}/{batchProgress.total})
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span className="hidden sm:inline">Draft All</span> ({stats.unanswered})
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 pt-8">
        {/* Error Alert */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-800 shadow-sm">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
            <div className="flex-1 font-medium">{error}</div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800 text-xs font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Overview Stats Bar */}
        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
            <div className="rounded-xl bg-slate-50/70 p-4 border border-slate-100">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Questions</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{stats.total}</p>
              <p className="mt-1 text-xs text-slate-500">{sections.length} sections identified</p>
            </div>

            <div className="rounded-xl bg-blue-50/50 p-4 border border-blue-100/80">
              <p className="text-xs font-medium text-blue-700 uppercase tracking-wider">AI Drafted</p>
              <p className="mt-1 text-2xl font-bold text-blue-900">{stats.answered}</p>
              <p className="mt-1 text-xs text-blue-600">{stats.completionPercent}% completion rate</p>
            </div>

            <div className="rounded-xl bg-emerald-50/50 p-4 border border-emerald-100/80">
              <p className="text-xs font-medium text-emerald-700 uppercase tracking-wider">Approved</p>
              <p className="mt-1 text-2xl font-bold text-emerald-900">{stats.approved}</p>
              <p className="mt-1 text-xs text-emerald-600">{stats.approvedPercent}% of all questions</p>
            </div>

            <div className="rounded-xl bg-amber-50/50 p-4 border border-amber-100/80">
              <p className="text-xs font-medium text-amber-700 uppercase tracking-wider">Pending Review</p>
              <p className="mt-1 text-2xl font-bold text-amber-900">{stats.reviewing}</p>
              <p className="mt-1 text-xs text-amber-600">{stats.unanswered} awaiting generation</p>
            </div>
          </div>

          {/* Progress Indicator */}
          {stats.total > 0 && (
            <div className="mt-6 pt-5 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs font-medium text-slate-600 mb-2">
                <span>Overall Proposal Readiness</span>
                <span>
                  {stats.approved} approved • {stats.reviewing} in review • {stats.unanswered} missing
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 flex">
                <div
                  className="bg-emerald-500 transition-all duration-500"
                  style={{ width: `${(stats.approved / stats.total) * 100}%` }}
                  title={`${stats.approved} approved`}
                />
                <div
                  className="bg-amber-400 transition-all duration-500"
                  style={{ width: `${(stats.reviewing / stats.total) * 100}%` }}
                  title={`${stats.reviewing} in review`}
                />
                <div
                  className="bg-red-400 transition-all duration-500"
                  style={{ width: `${(stats.rejected / stats.total) * 100}%` }}
                  title={`${stats.rejected} rejected`}
                />
              </div>
            </div>
          )}
        </section>

        {/* Filter and Search Toolbar */}
        <section className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by question, answer, or section..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none ring-blue-500 placeholder:text-slate-400 focus:ring-2"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {sections.length > 1 && (
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none ring-blue-500 focus:ring-2"
              >
                <option value="all">All Sections ({sections.length})</option>
                {sections.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}

            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 text-xs font-medium">
              <button
                onClick={() => setStatusFilter('all')}
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                All ({stats.total})
              </button>
              <button
                onClick={() => setStatusFilter('unanswered')}
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  statusFilter === 'unanswered'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Unanswered ({stats.unanswered})
              </button>
              <button
                onClick={() => setStatusFilter('reviewing')}
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  statusFilter === 'reviewing'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Review ({stats.reviewing})
              </button>
              <button
                onClick={() => setStatusFilter('approved')}
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  statusFilter === 'approved'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Approved ({stats.approved})
              </button>
            </div>
          </div>
        </section>

        {/* Content Area */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="mt-4 text-sm font-medium text-slate-600">Loading questionnaire answers...</p>
          </div>
        ) : questions.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-slate-300 p-12 text-center bg-white shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <BookOpen className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900">No Questions Detected</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              No distinct questions were found for this document. If this is a reference document (like a glossary
              or cheat sheet), you can explore it in Document Retrieval.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button asChild variant="outline">
                <Link href="/dashboard">Back to Dashboard</Link>
              </Button>
            </div>
          </Card>
        ) : filteredQuestions.length === 0 ? (
          <Card className="rounded-2xl border border-slate-200 p-12 text-center bg-white shadow-sm">
            <p className="text-sm font-medium text-slate-600">No questions match your current filters.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setSelectedSection('all');
              }}
              className="mt-4"
            >
              Reset Filters
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredQuestions.map((q) => {
              const a = q.answer;
              const isGenerating = generatingId === q.id;
              const hasSources = a?.sources && a.sources.length > 0;
              const sourcesOpen = expandedSources[q.id];

              // Confidence badge styling
              const confidence = a?.confidenceScore ?? 0;
              let confidenceBadge = {
                label: 'High Confidence',
                color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
              };
              if (confidence < 60) {
                confidenceBadge = {
                  label: 'Low Confidence',
                  color: 'bg-rose-50 text-rose-700 border-rose-200',
                };
              } else if (confidence < 80) {
                confidenceBadge = {
                  label: 'Moderate Confidence',
                  color: 'bg-amber-50 text-amber-700 border-amber-200',
                };
              }

              return (
                <article
                  key={q.id}
                  className="group rounded-2xl border border-slate-200/90 bg-white shadow-sm transition-all hover:border-slate-300 hover:shadow-md overflow-hidden"
                >
                  {/* Card Header / Question Block */}
                  <div className="border-b border-slate-100 bg-white p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-xs font-bold text-blue-700">
                          Q{q.question_order}
                        </span>
                        <Badge variant="secondary" className="text-[11px] font-medium bg-slate-100 text-slate-700">
                          {q.section || 'General'}
                        </Badge>
                        <Badge variant="outline" className="text-[11px] font-normal text-slate-500 border-slate-200">
                          {q.question_type}
                        </Badge>
                      </div>

                      {/* Status Badges */}
                      <div className="flex items-center gap-2">
                        {a ? (
                          <>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${confidenceBadge.color}`}
                            >
                              {confidence}% • {confidenceBadge.label}
                            </span>

                            {a.status === 'approved' ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/80 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Approved
                              </span>
                            ) : a.status === 'rejected' ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100/80 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
                                <XCircle className="h-3.5 w-3.5 text-rose-600" /> Rejected
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/80 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                                <AlertCircle className="h-3.5 w-3.5 text-amber-600" /> Needs Review
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                            <Clock className="h-3.5 w-3.5 text-slate-400" /> Unanswered
                          </span>
                        )}
                      </div>
                    </div>

                    <h2 className="mt-3 text-base font-semibold leading-snug text-slate-900">
                      {q.question_text}
                    </h2>
                  </div>

                  {/* Card Body / Answer Block */}
                  <div className="p-6 bg-slate-50/40">
                    {!a ? (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-dashed border-slate-300/80 bg-white p-5">
                        <div className="flex items-center gap-3 text-slate-500">
                          <Clock className="h-5 w-5 text-slate-400 shrink-0" />
                          <p className="text-sm">No response has been drafted for this question yet.</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleGenerate(q.id)}
                          disabled={isGenerating || batchGenerating}
                          className="bg-blue-600 hover:bg-blue-700 text-white shrink-0 shadow-sm"
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Generating…
                            </>
                          ) : (
                            <>
                              <Sparkles className="mr-2 h-4 w-4" />
                              Generate AI Answer
                            </>
                          )}
                        </Button>
                      </div>
                    ) : editingId === a.id ? (
                      <div className="space-y-3 rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                            Edit Proposal Answer
                          </label>
                          <span className="text-xs text-slate-400">{editText.length} characters</span>
                        </div>
                        <textarea
                          className="w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-900 leading-relaxed outline-none ring-blue-500 focus:border-blue-500 focus:ring-2 font-normal"
                          rows={5}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          placeholder="Type or revise the answer..."
                        />
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingId(null)}
                            className="h-8"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReviewAction(a.id, 'reviewing', editText)}
                            className="h-8"
                          >
                            Save Draft
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleReviewAction(a.id, 'approved', editText)}
                            className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <Check className="mr-1 h-3.5 w-3.5" />
                            Save & Approve
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Displayed Answer */}
                        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
                          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                              <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                              Proposed Response
                            </span>
                            {a.finalAnswer && (
                              <Badge variant="outline" className="text-[10px] text-blue-700 bg-blue-50 border-blue-200">
                                Human Revised
                              </Badge>
                            )}
                          </div>
                          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-800">
                            {a.finalAnswer || a.generatedAnswer}
                          </p>
                        </div>

                        {/* Grounding Sources Collapsible */}
                        {hasSources && (
                          <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden text-xs">
                            <button
                              type="button"
                              onClick={() => toggleSources(q.id)}
                              className="flex w-full items-center justify-between px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                              <span className="flex items-center gap-2">
                                <BookOpen className="h-3.5 w-3.5 text-slate-500" />
                                Grounded in {a.sources!.length} reference section
                                {a.sources!.length > 1 ? 's' : ''}
                              </span>
                              {sourcesOpen ? (
                                <ChevronUp className="h-4 w-4 text-slate-400" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-slate-400" />
                              )}
                            </button>

                            {sourcesOpen && (
                              <div className="border-t border-slate-100 divide-y divide-slate-100 bg-slate-50/50 p-3 space-y-2">
                                {a.sources!.map((s, idx) => (
                                  <div key={idx} className="rounded-lg bg-white p-2.5 border border-slate-200/60">
                                    <div className="font-semibold text-slate-800 flex items-center gap-1.5 mb-1">
                                      <FileText className="h-3 w-3 text-blue-500" />
                                      {s.documentTitle}
                                    </div>
                                    <p className="text-slate-600 line-clamp-3 leading-relaxed">{s.chunkText}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Action Buttons Row */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                          <div className="flex items-center gap-2">
                            {a.status !== 'approved' && (
                              <Button
                                size="sm"
                                onClick={() => handleReviewAction(a.id, 'approved')}
                                className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                              >
                                <Check className="h-3.5 w-3.5" /> Approve
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingId(a.id);
                                setEditText(a.finalAnswer || a.generatedAnswer);
                              }}
                              className="h-8 gap-1.5 hover:bg-slate-100"
                            >
                              <Edit3 className="h-3.5 w-3.5 text-slate-500" /> Edit
                            </Button>

                            {a.status !== 'rejected' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReviewAction(a.id, 'rejected')}
                                className="h-8 gap-1.5 text-rose-600 border-rose-200 hover:bg-rose-50"
                              >
                                <X className="h-3.5 w-3.5" /> Reject
                              </Button>
                            )}
                          </div>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleGenerate(q.id)}
                            disabled={isGenerating || batchGenerating}
                            className="h-8 gap-1.5 text-xs text-slate-500 hover:text-slate-900"
                          >
                            {isGenerating ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                            {isGenerating ? 'Regenerating…' : 'Regenerate Draft'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
