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

export interface RetrievalScope {
  userId: string;
  rfpId?: string;
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

const EMBEDDING_BATCH_SIZE = 32;
const EMBEDDING_DIMENSION = 1024;

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
    if (texts.length === 0) return [];
    if (!this.config.nvidiaNimApiKey) throw new Error('NVIDIA_NIM_API_KEY is not configured.');
    if (!this.config.nvidiaNimEndpoint) throw new Error('NVIDIA_NIM_ENDPOINT is not configured.');

    const embeddings: number[][] = [];
    for (let offset = 0; offset < texts.length; offset += EMBEDDING_BATCH_SIZE) {
      const batch = texts.slice(offset, offset + EMBEDDING_BATCH_SIZE);
      const response = await fetch(`${this.config.nvidiaNimEndpoint}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.nvidiaNimApiKey}`,
        },
        body: JSON.stringify({ input: batch, model: this.config.embeddingModel }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`NVIDIA NIM embedding failed: ${response.status} - ${error}`);
      }

      const data = await response.json() as Partial<EmbeddingResponse>;
      if (!Array.isArray(data.data) || data.data.length !== batch.length) {
        throw new Error(`NVIDIA NIM returned ${data.data?.length || 0} embeddings for ${batch.length} inputs.`);
      }

      const ordered = [...data.data].sort((a, b) => a.index - b.index);
      for (const item of ordered) {
        if (!Array.isArray(item.embedding) || item.embedding.length !== EMBEDDING_DIMENSION) {
          throw new Error(`NVIDIA NIM returned an embedding with dimension ${item.embedding?.length || 0}; expected ${EMBEDDING_DIMENSION}.`);
        }
        embeddings.push(item.embedding);
      }
    }
    return embeddings;
  }

  /**
   * Chunk document text into overlapping chunks
   */
  chunkDocument(text: string, metadata: Record<string, unknown> = {}): Array<{
    id: string;
    text: string;
    metadata: Record<string, unknown>;
  }> {
    if (!text.trim()) return [];

    // Keep paragraph boundaries where possible. Offsets are calculated from
    // the original string rather than from a reconstructed join of paragraphs.
    const paragraphs: Array<{ start: number; end: number }> = [];
    const paragraphPattern = /[^\n]*(?:\n(?!\s*\n)[^\n]*)*/g;
    let match: RegExpExecArray | null;
    while ((match = paragraphPattern.exec(text))) {
      if (match[0].trim()) paragraphs.push({ start: match.index, end: match.index + match[0].length });
      if (match[0].length === 0) paragraphPattern.lastIndex += 1;
    }

    const chunks: ChunkWithOffsets[] = [];
    let groupStart: number | null = null;
    let groupEnd = 0;

    const addTrimmedChunk = (start: number, end: number) => {
      const value = text.slice(start, end);
      const leadingWhitespace = value.search(/\S/);
      const trailingWhitespace = value.search(/\s*$/);
      if (leadingWhitespace === -1) return;
      const trimmedStart = start + leadingWhitespace;
      const trimmedEnd = start + trailingWhitespace;
      chunks.push({ text: text.slice(trimmedStart, trimmedEnd), startOffset: trimmedStart, endOffset: trimmedEnd });
    };

    for (const paragraph of paragraphs) {
      if (paragraph.end - paragraph.start > this.config.chunkSize) {
        if (groupStart !== null) {
          addTrimmedChunk(groupStart, groupEnd);
          groupStart = null;
        }
        chunks.push(...this.slidingWindowChunk(text.slice(paragraph.start, paragraph.end), metadata, paragraph.start).map((chunk) => ({
          text: chunk.text,
          startOffset: Number(chunk.metadata.startOffset),
          endOffset: Number(chunk.metadata.endOffset),
        })));
        continue;
      }

      if (groupStart !== null && paragraph.end - groupStart > this.config.chunkSize) {
        addTrimmedChunk(groupStart, groupEnd);
        groupStart = paragraph.start;
      } else {
        groupStart = groupStart === null ? paragraph.start : groupStart;
      }
      groupEnd = paragraph.end;
    }

    if (groupStart !== null) addTrimmedChunk(groupStart, groupEnd);

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

  private slidingWindowChunk(text: string, metadata: Record<string, unknown>, offset = 0): Array<{
    id: string;
    text: string;
    metadata: Record<string, unknown>;
  }> {
    const chunks: Array<{ id: string; text: string; metadata: Record<string, unknown> }> = [];
    let start = 0;
    const chunkSize = this.config.chunkSize;
    const overlap = this.config.chunkOverlap;

    while (start < text.length) {
      const actualEnd = Math.min(start + this.config.chunkSize, text.length);
      const value = text.slice(start, actualEnd);
      const leadingWhitespace = value.search(/\S/);
      const trailingWhitespace = value.search(/\s*$/);
      const contentStart = leadingWhitespace === -1 ? start : start + leadingWhitespace;
      const contentEnd = leadingWhitespace === -1 ? actualEnd : start + trailingWhitespace;

      chunks.push({
        id: `${uuidv4()}`,
        text: text.slice(contentStart, contentEnd),
        metadata: {
          ...metadata,
          startOffset: offset + contentStart,
          endOffset: offset + contentEnd,
          chunkType: 'sliding-window',
        },
      });

      if (actualEnd === text.length) break;
      start = Math.max(start + 1, actualEnd - overlap);
    }

    return chunks;
  }

  /** Store chunks for retrieval preparation. Embeddings are intentionally added later. */
  async storeDocumentChunksWithoutEmbeddings(
    documentId: string,
    chunks: Array<{ id: string; text: string; metadata: Record<string, unknown> }>,
  ): Promise<void> {
    const { error: deleteError } = await this.supabase
      .from('document_chunks')
      .delete()
      .eq('document_id', documentId);
    if (deleteError) throw new Error(`Failed to replace existing chunks: ${deleteError.message}`);

    if (chunks.length === 0) return;

    const records = chunks.map((chunk) => ({
      document_id: documentId,
      chunk_id: chunk.id,
      chunk_text: chunk.text,
      start_offset: chunk.metadata.startOffset,
      end_offset: chunk.metadata.endOffset,
      metadata: chunk.metadata,
    }));
    const { error } = await this.supabase.from('document_chunks').insert(records);
    if (error) throw new Error(`Failed to store chunks: ${error.message}`);
  }

  /**
   * Store document chunks with embeddings in Supabase
   */
  async storeDocumentChunks(
    documentId: string,
    chunks: Array<{ id: string; text: string; metadata: Record<string, unknown> }>
  ): Promise<void> {
    await this.storeDocumentChunksWithoutEmbeddings(documentId, chunks);
    await this.embedStoredDocumentChunks(documentId);
  }

  /** Generate and update embeddings for chunks already stored for a document. */
  async embedStoredDocumentChunks(documentId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('document_chunks')
      .select('chunk_id, chunk_text')
      .eq('document_id', documentId)
      .order('chunk_id');
    if (error) throw new Error(`Failed to load chunks for embedding: ${error.message}`);

    const chunks = data || [];
    if (chunks.length === 0) return 0;
    const embeddings = await this.generateEmbeddings(chunks.map((chunk) => chunk.chunk_text));

    await Promise.all(chunks.map(async (chunk, index) => {
      const { error: updateError } = await this.supabase
        .from('document_chunks')
        .update({ embedding: embeddings[index] })
        .eq('document_id', documentId)
        .eq('chunk_id', chunk.chunk_id);
      if (updateError) throw new Error(`Failed to store embedding for chunk ${chunk.chunk_id}: ${updateError.message}`);
    }));
    return chunks.length;
  }

  /**
   * Search for similar chunks using vector similarity
   */
  async searchSimilar(
    query: string,
    scope: RetrievalScope,
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
      requesting_user_id: scope.userId,
      requested_rfp_id: scope.rfpId || null,
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
    scope: RetrievalScope,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    // Keep the public retrieval path ownership-safe and vector-backed until
    // keyword ranking has a scoped ts_rank implementation.
    return this.searchSimilar(query, scope, options);
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
    scope: RetrievalScope,
    options: SearchOptions = {}
  ): Promise<RetrievalResult> {
    const startTime = Date.now();

    // Add RFP filter if provided
    const results = await this.hybridSearch(question, scope, options);

    // Emit event
    await this.emitEvent({
      type: 'retrieval_complete',
      agentId: 'retrieval',
      rfpId: scope.rfpId || 'unknown',
      payload: {
        question,
        resultCount: results.length,
        processingTimeMs: Date.now() - Date.now(),
      },
      timestamp: new Date(),
    });

    return {
      results,
      queryEmbedding: await this.generateEmbeddings([question]).then((values) => values[0]),
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
