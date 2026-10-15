# RFP Orchestrator — Project Tracker

A concise tracker showing what is built, how the system works, and what comes next.

---

## 1. What the System Does

RFP Orchestrator automates answering Request for Proposal (RFP) documents using multi-agent AI and vector search:
1. **Upload**: User uploads an RFP document (PDF, Word DOCX, Excel XLSX, or plain text).
2. **Process & Extract**: Text is parsed, chunked, and parsed for distinct questions.
3. **Embed & Index**: Document chunks are converted into 2048-dimension vector embeddings and stored in Supabase pgvector.
4. **Search & Retrieve**: Each question searches the company's knowledge chunks using cosine similarity.
5. **Draft Answers**: NVIDIA NIM LLM drafts an answer grounded in the retrieved sources.
6. **Human Review**: Reviewers inspect drafted answers, read confidence score breakdowns, edit text, and approve or reject.
7. **Export**: Final approved answers are downloaded as a formatted Word (.docx) or Excel (.xlsx) file.

---

## 2. Feature & Component Tracker

| Component | Description | Status |
|---|---|---|
| **File Ingestion** | Support PDF, DOCX, XLSX, TXT extraction with legacy buffer polyfill | ✅ DONE |
| **Question Extraction** | Hybrid regex + LLM fallback (NvidiaNim) extracting questions from any document | ✅ DONE |
| **Vector Storage** | Supabase PostgreSQL pgvector configured with 2048-dimension HNSW index | ✅ DONE |
| **Knowledge Retrieval** | Cosine similarity semantic search across processed document chunks | ✅ DONE |
| **Drafting Agent** | On-demand drafting with verified questionId linkage and full paragraph support | ✅ DONE |
| **Confidence Scoring** | Explainable 0-100 score breaking down relevance, citations, and length | ✅ DONE |
| **Review Dashboard** | Web interface for question triage, inline answer editing, and approval | ✅ DONE |
| **Document Export** | Generation of clean Word (.docx) and Excel (.xlsx) answer sheets | ✅ DONE |
| **Authentication & RLS** | Supabase Auth with Row-Level Security ensuring user data privacy | ✅ DONE |
| **Automated Test Suite** | Turborepo Jest tests for Auth, Ingestion, Retrieval, Drafting, and Orchestrator | ✅ DONE |
| **Monorepo Build** | Turborepo pipeline with full Next.js 14 Vercel build compatibility | ✅ DONE |

---

## 3. Current Focus & Next Steps

- [ ] **Batch Drafting**: Option to run drafting for all questions in an RFP with one click.
- [ ] **Knowledge Base Management**: Dedicated UI to upload company reference documents and case studies directly.
- [ ] **Prompt Customization**: Allow users to adjust answer tone and length preferences in the dashboard.
- [ ] **Automated End-to-End Tests**: Playwright browser flows for complete upload-to-export user journeys.
