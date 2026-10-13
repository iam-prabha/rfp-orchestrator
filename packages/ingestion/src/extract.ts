import './buffer-polyfill';
import type { FileType, RFPMetadata } from '@repo/shared';

export interface ExtractedDocument {
  text: string;
  metadata: RFPMetadata;
  warnings: string[];
}

export async function extractDocument(
  file: Buffer,
  fileName: string,
  mimeType: string,
): Promise<ExtractedDocument> {
  const text = await extractText(file, mimeType);
  const warnings: string[] = [];

  if (!text.trim()) {
    warnings.push('No readable text was found in this document.');
  }

  return {
    text,
    metadata: extractMetadata(text, fileName),
    warnings,
  };
}

export function fileTypeForMimeType(mimeType: string): FileType {
  switch (mimeType) {
    case 'application/pdf': return 'pdf';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': return 'docx';
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': return 'xlsx';
    case 'text/markdown': return 'md';
    case 'text/plain': return 'txt';
    default: throw new Error(`Unsupported mime type: ${mimeType}`);
  }
}

async function extractText(file: Buffer, mimeType: string): Promise<string> {
  switch (mimeType) {
    case 'application/pdf': {
      const pdfParseModule = await import('pdf-parse');
      const pdfParse = pdfParseModule.default || pdfParseModule;
      const data = await pdfParse(file);
      return data.text;
    }
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer: file });
      return result.value;
    }
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(file, { type: 'buffer' });
      return workbook.SheetNames.map((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        return `--- Sheet: ${sheetName} ---\n${XLSX.utils.sheet_to_csv(worksheet)}`;
      }).join('\n\n');
    }
    case 'text/plain':
    case 'text/markdown':
      return file.toString('utf-8');
    default:
      throw new Error(`Unsupported mime type: ${mimeType}`);
  }
}

function extractMetadata(text: string, _fileName: string): RFPMetadata {
  const metadata: RFPMetadata = { keywords: [], sections: 0 };
  const patterns = {
    rfpId: /RFP\s*[#:]*\s*([A-Z0-9\-]+)/i,
    issueDate: /(?:Issue\s*Date|Date\s*Issued):\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    responseDueDate: /(?:Response\s*Due\s*By|Due\s*Date):\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    contactPerson: /(?:Contact\s*Person|Prepared\s*By):\s*([^\n\r]+)/i,
    contactEmail: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/,
    projectTitle: /(?:Project\s*Title|RFP\s*Title):\s*([^\n\r]+)/i,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = text.match(pattern);
    if (match?.[1]) {
      (metadata as unknown as Record<string, unknown>)[key] = match[1].trim().replace(/[\r\n]+/g, ' ');
    }
  }

  metadata.sections = Math.max(text.split('\n').filter((line) => {
    const value = line.trim();
    return value.length > 0 && value.length < 100 && (
      /^\d+[.)]\s/.test(value) ||
      /^[A-Z][A-Z\s]{2,}:$/.test(value) ||
      /^[A-Z][a-z]+(\s[A-Z][a-z]+)*\s*$/.test(value)
    );
  }).length, 1);

  const commonTerms = [
    'RFP', 'proposal', 'vendor', 'contract', 'compliance', 'security',
    'privacy', 'SOC', 'ISO', 'HIPAA', 'GDPR', 'cloud', 'API', 'SLA',
    'support', 'implementation', 'migration', 'integration', 'customization',
    'training', 'maintenance', 'pricing', 'licensing',
  ];
  const lowerText = text.toLowerCase();
  metadata.keywords = commonTerms.filter((term) => lowerText.includes(term.toLowerCase()));

  return metadata;
}
