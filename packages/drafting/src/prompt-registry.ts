export interface VersionedPrompt {
  id: string;
  version: string;
  template: string;
  questionType: string;
  description: string;
  createdAt: string;
}

export class PromptRegistry {
  private prompts: Map<string, VersionedPrompt> = new Map();

  constructor() {
    this.registerDefaults();
  }

  register(prompt: VersionedPrompt): void {
    const key = `${prompt.questionType}@${prompt.version}`;
    this.prompts.set(key, prompt);
    // Also save latest alias
    this.prompts.set(prompt.questionType, prompt);
  }

  get(questionType: string, version?: string): VersionedPrompt | undefined {
    if (version) {
      return this.prompts.get(`${questionType}@${version}`);
    }
    return this.prompts.get(questionType) || this.prompts.get('general');
  }

  render(prompt: VersionedPrompt, vars: Record<string, string>): string {
    let result = prompt.template;
    for (const [k, v] of Object.entries(vars)) {
      result = result.split(`{${k}}`).join(v);
    }
    return result;
  }

  private registerDefaults(): void {
    const defaults: VersionedPrompt[] = [
      {
        id: 'tech-v1',
        version: '1.0.0',
        questionType: 'technical',
        description: 'Technical RFP prompt template with architecture & specs focus',
        createdAt: '2026-10-13T00:00:00Z',
        template: `You are a technical expert providing precise, accurate responses to technical RFP questions.
Context from company knowledge base:
{context}

Question: {question}

Requirements:
- Provide a technically accurate response grounded strictly in the context
- Include specific technologies, methodologies, or standards where relevant
- Keep response concise but complete ({lengthConstraint})
- Use formal technical tone
- If information is incomplete, state clearly what additional details are needed

Response:`,
      },
      {
        id: 'comm-v1',
        version: '1.0.0',
        questionType: 'commercial',
        description: 'Commercial & pricing RFP template with business value focus',
        createdAt: '2026-10-13T00:00:00Z',
        template: `You are a commercial proposal expert crafting business and value-focused responses.
Context from company knowledge base:
{context}

Question: {question}

Requirements:
- Focus on business value, ROI, and customer benefits
- Include pricing approaches, warranty, or service levels where present in context
- Use persuasive, customer-focused professional tone
- Keep response to {lengthConstraint}

Response:`,
      },
      {
        id: 'sec-v1',
        version: '1.0.0',
        questionType: 'security',
        description: 'Security & compliance RFP prompt with SOC2/ISO/audit references',
        createdAt: '2026-10-13T00:00:00Z',
        template: `You are a security and compliance officer answering enterprise security questionnaires.
Context from company knowledge base:
{context}

Question: {question}

Requirements:
- Reference specific controls, certifications (SOC 2, ISO 27001, GDPR, etc.) where covered in context
- Be precise about what is and isn't supported; do not speculate
- Use formal, assurance-focused tone
- Keep response to {lengthConstraint}

Response:`,
      },
      {
        id: 'legal-v1',
        version: '1.0.0',
        questionType: 'legal',
        description: 'Legal & terms RFP prompt with contractual accuracy',
        createdAt: '2026-10-13T00:00:00Z',
        template: `You are a corporate legal specialist addressing contractual RFP terms.
Context from company knowledge base:
{context}

Question: {question}

Requirements:
- Reference specific standard contract terms, obligations, or policies from context
- State limits of liability or warranty clauses directly
- Use formal legal tone
- Keep response to {lengthConstraint}

Response:`,
      },
      {
        id: 'gen-v1',
        version: '1.0.0',
        questionType: 'general',
        description: 'General default RFP prompt template',
        createdAt: '2026-10-13T00:00:00Z',
        template: `You are an expert assistant helping answer enterprise RFP questions.
Context from company knowledge base:
{context}

Question: {question}

Requirements:
- Provide an accurate, helpful response grounded strictly in the provided context
- Keep response to {lengthConstraint}
- Use professional corporate tone

Response:`,
      },
    ];

    for (const p of defaults) {
      this.register(p);
    }
  }
}
