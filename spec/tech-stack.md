# Technology Stack

This stack is a starting point. The team should confirm each choice with a small proof of concept before building a large feature around it.

## Product application

- **Web app:** Next.js with the App Router and TypeScript.
- **UI:** Tailwind CSS and accessible component primitives such as Radix UI.
- **Forms and validation:** React Hook Form and Zod.
- **Client state:** Use server-state tools such as TanStack Query when needed. Keep local state simple; add a global store only when the feature needs one.

## Backend and data

- **Backend platform:** Supabase for PostgreSQL, authentication, file storage, realtime updates, and lightweight Edge Functions.
- **Custom services:** TypeScript services for long-running document processing and AI workflows. These should not depend on short Edge Function timeouts.
- **Database:** PostgreSQL. Use `pgvector` for embeddings and SQL for metadata and permissions.
- **Queue and cache:** Redis with BullMQ only when background work or caching requires it. Do not add Redis to the MVP unless the workload needs it.
- **File storage:** Supabase Storage in the first release, behind a storage adapter so another S3-compatible service can be added later.

## AI and document processing

- **Workflow orchestration:** Mastra, if the proof of concept shows that it simplifies agent workflows. Otherwise keep the workflow code in regular TypeScript services.
- **Model provider:** Use an OpenAI-compatible provider interface. NVIDIA NIM is the initial provider to evaluate, but the application must be able to switch providers without changing product logic.
- **Embeddings:** Use a model supported by the selected provider and store the model name and version with every embedding.
- **Document formats:** PDF, DOCX, XLSX, and plain text for the MVP. Add OCR and complex layout handling after the basic pipeline is reliable.
- **Parsing libraries:** Choose and benchmark a maintained library for each format, such as PDF.js or `pdf-parse`, SheetJS for spreadsheets, and Mammoth for DOCX.

## Security

- Use Supabase Auth with JWTs for sign-in and session management.
- Enforce tenant and user permissions with PostgreSQL Row Level Security.
- Start with clear role-based permissions: administrator, proposal user, reviewer, and specialist.
- Validate file type, file size, and file contents before processing.
- Encrypt data in transit and use the encryption provided by the managed database and storage services at rest.
- Keep secrets in the platform’s secret manager or Supabase Vault; never commit them to the repository.
- Record security-relevant actions in an append-only audit log where practical.

Compliance requirements such as GDPR, SOC 2, HIPAA, or ISO 27001 must be confirmed with the organization’s legal and security teams. The product should support those controls, but the technology stack alone does not create compliance.

## Integrations

Build integrations behind small adapters so they can be added or replaced independently.

- **First planned integrations:** Microsoft SharePoint and Google Drive.
- **Knowledge sources:** Confluence and Notion after the core knowledge base works.
- **Notifications:** Email first; Slack and Microsoft Teams later.
- **CRM and proposal tools:** Consider Salesforce, HubSpot, RFPIO, or Qvidian only after users validate the core workflow.

## Operations

- **Local development:** Docker Compose and the Supabase CLI.
- **Deployment:** Supabase for managed backend services, Vercel or an equivalent host for the web app, and a managed container host for long-running workers.
- **CI/CD:** GitHub Actions with database migrations and deployment checks.
- **Logging:** Structured logs using Pino or an equivalent library.
- **Error tracking:** Sentry or an equivalent service.
- **Monitoring:** Track queue depth, processing time, model failures, retrieval quality, review rate, and export failures.

## Testing and quality

- TypeScript strict mode, ESLint, and Prettier.
- Unit tests for parsing, permissions, chunking, retrieval, scoring, and export logic.
- Integration tests for database, storage, model-provider, and queue boundaries.
- Playwright tests for the main upload, review, and export flows.
- Start with meaningful coverage for critical paths; treat 80% as a guide, not a substitute for good tests.

## Design principles

- Keep agent boundaries small and explicit: ingestion, retrieval, drafting, and review/orchestration.
- Make every model call, prompt version, retrieved source, and user edit traceable.
- Prefer simple synchronous workflows for the MVP and add queues when measurements show they are needed.
- Keep the model provider, storage provider, and integration APIs replaceable.
