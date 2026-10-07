import Link from 'next/link';
import { ArrowRight, CheckCircle2, FileSearch, FileUp, MessageSquareText, ShieldCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

const steps = [
  { number: '01', title: 'Upload the RFP', description: 'Start with the questionnaire or RFP your team needs to answer.', icon: FileUp },
  { number: '02', title: 'Find what matters', description: 'Surface relevant, approved company information for every question.', icon: FileSearch },
  { number: '03', title: 'Draft with citations', description: 'Create answer drafts that show where each claim came from.', icon: MessageSquareText },
  { number: '04', title: 'Review and export', description: 'Focus on uncertain answers, then export a response ready to send.', icon: CheckCircle2 },
];

const benefits = [
  { title: 'Move faster', description: 'Turn repetitive research and drafting into a focused review process.' },
  { title: 'Free up engineering', description: 'Keep specialists available for the questions that truly need them.' },
  { title: 'Stay traceable', description: 'Give reviewers a clear path from every answer back to its source.' },
  { title: 'Keep people in control', description: 'Flag uncertainty and let your team approve every final response.' },
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f8fafc] text-slate-950">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8" aria-label="Main navigation">
        <Link href="/" className="text-lg font-semibold tracking-tight">RFP Orchestrator</Link>
        <div className="flex items-center gap-3"><Link href="/login" className="hidden text-sm font-medium text-slate-600 transition hover:text-slate-950 sm:block">Sign in</Link><Button asChild size="sm"><Link href="/signup">Join early access</Link></Button></div>
      </nav>

      <section className="relative mx-auto max-w-7xl px-6 pb-24 pt-16 lg:px-8 lg:pb-32 lg:pt-24">
        <div className="absolute -right-32 -top-20 -z-0 h-96 w-96 rounded-full bg-blue-100/70 blur-3xl" />
        <div className="relative z-10 max-w-3xl"><p className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 shadow-sm">Built for proposal, sales engineering, and security teams</p>
          <h1 className="max-w-4xl text-5xl font-semibold leading-[1.05] tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">Answer enterprise RFPs with confidence.</h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">Enterprise questionnaires take days, pull engineers away from their work, and often lead to inconsistent answers. RFP Orchestrator helps your team find approved information, draft cited responses, and review what needs a human eye.</p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row"><Button asChild size="lg" className="gap-2"><Link href="/signup">Join the early access list <ArrowRight className="h-5 w-5" /></Link></Button><Button asChild size="lg" variant="outline"><a href="#how-it-works">See how it works</a></Button></div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white py-20 lg:py-24" aria-labelledby="benefits-heading"><div className="mx-auto max-w-7xl px-6 lg:px-8"><div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-widest text-blue-600">A better response process</p><h2 id="benefits-heading" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Less chasing. More reliable answers.</h2></div><div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">{benefits.map((benefit) => <div key={benefit.title}><ShieldCheck className="h-6 w-6 text-blue-600" aria-hidden="true" /><h3 className="mt-5 text-lg font-semibold">{benefit.title}</h3><p className="mt-2 leading-7 text-slate-600">{benefit.description}</p></div>)}</div></div></section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28" aria-labelledby="workflow-heading"><div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end"><div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-widest text-blue-600">How it works</p><h2 id="workflow-heading" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">From blank questionnaire to reviewed response.</h2></div><p className="max-w-md text-slate-600">One clear workflow for the people who prepare, validate, and approve your customer responses.</p></div><div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">{steps.map((step) => { const Icon = step.icon; return <div key={step.number} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><Icon className="h-6 w-6 text-blue-600" aria-hidden="true" /><span className="text-sm font-semibold text-slate-400">{step.number}</span></div><h3 className="mt-12 text-lg font-semibold">{step.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p></div>; })}</div></section>

      <section className="bg-slate-950 py-20 text-white lg:py-24"><div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-6 lg:flex-row lg:items-center lg:px-8"><div className="max-w-2xl"><Users className="h-7 w-7 text-blue-400" aria-hidden="true" /><h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">Give every response the right level of attention.</h2><p className="mt-4 leading-7 text-slate-300">Designed for proposal managers, sales engineers, security teams, and compliance reviewers working together.</p></div><Button asChild size="lg" variant="secondary" className="shrink-0 gap-2"><Link href="/signup">Join early access <ArrowRight className="h-5 w-5" /></Link></Button></div></section>
      <footer className="mx-auto max-w-7xl px-6 py-8 text-sm text-slate-500 lg:px-8">RFP Orchestrator — thoughtful answers for complex questionnaires.</footer>
    </main>
  );
}
