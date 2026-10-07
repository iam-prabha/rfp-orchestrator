# RFP Orchestrator

RFP Orchestrator helps proposal and security teams prepare enterprise RFP and questionnaire responses from approved company information.

## Current phase

The project is in the foundation phase. The immediate goal is to make the repository easy to run, establish the main package boundaries, and validate the first end-to-end workflow with representative documents.

## Project layout

- `apps/web` — Next.js web application.
- `apps/api` — small API service for health checks and future orchestration endpoints.
- `packages/shared` — shared types and utilities.
- `packages/ingestion` — document validation and text extraction.
- `packages/retrieval` — chunking, embeddings, and search.
- `packages/drafting` — answer generation and citations.
- `packages/orchestrator` — review routing and workflow coordination.
- `spec` — product, technology, roadmap, and implementation specifications.

## Local setup

Requirements:

- Node.js 18.17 or newer.
- npm 10 or newer.
- A Supabase project for features that use the database or storage.

Start with:

```bash
npm install
cp .env.example .env.local
npm run build
```

The web app can be started with `npm run dev`. Supabase and Redis are optional until the corresponding workflow is enabled.

Do not put real credentials in `.env.example` or commit local environment files.

## Foundation checklist

- [x] Product and implementation specifications written in plain language.
- [x] Monorepo package boundaries established.
- [x] Shared domain types and utilities available.
- [x] Basic web application scaffold available.
- [x] API health endpoint scaffold available.
- [ ] Add database migrations and Row Level Security policies.
- [ ] Add representative test documents and an evaluation set.
- [ ] Implement the upload and document-status workflow.
