import { DraftingAgent } from './index';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'ans-1',
          rfpId: 'rfp-999',
          questionId: 'q-101',
          generatedAnswer: 'Our platform enforces SOC2 Type II and AES-256 encryption.',
          confidenceScore: 0.95,
        },
        error: null,
      }),
    })),
  })),
}));

describe('DraftingAgent', () => {
  const agent = new DraftingAgent({
    supabaseUrl: 'https://test.supabase.co',
    supabaseServiceKey: 'service-key',
    nvidiaNimApiKey: 'nim-key',
    nvidiaNimEndpoint: 'https://integrate.api.nvidia.com/v1',
    nvidiaNimModel: 'meta/llama3-70b-instruct',
    maxTokens: 1024,
    temperature: 0.2,
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('generates a draft answer and links to the correct questionId and citations', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              text: 'Our platform enforces SOC2 Type II and AES-256 encryption across all data at rest.',
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 },
          model: 'meta/llama3-70b-instruct',
        }),
        { status: 200 }
      )
    );

    const result = await agent.generateAnswer({
      question: 'What are your data encryption and compliance standards?',
      questionId: 'q-101',
      rfpId: 'rfp-999',
      questionType: 'technical',
      contextChunks: [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          chunkId: 'chunk-1',
          text: 'We comply with SOC2 Type II and employ AES-256 encryption on all stored databases.',
          similarityScore: 0.92,
          startOffset: 0,
          endOffset: 85,
          metadata: { title: 'Security Architecture' },
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.answer.questionId).toBe('q-101');
    expect(result.data?.answer.rfpId).toBe('rfp-999');
    expect(result.data?.answer.generatedAnswer).toContain('AES-256');
    expect(result.data?.sources.length).toBe(1);
    expect(result.data?.sources[0].documentTitle).toBe('Security Architecture');
    expect(result.data?.confidenceScore).toBeGreaterThan(0.5);
  });
});
