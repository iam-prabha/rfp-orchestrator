import { createClient } from '@supabase/supabase-js';
import pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import * as cheerio from 'cheerio';
import { v4 as uuidv4 } from 'uuid';
import {
  RFP,
  RFPMetadata,
  RFPStatus,
  FileType,
  ProcessingResult,
  ProcessingStatus,
  ProcessingStage,
  AgentEvent,
  AgentEventType,
  Database,
  RfpRow,
} from '@repo/shared';

export interface IngestionConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  maxFileSize: number; // bytes
  allowedTypes: FileType[];
}

export interface IngestionResult {
  rfp: RFP;
  extractedText: string;
  metadata: RFPMetadata;
}

export class IngestionAgent {
  private supabase: ReturnType<typeof createClient<Database>>;
  private config: IngestionConfig;

  constructor(config: IngestionConfig) {
    this.config = config;
    this.supabase = createClient<Database>(config.supabaseUrl, config.supabaseServiceKey);
  }

  /**
   * Process an uploaded RFP file
   */
  async processFile(
    file: Buffer,
    fileName: string,
    mimeType: string,
    userId: string
  ): Promise<ProcessingResult<IngestionResult>> {
    try {
      // Validate file
      const validation = this.validateFile(file, fileName, mimeType);
      if (!validation.success) {
        return { success: false, error: validation.error };
      }

      // Extract text based on file type
      const extractedText = await this.extractText(file, mimeType);

      // Extract metadata
      const metadata = this.extractMetadata(extractedText, fileName);

      // Store file in Supabase Storage
      const storagePath = await this.storeFile(file, fileName, mimeType, uuidv4());

      // Create RFP record in database
      const rfp = await this.createRFPRecord(
        fileName,
        file.length,
        this.getFileType(mimeType),
        storagePath,
        metadata,
        userId
      );

      // Update status to processing
      await this.updateRFPStatus(rfp.id, 'processing');

      return {
        success: true,
        data: {
          rfp,
          extractedText,
          metadata,
        },
      };
    } catch (error) {
      console.error('Ingestion error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown ingestion error',
      };
    }
  }

  /**
   * Validate uploaded file
   */
  private validateFile(
    file: Buffer,
    fileName: string,
    mimeType: string
  ): ProcessingResult<void> {
    // Check file size
    if (file.length > this.config.maxFileSize) {
      return {
        success: false,
        error: `File size exceeds maximum allowed size of ${this.formatFileSize(this.config.maxFileSize)}`,
      };
    }

    // Check file type
    if (!this.config.allowedTypes.includes(this.getFileType(mimeType))) {
      return {
        success: false,
        error: `File type ${mimeType} is not supported. Allowed types: ${this.config.allowedTypes.join(', ')}`,
      };
    }

    // Basic virus scanning (placeholder - implement actual scanning in production)
    // const virusScan = await this.scanForVirus(file);
    // if (!virusScan.clean) {
    //   return { success: false, error: 'File failed virus scan' };
    // }

    return { success: true };
  }

  /**
   * Extract text from various file types
   */
  private async extractText(file: Buffer, mimeType: string): Promise<string> {
    switch (mimeType) {
      case 'application/pdf':
        return this.extractPdfText(file);
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return await this.extractDocxText(file);
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        return await this.extractExcelText(file);
      case 'text/plain':
        return file.toString('utf-8');
      default:
        throw new Error(`Unsupported mime type: ${mimeType}`);
    }
  }

  private async extractPdfText(buffer: Buffer): Promise<string> {
    const data = await pdfParse(buffer);
    return data.text;
  }

