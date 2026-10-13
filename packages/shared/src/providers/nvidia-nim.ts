import type { CompletionOptions, CompletionResponse, CompletionProvider, EmbeddingProvider } from './index';

const BATCH_SIZE = 32;

export class NvidiaNimEmbeddingProvider implements EmbeddingProvider {
  constructor(
    private readonly apiKey: string,
    private readonly endpoint: string,
    public readonly model: string,
    public readonly dimension: number,
  ) {}

  async embed(texts: string[], inputType: 'passage' | 'query' = 'passage'): Promise<number[][]> {
    if (texts.length === 0) return [];
    const embeddings: number[][] = [];
    const base = this.endpoint.replace(/\/+$/, '');

    for (let offset = 0; offset < texts.length; offset += BATCH_SIZE) {
      const batch = texts.slice(offset, offset + BATCH_SIZE);
      const res = await fetch(`${base}/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ input: batch, model: this.model, input_type: inputType }),
      });
      if (!res.ok) throw new Error(`NIM embedding failed: ${res.status} — ${await res.text()}`);
      const json = await res.json() as { data: Array<{ index: number; embedding: number[] }> };
      const sorted = [...json.data].sort((a, b) => a.index - b.index);
      for (const item of sorted) {
        if (item.embedding.length !== this.dimension) {
          throw new Error(`NIM returned dimension ${item.embedding.length}, expected ${this.dimension}`);
        }
        embeddings.push(item.embedding);
      }
    }
    return embeddings;
  }
}

export class NvidiaNimCompletionProvider implements CompletionProvider {
  constructor(
    private readonly apiKey: string,
    private readonly endpoint: string,
    public readonly model: string,
  ) {}

  async complete(prompt: string, options: CompletionOptions): Promise<CompletionResponse> {
    const base = this.endpoint.replace(/\/+$/, '');
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        stop: options.stopSequences,
        stream: false,
      }),
    });
    if (!res.ok) throw new Error(`NIM completion failed: ${res.status} — ${await res.text()}`);
    const json = await res.json() as {
      choices: Array<{
        message?: { content: string };
        text?: string;
        finish_reason: string;
      }>;
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      model: string;
    };
    const text = json.choices[0]?.message?.content ?? json.choices[0]?.text ?? '';
    return {
      text,
      usage: {
        promptTokens: json.usage.prompt_tokens,
        completionTokens: json.usage.completion_tokens,
        totalTokens: json.usage.total_tokens,
      },
      model: json.model,
      finishReason: json.choices[0]?.finish_reason ?? 'stop',
    };
  }
}
