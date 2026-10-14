# RFP Orchestrator — Agent Skills Guide

A short, plain-language guide on how AI agents and pipelines are built in this project.

---

## 1. Core Agent Responsibilities

Each agent has one single job:

| Agent | Responsibility |
|---|---|
| **Ingestion Agent** | Reads raw uploaded files (PDF, DOCX, XLSX, TXT) and outputs clean text. |
| **Question Extractor** | Discovers and segments distinct questions and requirements from the text. |
| **Retrieval Agent** | Generates query embeddings and fetches the most relevant knowledge chunks. |
| **Drafting Agent** | Generates an accurate, professional response using retrieved sources. |
| **Orchestrator** | Evaluates answer quality, computes confidence, and routes items to human review. |
| **Export Service** | Compiles questions and approved answers into formatted Word (.docx) or Excel (.xlsx) files. |

---

## 2. Key Engineering Rules

### Rule 1: Keep Agents Pure
Never mix agent business logic with HTTP route handlers, Next.js server actions, or UI React components. Agents live in their own packages (`@repo/ingestion`, `@repo/retrieval`, `@repo/drafting`, `@repo/orchestrator`).

### Rule 2: Swappable AI Providers
Never call external AI vendors directly inside agent code. Use shared provider interfaces (`CompletionProvider`, `EmbeddingProvider`). This allows swapping NVIDIA NIM with OpenAI, Anthropic, or local Ollama without touching agent logic.

### Rule 3: Always Use Retry with Backoff
Remote AI API calls and database embedding lookups can hit rate limits or temporary network issues. Always wrap external calls with the `withRetry` utility:
```ts
const response = await withRetry(
  () => this.provider.complete(prompt, options),
  { attempts: 3, delayMs: 500, backoffMultiplier: 2 }
);
```

### Rule 4: Emit Audit Events
Every critical workflow step (ingestion complete, question extracted, draft generated, review completed) must emit an event using `AgentEventEmitter`. This maintains a full audit log in `agent_events`.

### Rule 5: Explainable Confidence
Never return a black-box confidence percentage. Reviewers must see why a score was assigned:
- **Context Relevance (0-40)**: Average similarity of retrieved knowledge chunks.
- **Source Count (0-20)**: Number and quality of cited references.
- **Answer Length (0-10)**: Appropriateness of response length.
- **Specificity (0-20)**: Concrete metrics, standards, and dates.
- **Linguistic Quality (0-10)**: Sentence structure and professional tone.

### Rule 6: Safe Node Execution
Document extraction tools (like `pdf-parse`, `mammoth`, `xlsx`) must run on the Node.js runtime (`export const runtime = 'nodejs'`). Keep them in `serverComponentsExternalPackages` in `next.config.js` to prevent bundler errors.
