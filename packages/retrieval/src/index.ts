import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import {
  SearchResult,
  SearchOptions,
  SearchFilters,
  TextChunk,
  ProcessingResult,
  ProcessingStatus,
  ProcessingStage,
  AgentEvent,
  AgentEventType,
  Database,
} from '@repo/shared';

export interface RetrievalConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  nvidiaNimApiKey: string;
  nvidiaNimEndpoint: string;
  embeddingModel: string;
  maxChunksPerQuery: number;
  similarityThreshold: number;
  chunkSize: number;
  chunkOverlap: number;
}

export interface RetrievalResult {
  results: SearchResult[];
  queryEmbedding: number[];
  processingTimeMs: number;
}

export interface EmbeddingRequest {
  input: string[];
  model: string;
}

export interface EmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
    object: string;
  }>;
  model: string;
  usage: {
    promptTokens: number;
    totalTokens: number;
  };
}

interface ChunkWithOffsets {
  id?: string;
  text: string;
  startOffset: number;
  endOffset: number;
  metadata?: Record<string, unknown>;
}

export class RetrievalAgent {
  private supabase: ReturnType<typeof createClient<Database>>;
  private config: RetrievalConfig;

  constructor(config: {
    supabaseUrl: string;
    supabaseServiceKey: string;
    nvidiaNimApiKey: string;
    nvidiaNimEndpoint: string;
    embeddingModel?: string;
    maxChunksPerQuery?: number;
    similarityThreshold?: number;
    chunkSize?: number;
    chunkOverlap?: number;
  }) {
    this.config = {
      supabaseUrl: config.supabaseUrl,
      supabaseServiceKey: config.supabaseServiceKey,
      nvidiaNimApiKey: config.nvidiaNimApiKey,
      nvidiaNimEndpoint: config.nvidiaNimEndpoint,
      embeddingModel: config.embeddingModel || 'NV-Embed-QA',
      maxChunksPerQuery: config.maxChunksPerQuery || 10,
      similarityThreshold: config.similarityThreshold || 0.7,
      chunkSize: config.chunkSize || 1000,
      chunkOverlap: config.chunkOverlap || 200,
    };

    this.supabase = createClient<Database>(config.supabaseUrl, config.supabaseServiceKey);
  }

  /**
   * Generate embeddings using NVIDIA NIM
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${this.config.nvidiaNimEndpoint}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.nvidiaNimApiKey}`,
      },
      body: JSON.stringify({
        input: texts,
        model: this.config.embeddingModel,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`NVIDIA NIM embedding failed: ${response.status} - ${error}`);
    }

    const data = await response.json() as { data: Array<{ embedding: number[] }> };
    return data.data.map((item) => item.embedding);
  }

  /**
   * Chunk document text into overlapping chunks
   */
  chunkDocument(text: string, metadata: Record<string, unknown> = {}): Array<{
    id: string;
    text: string;
    metadata: Record<string, unknown>;
  }> {
    // Try semantic chunking first (by paragraphs)
    const paragraphs = text.split(/\n\s*\n/);
    const chunks: ChunkWithOffsets[] = [];
    let currentChunk = '';
    let startPos = 0;

    for (const paragraph of paragraphs) {
      if ((currentChunk + paragraph).length > this.config.chunkSize && currentChunk) {
        chunks.push({
          text: currentChunk.trim(),
          startOffset: startPos,
          endOffset: startPos + currentChunk.length,
        });
        startPos += currentChunk.length;
        currentChunk = paragraph;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk.trim(),
        startOffset: startPos,
        endOffset: startPos + currentChunk.length,
      });
    }

    // If chunks are too large, apply sliding window
    if (chunks.some((c) => c.text.length > this.config.chunkSize * 1.5)) {
      return this.slidingWindowChunk(text, metadata);
    }

