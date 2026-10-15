# RFP Orchestrator

AI-powered multi-agent system that automates responding to enterprise Request for Proposals (RFPs) and security questionnaires using vector search and NVIDIA NIM LLMs.

---

## Workflow Pipeline

1. **Upload & Ingest**: Accepts PDF, DOCX, XLSX, and TXT files.
2. **Extract & Chunk**: Extracts text, segments document chunks, and discovers RFP questions (hybrid regex + LLM).
3. **Embed & Index**: Generates 2048-dim embeddings (`nvidia/nemotron-3-embed-1b`) stored in Supabase `pgvector`.
4. **Retrieve**: Performs cosine-similarity semantic search across approved knowledge chunks.
5. **Draft Answers**: Generates grounded responses with source citations using NVIDIA NIM LLMs.
6. **Human Review**: Interactive triage with explainable confidence scores (0–100), inline edits, and approval states.
7. **Export**: Generates clean, ready-to-send Word (`.docx`) and Excel (`.xlsx`) response documents.

---

## Project Structure

```
├── apps/
│   └── web/            # Next.js 14 App Router, UI, and API routes
├── packages/
│   ├── drafting/       # LLM response generation and prompt registry
│   ├── ingestion/      # Multi-format document text & question extraction
│   ├── orchestrator/   # Review policies, confidence scoring & export service
│   ├── retrieval/      # Semantic chunking, embeddings & pgvector search
│   └── shared/         # Common TypeScript types, AI providers & retry utils
└── spec/               # Plain-language project tracker and agent skills guide
```

---

## Quick Start

### 1. Prerequisites
- Node.js `20.x` or `24.x`
- npm `10.x`
- Supabase project (with PostgreSQL `pgvector`)
- NVIDIA NIM API Key

### 2. Setup

```bash
# Clone and install dependencies
npm install

# Configure environment
cp .env.example apps/web/.env.local
```

Fill in the essential variables in `apps/web/.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
NVIDIA_NIM_API_KEY=your-nvidia-nim-api-key
NVIDIA_NIM_ENDPOINT=https://integrate.api.nvidia.com/v1
NVIDIA_EMBEDDING_MODEL=nvidia/nemotron-3-embed-1b
NVIDIA_LLM_MODEL=meta/llama-3.2-11b-vision-instruct
```

### 3. Run

```bash
# Start development server
npm run dev

# Run automated unit/integration test suite
npm test

# Run end-to-end browser tests (Playwright)
npm run test:e2e

# Run Playwright in interactive visual UI mode
npm run test:e2e:ui

# Build all monorepo packages and web app
npm run build
```

The web application runs locally at `http://localhost:3000`.
