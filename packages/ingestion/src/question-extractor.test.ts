import { QuestionExtractionAgent } from './question-extractor';
import type { CompletionProvider } from '@repo/shared';

describe('QuestionExtractionAgent', () => {
  it('extracts numbered questions and correctly classifies sections and categories', async () => {
    const agent = new QuestionExtractionAgent();
    const rfpText = `
# Security & Compliance
1. Does your system support SOC2 Type II and AES-256 encryption at rest?
2. What is your pricing and monthly subscription fee?

# Technical Architecture
3. Can you describe your API latency and cloud infrastructure uptime?
    `.trim();

    const result = await agent.extractQuestions(rfpText, 'rfp-123');

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    const questions = result.data!;
    expect(questions.length).toBe(3);

    expect(questions[0].section).toBe('Security & Compliance');
    expect(questions[0].type).toBe('security');
    expect(questions[0].questionText).toContain('SOC2');

    expect(questions[1].type).toBe('commercial');
    expect(questions[1].questionText).toContain('pricing');

    expect(questions[2].section).toBe('Technical Architecture');
    expect(questions[2].type).toBe('technical');
  });

  it('falls back to LLM provider when heuristic extraction finds sparse questions', async () => {
    const mockLlm: CompletionProvider = {
      model: 'nvidia/test-model',
      complete: jest.fn().mockResolvedValue({
        text: JSON.stringify([
          {
            text: 'Please describe your disaster recovery policy.',
            section: 'Operations',
            type: 'technical',
          },
        ]),
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        model: 'nvidia/test-model',
        finishReason: 'stop',
      }),
    };

    const agent = new QuestionExtractionAgent(mockLlm);
    // Unstructured text without standard bullets or question marks
    const vagueText = 'This RFP requires suppliers to provide information about operations.';
    const result = await agent.extractQuestions(vagueText, 'rfp-456');

    expect(result.success).toBe(true);
    expect(mockLlm.complete).toHaveBeenCalled();
    expect(result.data?.length).toBe(1);
    expect(result.data![0].questionText).toBe('Please describe your disaster recovery policy.');
  });
});