    return chunks.map((chunk, index) => ({
      id: uuidv4(),
      text: chunk.text,
      metadata: {
        ...metadata,
        chunkIndex: index,
        startOffset: chunk.startOffset,
        endOffset: chunk.endOffset,
      },
    }));
  }

  private slidingWindowChunk(text: string, metadata: Record<string, unknown>): Array<{
    id: string;
    text: string;
    metadata: Record<string, unknown>;
  }> {
    const chunks: Array<{ id: string; text: string; metadata: Record<string, unknown> }> = [];
    let start = 0;
    const chunkSize = this.config.chunkSize;
    const overlap = this.config.chunkOverlap;

    while (start < text.length) {
      const end = Math.min(start + this.config.chunkSize, text.length);
      let actualEnd = end;

      // Try to break at sentence boundary
      if (end < text.length) {
        const lastPeriod = text.lastIndexOf('.', end);
        if (lastPeriod > start + this.config.chunkSize * 0.5) {
          actualEnd = lastPeriod + 1;
        }
      }

      chunks.push({
        id: `${uuidv4()}`,
        text: text.slice(start, actualEnd).trim(),
        metadata: {
          ...metadata,
          startOffset: start,
          endOffset: actualEnd,
          chunkType: 'sliding-window',
        },
      });

      start = actualEnd - overlap;
      if (start < 0) start = 0;
    }

    return chunks;
  }

  /**
   * Store document chunks with embeddings in Supabase
   */
  async storeDocumentChunks(
    documentId: string,
    chunks: Array<{ id: string; text: string; metadata: Record<string, unknown> }>
  ): Promise<void> {
    // Generate embeddings for all chunks
    const texts = chunks.map((c) => c.text);
    const embeddings = await this.generateEmbeddings(texts);

    // Delete existing chunks for this document
    await this.supabase
      .from('document_chunks')
      .delete()
      .eq('document_id', documentId);

    // Insert new chunks with embeddings
    const records = chunks.map((chunk, index) => ({
      document_id: documentId,
      chunk_id: chunk.id,
      chunk_text: chunk.text,
      start_offset: chunk.metadata.startOffset,
      end_offset: chunk.metadata.endOffset,
      metadata: chunk.metadata,
      embedding: embeddings[index],
    }));

    const { error } = await this.supabase
      .from('document_chunks')
      .insert(records);

    if (error) {
      throw new Error(`Failed to store chunks: ${error.message}`);
    }
  }

  /**
   * Search for similar chunks using vector similarity
   */
  async searchSimilar(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const startTime = Date.now();

    // Generate query embedding
    const queryEmbeddings = await this.generateEmbeddings([query]);
    const queryEmbedding = queryEmbeddings[0];

    const {
      limit = this.config.maxChunksPerQuery,
      similarityThreshold = this.config.similarityThreshold,
      filters = {},
    } = options;

    const { data, error } = await this.supabase.rpc('match_document_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: similarityThreshold,
      match_count: limit,
    });

    if (error) {
      throw new Error(`Search failed: ${error.message}`);
    }

    return (data || []).map((row) => ({
      id: row.id,
      documentId: row.document_id,
      chunkId: row.chunk_id,
      text: row.chunk_text,
      startOffset: row.start_offset,
      endOffset: row.end_offset,
      metadata: row.metadata,
      similarityScore: Number(row.similarity_score),
    }));
  }

  /**
   * Hybrid search: vector + keyword
   */
  async hybridSearch(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    // Vector search
    const vectorResults = await this.searchSimilar(query, options);

    // Keyword search (full-text search)
    const keywordResults = await this.keywordSearch(query, options);

    // Merge and rerank
    return this.mergeAndRerank(vectorResults, keywordResults, options.limit || 10);
  }

  private async keywordSearch(
    query: string,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const { data, error } = await this.supabase
      .from('document_chunks')
      .select(`
        id,
        document_id,
        chunk_id,
        chunk_text,
        start_offset,
        end_offset,
        metadata
      `)
      .textSearch('chunk_text', query, {
        type: 'websearch',
        config: 'english',
      })
      .limit(options.limit || 10);

    if (error) {
      console.error('Keyword search error:', error);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      documentId: row.document_id,
      chunkId: row.chunk_id,
      text: row.chunk_text,
      startOffset: 0,
      endOffset: 0,
      metadata: row.metadata,
      similarityScore: 0,
    }));
  }

  private mergeAndRerank(
    vectorResults: SearchResult[],
    keywordResults: SearchResult[],
    limit: number
  ): SearchResult[] {
    const merged = new Map<string, SearchResult>();

    // Add vector results with weight 0.7
    for (const result of vectorResults) {
      merged.set(result.id, {
        ...result,
        similarityScore: result.similarityScore * 0.7,
      });
    }

    // Add keyword results with weight 0.3
    for (const result of keywordResults) {
      const existing = merged.get(result.id);
      if (existing) {
        existing.similarityScore += result.similarityScore * 0.3;
      } else {
        merged.set(result.id, {
          ...result,
          similarityScore: result.similarityScore * 0.3,
        });
      }
    }

    return Array.from(merged.values())
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, limit);
  }

  /**
   * Process a question and return relevant context
   */
  async retrieveContext(
    question: string,
    rfpId?: string,
    options: SearchOptions = {}
  ): Promise<RetrievalResult> {
    const startTime = Date.now();

    // Add RFP filter if provided
    if (rfpId) {
      options.filters = {
        ...options.filters,
        tags: [...(options.filters?.tags || []), `rfp:${rfpId}`],
      };
    }

    const results = await this.hybridSearch(question, options);

    // Emit event
    await this.emitEvent({
      type: 'retrieval_complete',
      agentId: 'retrieval',
      rfpId: rfpId || 'unknown',
      payload: {
        question,
        resultCount: results.length,
        processingTimeMs: Date.now() - Date.now(),
      },
      timestamp: new Date(),
    });

    return {
      results,
      queryEmbedding: (await this.generateEmbeddings([question]))[0],
      processingTimeMs: Date.now() - startTime,
    };
  }

  private async emitEvent(event: AgentEvent): Promise<void> {
    const { error } = await this.supabase
      .from('agent_events')
      .insert({ ...event, timestamp: event.timestamp.toISOString() });

    if (error) {
      console.error('Failed to emit event:', error);
    }
  }
}

export default RetrievalAgent;
