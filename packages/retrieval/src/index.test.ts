import { RetrievalAgent } from './index';

function agent(chunkSize = 1000, chunkOverlap = 200) {
  return new RetrievalAgent({
    supabaseUrl: 'http://localhost:54321',
    supabaseServiceKey: 'test-key',
    nvidiaNimApiKey: '',
    nvidiaNimEndpoint: '',
    chunkSize,
    chunkOverlap,
  });
}

describe('RetrievalAgent.chunkDocument', () => {
  it('chunks paragraphs in order and preserves source offsets', () => {
    const text = 'First paragraph.\n\nSecond paragraph.';
    const chunks = agent().chunkDocument(text);

    expect(chunks.map((chunk) => chunk.text)).toEqual(['First paragraph.\n\nSecond paragraph.']);
    expect(chunks.every((chunk) => text.slice(Number(chunk.metadata.startOffset), Number(chunk.metadata.endOffset)) === chunk.text)).toBe(true);
  });

  it('splits oversized paragraphs using the configured overlap', () => {
    const text = 'abcdefghijklmnopqrst';
    const chunks = agent(10, 2).chunkDocument(text);

    expect(chunks.map((chunk) => chunk.text)).toEqual(['abcdefghij', 'ijklmnopqr', 'qrst']);
    expect(chunks.every((chunk) => chunk.text.length <= 10)).toBe(true);
    expect(chunks.every((chunk) => text.slice(Number(chunk.metadata.startOffset), Number(chunk.metadata.endOffset)) === chunk.text)).toBe(true);
  });

  it('returns no chunks for empty documents', () => {
    expect(agent().chunkDocument('  \n\n  ')).toEqual([]);
  });

  it('does not call NVIDIA for an empty embedding request', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    await expect(agent().generateEmbeddings([])).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it('validates embedding response dimensions', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: [{ index: 0, embedding: [1, 2], object: 'embedding' }],
    }), { status: 200 }));
    await expect(new RetrievalAgent({
      supabaseUrl: 'http://localhost:54321',
      supabaseServiceKey: 'test-key',
      nvidiaNimApiKey: 'test-key',
      nvidiaNimEndpoint: 'https://example.test/v1',
    }).generateEmbeddings(['text'])).rejects.toThrow('expected 2048');
    fetchMock.mockRestore();
  });
});