  private async extractDocxText(buffer: Buffer): Promise<string> {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  private async extractExcelText(buffer: Buffer): Promise<string> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheets: string[] = [];

    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      sheets.push(`--- Sheet: ${sheetName} ---\n${csv}`);
    });

    return sheets.join('\n\n');
  }

  /**
   * Extract metadata from extracted text
   */
  private extractMetadata(text: string, fileName: string): RFPMetadata {
    const metadata: RFPMetadata = {
      keywords: [],
      sections: 0,
    };

    // Common patterns for RFP metadata
    const patterns = {
      rfpId: /RFP\s*[#:]*\s*([A-Z0-9\-]+)/i,
      issueDate: /(?:Issue\s*Date|Date\s*Issued):\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      dueDate: /(?:Response\s*Due\s*By|Due\s*Date):\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      contactPerson: /(?:Contact\s*Person|Prepared\s*By):\s*([^\n\r]+)/i,
      contactEmail: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/,
      projectTitle: /(?:Project\s*Title|RFP\s*Title):\s*([^\n\r]+)/i,
      estimatedValue: /(?:Estimated\s*Value|Budget):\s*[\$€£]?\s*([\d,]+(?:\.\d{2})?)/i,
    };

    for (const [key, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match && match[1]) {
        (metadata as unknown as Record<string, unknown>)[key] = this.cleanMetadataValue(match[1]);
      }
    }

    // Count sections (rough estimate based on headers)
    metadata.sections = this.countSections(text);
    metadata.keywords = this.extractKeywords(text);

    return metadata;
  }

  private cleanMetadataValue(value: string): string {
    return value.trim().replace(/[\r\n]+/g, ' ');
  }

  private countSections(text: string): number {
    // Count potential section headers (lines that look like headers)
    const lines = text.split('\n');
    let count = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.length > 0 &&
        trimmed.length < 100 &&
        (trimmed.match(/^\d+[\.\)]\s/) || // Numbered sections
         trimmed.match(/^[A-Z][A-Z\s]{2,}:$/) || // ALL CAPS headers
         trimmed.match(/^[A-Z][a-z]+(\s[A-Z][a-z]+)*\s*$/)) // Title case headers
      ) {
        count++;
      }
    }
    return Math.max(count, 1);
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction - in production, use NLP
    const commonTerms = [
      'RFP', 'proposal', 'vendor', 'contract', 'compliance',
      'security', 'privacy', 'SOC', 'ISO', 'HIPAA', 'GDPR',
      'cloud', 'API', 'SLA', 'support', 'implementation',
      'migration', 'integration', 'customization', 'training',
      'maintenance', 'support', 'pricing', 'licensing'
    ];

    const lowerText = text.toLowerCase();
    return commonTerms.filter((term) => lowerText.includes(term.toLowerCase()));
  }

  /**
   * Store file in Supabase Storage
   */
  private async storeFile(
    file: Buffer,
    fileName: string,
    mimeType: string,
    rfpId: string
  ): Promise<string> {
    const storagePath = `rfp/${rfpId}/${fileName}`;

    const { error } = await this.supabase.storage
      .from('rfp-files')
      .upload(storagePath, file, {
        contentType: mimeType,
        metadata: {
          uploadedAt: new Date().toISOString(),
          originalName: fileName,
        },
      });

    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    return storagePath;
  }

  /**
   * Create RFP record in database
   */
  private async createRFPRecord(
    fileName: string,
    fileSize: number,
    fileType: FileType,
    storagePath: string,
    metadata: RFPMetadata,
    userId: string
  ): Promise<RFP> {
    const rfp: Omit<RFP, 'id' | 'createdAt' | 'updatedAt'> = {
      title: fileName,
      clientName: metadata.projectTitle || 'Unknown Client',
      clientIndustry: metadata.clientIndustry,
      status: 'uploaded',
      fileName,
      fileSize,
      fileType,
      storagePath,
      metadata,
      userId,
    };

    const { data, error } = await this.supabase
      .from('rfps')
      .insert(rfp)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create RFP record: ${error.message}`);
    }

    if (!data) {
      throw new Error('RFP record was not returned after storage.');
    }

    return this.toRfp(data);
  }

  /**
   * Update RFP processing status
   */
  async updateRFPStatus(
    rfpId: string,
    status: RFPStatus,
    statusError?: string
  ): Promise<void> {
    const update: Partial<RFP> = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'completed') {
      update.completedAt = new Date();
    }

    const { error } = await this.supabase
      .from('rfps')
      .update(update)
      .eq('id', rfpId);

    if (error) {
      console.error('Failed to update RFP status:', error);
    }

    // Emit event for real-time updates
    await this.emitEvent({
      type: 'ingestion_complete' as AgentEventType,
      agentId: 'ingestion',
      rfpId,
      payload: { status, error: statusError },
      timestamp: new Date(),
    });
  }

  private async emitEvent(event: AgentEvent): Promise<void> {
    const { error } = await this.supabase
      .from('agent_events')
      .insert({ ...event, timestamp: event.timestamp.toISOString() });

    if (error) {
      console.error('Failed to emit event:', error);
    }
  }

  private toRfp(row: RfpRow): RFP {
    return {
      ...row,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      completedAt: row.completedAt ? new Date(row.completedAt) : undefined,
    };
  }

  // Helper methods
  private getFileType(mimeType: string): FileType {
    switch (mimeType) {
      case 'application/pdf': return 'pdf';
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': return 'docx';
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': return 'xlsx';
      case 'text/plain': return 'txt';
      case 'text/markdown': return 'md';
      default: return 'txt';
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export default IngestionAgent;
