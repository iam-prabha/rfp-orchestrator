export interface CompletionOptions {
  temperature: number;
  maxTokens: number;
  stopSequences?: string[];
}

export interface CompletionResponse {
  text: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  model: string;
  finishReason: string;
}

export interface CompletionProvider {
  readonly model: string;
  complete(prompt: string, options: CompletionOptions): Promise<CompletionResponse>;
}

export interface EmbeddingProvider {
  readonly model: string;
  readonly dimension: number;
  embed(texts: string[], inputType: 'passage' | 'query'): Promise<number[][]>;
}
