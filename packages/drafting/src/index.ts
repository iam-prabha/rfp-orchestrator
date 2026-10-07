import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import {
  Answer,
  AnswerSource,
  SearchResult,
  ProcessingResult,
  AgentEvent,
  AgentEventType,
  Database,
  AnswerRow,
} from '@repo/shared';

export interface DraftingConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  nvidiaNimApiKey: string;
  nvidiaNimEndpoint: string;
  nvidiaNimModel: string;
  maxTokens: number;
  temperature: number;
}

export interface DraftingResult {
  answer: Answer;
  confidenceScore: number;
  sources: AnswerSource[];
  processingTimeMs: number;
}

export interface DraftingContext {
  question: string;
  rfpId?: string;
  contextChunks: SearchResult[];
  questionType?: string;
  lengthPreference?: 'concise' | 'standard' | 'detailed';
  tone?: 'formal' | 'technical' | 'persuasive';
}

export interface LLMResponse {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason: string;
}

export class DraftingAgent {
  private supabase: ReturnType<typeof createClient<Database>>;
  private config: DraftingConfig;
  private templateLibrary: Map<string, PromptTemplate> = new Map();

  constructor(config: DraftingConfig) {
    this.config = config;
    this.supabase = createClient<Database>(config.supabaseUrl, config.supabaseServiceKey);
    this.initializeTemplateLibrary();
  }

