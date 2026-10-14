import { v4 as uuidv4 } from 'uuid';
import type { Question, QuestionType, ProcessingResult, CompletionProvider } from '@repo/shared';

export interface ExtractedQuestionCandidate {
  id: string;
  text: string;
  section: string;
  order: number;
  type: QuestionType;
}

export class QuestionExtractionAgent {
  constructor(private readonly llmProvider?: CompletionProvider) {}

  /**
   * Hybrid question extraction:
   * 1. Heuristic regex scan to pull candidates
   * 2. If candidates are sparse / ambiguous and LLM provider is available, use LLM classification & refinement
   */
  async extractQuestions(
    text: string,
    rfpId: string
  ): Promise<ProcessingResult<Question[]>> {
    try {
      const candidates = this.extractWithHeuristics(text);

      let finalCandidates: ExtractedQuestionCandidate[] = candidates;

      // If heuristic found very few or ambiguous questions and LLM is configured, enrich/validate with LLM
      if (this.llmProvider && (candidates.length === 0 || candidates.some((c) => c.text.length < 20))) {
        finalCandidates = await this.enrichWithLLM(text, candidates);
      }

      const now = new Date();
      const questions: Question[] = finalCandidates.map((c) => ({
        id: c.id,
        rfpId,
        questionText: c.text,
        section: c.section,
        order: c.order,
        type: c.type,
        metadata: {},
        createdAt: now,
        updatedAt: now,
      }));

      return {
        success: true,
        data: questions,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Question extraction failed',
      };
    }
  }

  /**
   * Fast deterministic heuristic scanner
   */
  extractWithHeuristics(text: string): ExtractedQuestionCandidate[] {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const results: ExtractedQuestionCandidate[] = [];

    let currentSection = 'General';
    let order = 0;

    for (const line of lines) {
      // Check if line looks like a section header
      if (/^#+\s+(.+)$/i.test(line)) {
        currentSection = line.replace(/^#+\s+/, '').trim();
        continue;
      }
      if (/^(Section|Part|Module)\s+[0-9A-Z]+[:.-]?\s*(.+)?$/i.test(line)) {
        currentSection = line;
        continue;
      }
      if (/^[A-Z\s]{4,30}:$/.test(line)) {
        currentSection = line.replace(/:$/, '').trim();
        continue;
      }

      // Check if line looks like a question or requirement prompt
      const isQuestionMark = /\?$/.test(line);
      const isNumberedItem = /^(\d+[\.\)]|[a-zA-Z][\.\)]|\([0-9a-zA-Z]+\))\s+(.{10,})$/.test(line);
      const isRequirementKeyword = /^(Please\s+(describe|provide|detail|explain|confirm)|Describe\s+|Explain\s+|Does\s+your\s+|Can\s+you\s+|How\s+do(es)?\s+|What\s+is\s+|Provide\s+)/i.test(line);

      if ((isQuestionMark || isNumberedItem || isRequirementKeyword) && line.length > 10) {
        order++;
        results.push({
          id: uuidv4(),
          text: line,
          section: currentSection,
          order,
          type: this.classifyType(line),
        });
      }
    }

    return results;
  }

  private classifyType(text: string): QuestionType {
    const lower = text.toLowerCase();
    if (/(security|soc|iso|hipaa|gdpr|encryption|firewall|vulnerability|penetration|audit|compliance|access control)/i.test(lower)) {
      return 'security';
    }
    if (/(pricing|cost|rate|commercial|billing|fee|payment|license|contract length|discount)/i.test(lower)) {
      return 'commercial';
    }
    if (/(sla|indemnity|liability|governing law|terms of service|nda|jurisdiction|warrant(y|ies))/i.test(lower)) {
      return 'legal';
    }
    if (/(api|architecture|sdk|cloud|database|infrastructure|latency|throughput|uptime|stack|integration)/i.test(lower)) {
      return 'technical';
    }
    return 'general';
  }

  private async enrichWithLLM(
    text: string,
    existingCandidates: ExtractedQuestionCandidate[]
  ): Promise<ExtractedQuestionCandidate[]> {
    if (!this.llmProvider) return existingCandidates;

    const sample = text.slice(0, 4000); // Send first 4k chars to stay fast & within budget
    const prompt = `You are an expert RFP analyzer. Extract the list of questions or RFP requirements from this document snippet.
If the document is structured as topics, specifications, definitions, or instructions rather than direct questions, formulate the core requirement questions or inquiries that a respondent or vendor must address.
Return a valid JSON array of objects with keys: "text" (the full question prompt), "section" (the section name, default "General"), "type" ("technical"|"commercial"|"security"|"legal"|"general").
Only return valid JSON array, no extra commentary.

Document:
${sample}
`;

    try {
      const res = await this.llmProvider.complete(prompt, {
        maxTokens: 1000,
        temperature: 0.1,
      });

      const rawText = res.text.trim();
      const firstBracket = rawText.indexOf('[');
      const lastBracket = rawText.lastIndexOf(']');
      let jsonStr = rawText;
      if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        jsonStr = rawText.substring(firstBracket, lastBracket + 1);
      } else {
        jsonStr = rawText.replace(/```(json)?/g, '').trim();
      }

      const parsed = JSON.parse(jsonStr);
      let list: Array<{ text: string; section?: string; type?: QuestionType }> = [];
      if (Array.isArray(parsed)) {
        list = parsed;
      } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).questions)) {
        list = (parsed as any).questions;
      }

      if (list.length > 0) {
        return list.map((item, idx) => ({
          id: uuidv4(),
          text: item.text,
          section: item.section || 'General',
          order: idx + 1,
          type: item.type || this.classifyType(item.text),
        }));
      }
    } catch {
      // Fallback silently to heuristics on LLM JSON parse error
    }

    return existingCandidates;
  }
}
