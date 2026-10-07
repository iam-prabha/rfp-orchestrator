# Implementation Plan

This plan turns the product mission and roadmap into a practical build sequence. It describes what must work first, what can wait, and how we will know that each stage is ready.

## Product workflow

The first version follows this path:

1. A user uploads an RFP or questionnaire.
2. The system validates and stores the original file.
3. The ingestion service extracts questions and source content.
4. The retrieval service searches approved company information.
5. The drafting service writes an answer with citations.
6. The review service assigns a confidence signal and routes uncertain answers to a person.
7. The user edits and approves the answers.
8. The system exports the completed document and records the activity.

The four services may be separate modules at first. They do not need to be separate deployable services until scale or ownership requires it.

## Phase 0: Foundation

### Work

- Interview target users and collect representative documents.
- Define the first user stories and acceptance criteria.
- Create the repository structure and local development setup.
- Set up Supabase, database migrations, authentication, and Row Level Security.
- Define tables for workspaces, users, files, documents, questions, source chunks, answers, reviews, and audit events.
- Add CI, formatting, linting, unit-test setup, and environment documentation.
- Decide which model provider and parsing libraries pass a small proof of concept.

### Deliverables

- MVP requirements and test documents.
- Initial architecture and data-model diagrams.
- Working local environment and CI checks.
- A security and privacy checklist for the MVP.

## Phase 1: MVP build

### Ingestion module

**Input:** PDF, DOCX, XLSX, or TXT file.

**Responsibilities:**

- Validate file type, size, and content.
- Store the original file.
- Extract text, basic tables, and metadata.
- Report extraction warnings instead of hiding them.

**Output:** A document record with extracted content, metadata, and processing status.

### Retrieval module

**Input:** Approved documents and extracted source text.

**Responsibilities:**

- Split text into chunks while keeping document and section references.
- Generate embeddings through the provider adapter.
- Store embeddings and searchable metadata in PostgreSQL with `pgvector`.
- Return ranked sources for a question.

**Output:** Relevant source chunks with scores and citations.

### Drafting module

**Input:** A question, its requirements, and retrieved sources.

**Responsibilities:**

- Identify the question type.
- Build a versioned prompt from a small template library.
- Ask the model to answer only from the supplied sources.
- Apply length, format, and tone requirements.
- Return the answer, citations, warnings, model information, and prompt version.

**Output:** A draft answer that can be reviewed and edited.

### Review and orchestration module

**Input:** Draft answer, source chunks, and warnings.

**Responsibilities:**

- Calculate an explainable confidence signal from source relevance, completeness, and validation results.
- Route answers below the configured threshold or marked sensitive to a reviewer.
- Support approve, edit, reject, and request-changes actions.
- Preserve the question order and export the result.
- Publish progress and error states to the web app.

**Output:** A reviewed answer set and an exportable document.

### MVP interface

- Sign in and select a workspace.
- Upload an RFP and see processing progress.
- Review each question, answer, citation, warning, and confidence signal.
- Edit and approve answers.
- Download the completed response.

## Phase 1 verification

Use a small, fixed evaluation set before relying on user feedback. Test:

- File validation and permission boundaries.
- Text extraction for each supported format.
- Retrieval relevance and citation correctness.
- Refusal or warning behavior when the knowledge base lacks an answer.
- Answer length and format constraints.
- Review routing and audit events.
- Export fidelity.
- Retry behavior after model, storage, or database failures.

The phase is complete when an internal user can process a 5–10 page RFP end to end, no critical or high-severity defects remain, and baseline measurements are recorded.

## Phase 2: Quality and integrations

After the MVP is stable:

- Add layout-aware PDF parsing and OCR fallback.
- Add batch uploads and background processing.
- Add keyword-plus-vector search, reranking, freshness weighting, and deduplication.
- Add answer validation, claim checks, dependent questions, and better prompt templates.
- Add comments, answer history, bulk review, and confidence explanations.
- Add SharePoint and Google Drive adapters.
- Add email notifications, usage analytics, retries, and rate limits.
- Add a worker and Redis only when measured processing volume requires them.

Phase 2 is complete when beta users can process 20–50 page RFPs and the planned integrations work reliably in testing.

## Phase 3: Enterprise readiness

- Add SSO, stronger workspace administration, and fine-grained permissions.
- Add PII detection and redaction, retention rules, export, and deletion workflows.
- Add detailed audit reports, backup/restore validation, and disaster recovery runbooks.
- Evaluate large-dataset indexes, caching, model routing, and usage budgets.
- Run load, security, and failure-recovery tests.
- Document service targets, operational procedures, and support responsibilities.

The exact compliance scope must be agreed with legal and security stakeholders. Do not claim certification merely because a feature exists.

## Initial data model

- `workspaces`: tenant or customer boundary.
- `users` and `memberships`: identity, roles, and workspace access.
- `files`: original uploads and storage metadata.
- `documents`: extracted content, type, version, and processing state.
- `knowledge_chunks`: searchable source text, embedding, and provenance.
- `projects`: an RFP or questionnaire response job.
- `questions`: extracted questions and their order and requirements.
- `answers`: generated text, citations, warnings, model data, and status.
- `reviews`: reviewer actions, comments, and timestamps.
- `audit_events`: security and workflow events.

All tenant-owned records must be protected by Row Level Security.

## First implementation sequence

1. Confirm the MVP scope and collect test documents.
2. Set up Supabase locally and create the initial migrations.
3. Implement authentication, workspace membership, and Row Level Security.
4. Build upload and document-status flows.
5. Implement extraction for PDF, DOCX, XLSX, and TXT.
6. Add chunking, embeddings, and retrieval evaluation.
7. Add provider-adapter based drafting with citations.
8. Build review, audit, and export flows.
9. Run the evaluation set and internal user test.
10. Fix the highest-impact quality and security issues before adding integrations.

## Operational measures

Track these from the first working flow:

- Processing time by document size and format.
- Extraction failure and retry rates.
- Retrieval relevance and citation coverage.
- Draft acceptance, edit, rejection, and review rates.
- Model usage and cost per project.
- Export failures and user-reported issues.
- Queue depth and worker health once background processing is introduced.

## Risks and responses

| Risk | Response |
|---|---|
| The model invents an answer | Require source context, cite it, detect unsupported claims, and route uncertain answers to review. |
| A source is old or contradictory | Store dates and versions, show source metadata, and flag conflicts. |
| A document is parsed incorrectly | Keep the original file, show extraction warnings, and add format-specific fallbacks. |
| Sensitive data is exposed | Enforce tenant isolation, least privilege, encryption, audit logs, and retention rules. |
| Provider cost or availability changes | Use an adapter, track usage, set budgets, and evaluate fallback providers. |
| The product does not fit the team’s process | Test with real users early and prioritize review and export quality. |