  /**
   * Generate an answer for a given question
   */
  async generateAnswer(context: DraftingContext): Promise<ProcessingResult<DraftingResult>> {
    const startTime = Date.now();

    try {
      // Assemble context from retrieved chunks
      const assembledContext = this.assembleContext(context.contextChunks);

      // Generate prompt based on question type
      const prompt = this.generatePrompt(context.question, assembledContext, context.questionType, context.lengthPreference);

      // Generate answer using LLM
      const llmResponse = await this.callLLM(prompt, {
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        stopSequences: ['\n\n', 'Human:', 'Assistant:'],
      });

      // Post-process the answer
      const processedAnswer = this.postProcessAnswer(llmResponse.text, context.question);

      // Calculate confidence score
      const confidenceScore = this.calculateConfidenceScore(
        processedAnswer,
        context.contextChunks,
        context.question
      );

      // Prepare sources
      const sources = context.contextChunks.map((chunk) => ({
        documentId: chunk.documentId,
        documentTitle: getMetadataString(chunk.metadata, 'title') || 'Unknown Document',
        chunkId: chunk.chunkId,
        chunkText: chunk.text.substring(0, 500),
        relevanceScore: chunk.similarityScore,
        startOffset: chunk.startOffset,
        endOffset: chunk.endOffset,
      }));

      // Create answer record
      const answer: Omit<Answer, 'id' | 'createdAt' | 'updatedAt'> = {
        rfpId: context.rfpId || '',
        questionId: uuidv4(),
        questionText: context.question,
        generatedAnswer: processedAnswer,
        finalAnswer: null,
        confidenceScore,
        sources,
        status: 'generated',
      };

      // Store draft answer in Supabase
      const { data: storedAnswer, error } = await this.supabase
        .from('answers')
        .insert({
          ...answer,
          rfpId: context.rfpId || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to store answer:', error);
      }

      if (!storedAnswer) {
        throw new Error('Draft answer was not returned after storage.');
      }

      const processingTimeMs = Date.now() - startTime;

      // Emit event
      await this.emitEvent({
        type: 'drafting_complete',
        agentId: 'drafting',
        rfpId: context.rfpId || 'unknown',
        payload: {
          questionId: storedAnswer?.id || 'unknown',
          confidenceScore,
          processingTimeMs,
        },
        timestamp: new Date(),
      });

      return {
        success: true,
        data: {
          answer: this.toAnswer(storedAnswer),
          confidenceScore,
          sources,
          processingTimeMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      console.error('Drafting error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown drafting error',
      };
    }
  }

  /**
   * Assemble context from retrieved chunks
   */
  private assembleContext(chunks: SearchResult[]): string {
    return chunks
      .map((chunk, index) => {
        const sourceInfo = `[Source ${index + 1}: ${getMetadataString(chunk.metadata, 'title') || 'Unknown Document'}]`;
        return `${sourceInfo}\n${chunk.text}\n`;
      })
      .join('\n---\n');
  }

  /**
   * Generate prompt based on question type and context
   */
  private generatePrompt(
    question: string,
    context: string,
    questionType: string = 'technical',
    lengthPreference: string = 'standard'
  ): string {
    const template =
      this.templateLibrary.get(questionType) ?? this.templateLibrary.get('general');
    if (!template) {
      throw new Error('Drafting prompt templates are not initialized.');
    }
    const lengthConstraint = this.getLengthConstraint(lengthPreference);

    return template.render({
      context: context,
      question: question,
      lengthConstraint: lengthConstraint,
    });
  }

  private getLengthConstraint(preference: string): string {
    switch (preference) {
      case 'concise':
        return '1-2 paragraphs, concise and direct';
      case 'detailed':
        return '3-5 paragraphs, comprehensive with examples';
      default:
        return '2-3 paragraphs, balanced detail';
    }
  }

  private initializeTemplateLibrary(): void {
    this.templateLibrary = new Map();

    // Technical questions template
    this.templateLibrary.set('technical', new PromptTemplate(
      `You are a technical expert providing precise, accurate responses to technical RFP questions.
       Context from company knowledge base:
       {context}
       
       Question: {question}
       
       Requirements:
       - Provide a technically accurate response
       - Include specific technologies, methodologies, or standards where relevant
       - Keep response concise but complete ({lengthConstraint})
       - Use formal technical tone
       - If information is incomplete, state what additional details would be needed
       
       Response:`,
      { context: '', question: '', lengthConstraint: '2-3 paragraphs' }
    ));

    this.templateLibrary.set('commercial', new PromptTemplate(
      `You are a commercial expert crafting persuasive business responses.
       Context from company knowledge base:
       {context}
       
       Question: {question}
       
       Requirements:
       - Focus on business value, ROI, and customer benefits
       - Include pricing approaches, warranty, or service details where appropriate
       - Use persuasive, customer-focused tone
       - Keep response to {lengthConstraint}
       
       Response:`,
      { context: '', question: '', lengthConstraint: '1-2 paragraphs' }
    ));

    this.templateLibrary.set('security', new PromptTemplate(
      `You are a security and compliance expert addressing security-related RFP questions.
       Context from company knowledge base (including SOC 2, ISO 27001, etc.):
       {context}
       
       Question: {question}
       
       Requirements:
       - Reference specific controls, certifications, or compliance frameworks
       - Be precise about what is and isn't covered
       - Use formal, assurance-focused tone
       - Include audit report references where available
       - Keep response to {lengthConstraint}
       
       Response:`,
      { context: '', question: '', lengthConstraint: '2-3 paragraphs' }
    ));

    this.templateLibrary.set('legal', new PromptTemplate(
      `You are a legal expert addressing contractual and legal RFP questions.
       Context from company knowledge base:
       {context}
       
       Question: {question}
       
       Requirements:
       - Reference specific contract terms, clauses, or legal requirements
       - Be precise about obligations, limitations, and liabilities
       - Use formal legal tone
       - Note relevant jurisdictional considerations
       - Keep response to {lengthConstraint}
       
       Response:`,
      { context: '', question: '', lengthConstraint: '2-3 paragraphs' }
    ));

    // Default fallback
    this.templateLibrary.set('general', new PromptTemplate(
      `You are an expert assistant helping with RFP responses.
       Context from company knowledge base:
       {context}
       
       Question: {question}
       
       Requirements:
       - Provide accurate, helpful response based on the context
       - Cite sources where possible
       - Keep response to {lengthConstraint}
       - Use professional tone
       
       Response:`,
      { context: '', question: '', lengthConstraint: '2-3 paragraphs' }
    ));
  }

  /**
   * Call LLM API (NVIDIA NIM)
   */
  private async callLLM(
    prompt: string,
    options: {
      temperature: number;
      maxTokens: number;
      stopSequences: string[];
    }
  ): Promise<LLMResponse> {
    const response = await fetch(`${this.config.nvidiaNimEndpoint}/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.nvidiaNimApiKey}`,
      },
      body: JSON.stringify({
        model: this.config.nvidiaNimModel,
        prompt: prompt,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        stop: options.stopSequences,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`NVIDIA NIM LLM failed: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ text: string; finish_reason: string }>;
      usage: LLMResponse['usage'];
      model: string;
    };
    return {
      text: data.choices[0].text,
      usage: data.usage,
      model: data.model,
      finishReason: data.choices[0].finish_reason,
    };
  }

  /**
   * Post-process the generated answer
   */
  private postProcessAnswer(text: string, question: string): string {
    let cleaned = text.trim();

    // Remove common LLM artifacts
    cleaned = cleaned.replace(/^(Assistant:|AI:|Answer:)/i, '').trim();
    cleaned = cleaned.replace(/[\r\n]{3,}/g, '\n\n');
    cleaned = cleaned.replace(/[a-z][A-Z]/g, (match) => match[0] + ' ' + match[1]);

    // Ensure proper ending
    if (!cleaned.match(/[.!?]$/)) {
      cleaned += '.';
    }

    return cleaned;
  }

  /**
   * Calculate confidence score for the answer
   */
  private calculateConfidenceScore(
    answer: string,
    contextChunks: SearchResult[],
    question: string
  ): number {
    let score = 50; // Base score

    // Factor 1: Context quality and relevance
    if (contextChunks.length > 0) {
      const avgRelevance = contextChunks.reduce((sum, c) => sum + c.similarityScore, 0) / contextChunks.length;
      score += Math.round(avgRelevance * 30);
    }

    // Factor 2: Answer length appropriateness
    const wordCount = answer.split(/\s+/).length;
    if (wordCount >= 20 && wordCount <= 300) {
      score += 10;
    } else if (wordCount < 10) {
      score -= 20;
    } else if (wordCount > 500) {
      score -= 10;
    }

    // Factor 3: Presence of specific details
    const detailMatches = answer.match(/\b\d+(\.\d+)?%\b|\b\d+(\.\d+)?\s*(ms|sec|min|hrs?|days?|yrs?)\b|[A-Z]{2,}\d+/g);
    if (detailMatches && detailMatches.length >= 3) {
      score += 10;
    }

    // Factor 4: Linguistic quality
    if (!answer.match(/^(um|uh|well|so)/i)) score += 5;
    if (answer.match(/[.!?]$/)) score += 5;

    // Factor 5: Technical specificity
    if (answer.match(/\b(API|SDK|GUI|CLI|REST|JSON|XML|SSL|TLS|AES|RSA|OAuth|JWT|GDPR|HIPAA|SOC\s*2|ISO\s*27001|PCI\s*DSS)\b/gi)) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  private async emitEvent(event: AgentEvent): Promise<void> {
    const { error } = await this.supabase
      .from('agent_events')
      .insert({ ...event, timestamp: event.timestamp.toISOString() });

    if (error) {
      console.error('Failed to emit event:', error);
    }
  }

  private toAnswer(row: AnswerRow): Answer {
    return {
      ...row,
      rfpId: row.rfpId ?? '',
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      reviewedAt: row.reviewedAt ? new Date(row.reviewedAt) : undefined,
    };
  }
}

function getMetadataString(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  return typeof value === 'string' ? value : undefined;
}

class PromptTemplate {
  constructor(
    private template: string,
    private defaults: Record<string, string>
  ) {}

  render(values: Record<string, string>): string {
    let result = this.template;
    for (const [key, value] of Object.entries({ ...this.defaults, ...values })) {
      const placeholder = `{${key}}`;
      result = result.split(placeholder).join(value);
    }
    return result;
  }
}

export default DraftingAgent;
