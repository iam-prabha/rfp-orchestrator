# Product Roadmap

The roadmap is ordered around proving the core workflow first. Later work should be pulled forward only when user feedback or measured usage justifies it.

## Phase 0: Learn and prepare

**Goal:** Confirm the problem and agree on a small, testable first release.

- Interview at least five proposal, sales, security, or engineering users.
- Collect representative RFPs and questionnaires, with permission to use them.
- Define the document, question, answer, source, review, and audit data models.
- Confirm the initial model provider, storage approach, and security requirements.
- Set up the repository, local development environment, migrations, tests, and CI.
- Write the first user stories and acceptance criteria.

**Exit criteria:** The team has representative test documents, an agreed MVP scope, and a working development environment.

## Phase 1: MVP

**Goal:** Process a simple RFP from upload to reviewed export.

### Ingestion

- Upload PDF, DOCX, XLSX, and TXT files.
- Validate file type, size, and basic safety checks.
- Extract text, tables where practical, and basic metadata.
- Store the original file and the extracted representation.

### Retrieval

- Split source documents into searchable chunks.
- Generate and store embeddings.
- Search by meaning and filter by document type, date, or tags.
- Return the source text and metadata used for each result.

### Drafting

- Classify common question types such as technical, commercial, and security.
- Generate an answer only from the supplied context.
- Show citations and flag missing or conflicting information.
- Support basic length and tone requirements.

### Review and export

- Calculate a simple, explainable confidence signal.
- Route low-confidence or sensitive answers to a reviewer.
- Allow reviewers to edit, approve, reject, or request changes.
- Preserve the source question order and export to DOCX, XLSX, or PDF where practical.

### Shared MVP features

- Authentication and role-based access.
- Workspace-level data isolation.
- Audit logging.
- Progress, error, and retry states.
- A small web interface for upload, progress, review, and download.

**Exit criteria:** An internal user can process a 5–10 page RFP end to end. The system provides useful citations, does not silently invent unsupported answers, and the team has baseline measurements for processing time, edit rate, and review rate.

## Phase 2: Improve quality and collaboration

**Goal:** Make the workflow reliable for larger documents and small beta groups.

- Handle tables, multi-column PDFs, and OCR when needed.
- Add batch processing and resumable uploads.
- Add hybrid keyword and semantic search, reranking, and document freshness rules.
- Improve prompts, answer validation, claim checking, and question dependencies.
- Add comments, version history, bulk review, and clearer confidence explanations.
- Add SharePoint and Google Drive integrations.
- Add email notifications and an analytics view.
- Add rate limits, retries, caching, and background workers based on measured load.

**Exit criteria:** Beta users can process 20–50 page RFPs, the two planned document integrations work reliably, and a security review has no critical findings.

## Phase 3: Enterprise readiness

**Goal:** Support larger customers and stronger operational requirements.

- Add tenant administration, SSO where required, detailed permissions, and data-retention controls.
- Add PII detection, redaction, data export, and deletion workflows.
- Add stronger audit reporting, backup and restore tests, and disaster recovery procedures.
- Improve retrieval for large knowledge bases with indexing, caching, and evaluation datasets.
- Add provider/model routing and usage reporting to control cost.
- Add load testing, service-level targets, and operational runbooks.
- Map implemented controls to the customer’s required compliance frameworks.

**Exit criteria:** The service meets documented security, performance, recovery, and support requirements for the intended enterprise launch.

## Phase 4: Expansion

Only after the core product is useful and measurable, consider:

- Specialized security questionnaire packs for SOC 2, ISO 27001, or HIPAA.
- Confluence, Notion, CRM, proposal-management, and project-management integrations.
- Multilingual support and industry-specific templates.
- Executive summaries, presentations, and other related deliverables.
- A public API, plugin ecosystem, or self-hosted deployment.

## Release gates

### Internal alpha

- Core pipeline works on approved test documents.
- Human review is required for uncertain answers.
- No critical security defects are open.
- The team can measure quality and time savings.

### Private beta

- Several users can complete real test workflows without engineering help.
- Sources, edits, approvals, and exports are traceable.
- Core integrations and notifications are reliable.
- Security testing has no critical findings.

### General availability

- Documented service, security, backup, and support targets are met.
- Customer-facing documentation and onboarding are ready.
- The team has a process for correcting knowledge-base content and model behavior.

## Main risks

- **Incorrect answers:** Use source citations, explicit uncertainty, review routing, and evaluation sets.
- **Sensitive data exposure:** Use tenant isolation, least-privilege access, encryption, audit logs, and retention rules.
- **Poor document extraction:** Keep the original file, expose extraction issues, and add format-specific fallbacks.
- **Model cost or outages:** Track usage and keep the provider interface replaceable.
- **Low adoption:** Test with real users early and fit the product into their existing review process.
