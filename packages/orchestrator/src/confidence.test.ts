import { calculateExplainableConfidence } from './confidence';
import type { SearchResult } from '@repo/shared';

describe('calculateExplainableConfidence', () => {
  it('flags warning when no context chunks are available', () => {
    const result = calculateExplainableConfidence('This is a short answer.', []);
    expect(result.flaggedReasons).toContain('No sources retrieved from knowledge base');
    expect(result.sourceCount).toBe(0);
    expect(result.contextRelevance).toBe(0);
  });

  it('calculates high confidence score when relevant sources and specific technical indicators exist', () => {
    const chunks: SearchResult[] = [
      {
        id: '1',
        documentId: 'd1',
        chunkId: 'c1',
        text: 'SOC2 Type II compliant with AES-256 bit encryption.',
        similarityScore: 0.95,
        startOffset: 0,
        endOffset: 50,
        metadata: {},
      },
      {
        id: '2',
        documentId: 'd2',
        chunkId: 'c2',
        text: 'Our platform achieves 99.99% uptime and ISO 27001 standard certification.',
        similarityScore: 0.9,
        startOffset: 0,
        endOffset: 70,
        metadata: {},
      },
      {
        id: '3',
        documentId: 'd3',
        chunkId: 'c3',
        text: 'Full GDPR and HIPAA compliant cloud storage.',
        similarityScore: 0.88,
        startOffset: 0,
        endOffset: 45,
        metadata: {},
      },
    ];

    const answer =
      'Our platform guarantees 99.99% uptime and maintains full SOC2 Type II, ISO 27001, and HIPAA compliance. All customer data is secured with AES-256 encryption at rest.';

    const result = calculateExplainableConfidence(answer, chunks, 'technical');

    expect(result.total).toBeGreaterThan(70);
    expect(result.sourceCount).toBe(20);
    expect(result.contextRelevance).toBeGreaterThanOrEqual(35);
    expect(result.flaggedReasons.length).toBe(0);
  });
});
