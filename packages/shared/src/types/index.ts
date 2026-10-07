// RFP and Questionnaire Types

export interface RFP {
  id: string;
  title: string;
  clientName: string;
  clientIndustry?: string;
  status: RFPStatus;
  fileName: string;
  fileSize: number;
  fileType: FileType;
  storagePath: string;
  metadata: RFPMetadata;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  processingTimeMs?: number;
  userId: string;
}

export type RFPStatus =
  | 'uploaded'
  | 'processing'
  | 'reviewing'
  | 'completed'
  | 'failed';

export type FileType = 'pdf' | 'xlsx' | 'docx' | 'txt' | 'md';

export interface RFPMetadata {
  rfpId?: string;
  clientIndustry?: string;
  issueDate?: Date;
  responseDueDate?: Date;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  projectTitle?: string;
  projectDescription?: string;
  estimatedValue?: number;
  currency?: string;
  durationMonths?: number;
  keywords: string[];
  sections: number;
}

export interface Answer {
  id: string;
  rfpId: string;
  questionId: string;
  questionText: string;
  generatedAnswer: string;
  finalAnswer?: string | null;
  confidenceScore: number;
  sources: AnswerSource[];
  status: AnswerStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type AnswerStatus =
  | 'generated'
  | 'reviewing'
  | 'approved'
  | 'rejected';

export interface AnswerSource {
  documentId: string;
  documentTitle: string;
  chunkId: string;
  chunkText: string;
  relevanceScore: number;
  startOffset: number;
  endOffset: number;
}

export interface KBDoc {
  id: string;
  title: string;
  description?: string;
  fileType: FileType;
  storagePath: string;
  chunkCount: number;
  embeddingModel: string;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  isActive: boolean;
}

export interface TextChunk {
  id: string;
  documentId: string;
  text: string;
  startOffset: number;
  endOffset: number;
  metadata: Record<string, unknown>;
  embedding?: number[];
}

export interface SearchResult {
  id: string;
  documentId: string;
  chunkId: string;
  text: string;
  startOffset: number;
  endOffset: number;
  metadata: Record<string, unknown>;
  similarityScore: number;
}

export interface SearchOptions {
  limit?: number;
  similarityThreshold?: number;
  filters?: SearchFilters;
}

export interface SearchFilters {
  documentTypes?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  tags?: string[];
}

export type UserRole = 'admin' | 'sales_engineer' | 'proposal_manager' | 'compliance_officer';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  isActive: boolean;
  preferences: UserPreferences;
}

export interface UserPreferences {
  notifications: NotificationPreferences;
  display: DisplayPreferences;
}

export interface NotificationPreferences {
  email: boolean;
  slack: boolean;
  teams: boolean;
  inApp: boolean;
}

export interface DisplayPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
}

export interface AgentConfig {
  name: string;
  version: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  retryAttempts: number;
}

export interface ProcessingResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentProcessingContext {
  rfpId: string;
  userId: string;
  questionId?: string;
  metadata?: Record<string, unknown>;
}

export interface ProcessingStatus {
  stage: ProcessingStage;
  progress: number;
  message: string;
  startedAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export type ProcessingStage =
  | 'pending'
  | 'ingesting'
  | 'retrieving'
  | 'drafting'
  | 'reviewing'
  | 'completed'
  | 'failed';

export interface AgentEvent {
  type: AgentEventType;
  agentId: string;
  rfpId: string;
  payload: Record<string, unknown>;
  timestamp: Date;
}

export type AgentEventType =
  | 'ingestion_complete'
  | 'retrieval_complete'
  | 'drafting_complete'
  | 'review_required'
  | 'review_completed'
  | 'compilation_complete'
  | 'error';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

export interface Database {
  public: {
    Tables: {
      answers: DatabaseTable<AnswerRow>;
      document_chunks: DatabaseTable<DocumentChunkRow>;
      rfps: DatabaseTable<RfpRow>;
      agent_events: DatabaseTable<AgentEventRow>;
    };
    Views: {};
    Functions: {
      match_document_chunks: {
        Args: {
          query_embedding: number[];
          match_threshold: number;
          match_count: number;
        };
        Returns: MatchChunkRow[];
      };
    };
  };
}

export interface DatabaseTable<Row> {
  Row: Row & Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
}

export interface AnswerRow {
  id: string;
  rfpId: string | null;
  questionId: string;
  questionText: string;
  generatedAnswer: string;
  finalAnswer: string | null;
  confidenceScore: number;
  sources: AnswerSource[];
  status: AnswerStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentChunkRow {
  id: string;
  document_id: string;
  chunk_id: string;
  chunk_text: string;
  start_offset: number;
  end_offset: number;
  metadata: Record<string, unknown>;
  embedding: number[];
  similarity_score?: number;
  rank?: number;
}

export type MatchChunkRow = DocumentChunkRow & { similarity_score: number };

export interface RfpRow {
  id: string;
  title: string;
  clientName: string;
  clientIndustry?: string;
  status: RFPStatus;
  fileName: string;
  fileSize: number;
  fileType: FileType;
  storagePath: string;
  metadata: RFPMetadata;
  userId: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface AgentEventRow {
  id?: string;
  type: AgentEventType;
  agentId: string;
  rfpId: string;
  payload: Record<string, unknown>;
  timestamp: string;
}
