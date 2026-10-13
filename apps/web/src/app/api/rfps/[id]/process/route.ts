import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractDocument, QuestionExtractionAgent, ensureBufferPolyfill } from '@repo/ingestion';
import { RetrievalAgent } from '@repo/retrieval';

ensureBufferPolyfill();

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

type RfpRecord = {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  storagePath: string;
  userId: string;
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  let ownedRfpId: string | null = null;
  let processingStage: 'extraction' | 'chunking' | 'embedding' = 'extraction';
  const authorization = request.headers.get('authorization');
  const accessToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';

  if (!accessToken) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
    const adminClient = createClient(supabaseUrl, requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: authError } = await adminClient.auth.getUser(accessToken);

    if (authError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { data: rfp, error: rfpError } = await adminClient
      .from('rfps')
      .select('id, fileName, fileSize, fileType, storagePath, userId')
      .eq('id', params.id)
      .eq('userId', user.id)
      .maybeSingle<RfpRecord>();

    if (rfpError) throw new Error(rfpError.message);
    if (!rfp) return NextResponse.json({ error: 'RFP not found.' }, { status: 404 });

    ownedRfpId = rfp.id;
    const { error: processingError } = await adminClient.from('rfps').update({
      status: 'processing',
      extractionError: null,
      chunkingError: null,
      chunkCount: 0,
      chunkedAt: null,
      embeddingError: null,
      embeddingCount: 0,
      embeddedAt: null,
    }).eq('id', rfp.id).eq('userId', user.id);
    if (processingError) throw new Error(processingError.message);
    if (rfp.fileSize > MAX_FILE_SIZE) throw new Error('The file is larger than the 10 MB limit.');

    const { data: file, error: downloadError } = await adminClient.storage.from('rfp-files').download(rfp.storagePath);
    if (downloadError || !file) throw new Error(downloadError?.message || 'The original file could not be downloaded.');

    const extracted = await extractDocument(
      Buffer.from(await file.arrayBuffer()),
      rfp.fileName,
      mimeTypeForFileType(rfp.fileType, rfp.fileName),
    );
    const { error: updateError } = await adminClient.from('rfps').update({
      status: 'processed',
      extractedText: extracted.text,
      metadata: extracted.metadata,
      extractionMetadata: { ...extracted.metadata, warnings: extracted.warnings },
      extractionError: extracted.warnings.length ? extracted.warnings.join(' ') : null,
      processedAt: new Date().toISOString(),
    }).eq('id', rfp.id).eq('userId', user.id);

    if (updateError) throw new Error(updateError.message);

    const retrievalAgent = new RetrievalAgent({
      supabaseUrl,
      supabaseServiceKey: requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
      nvidiaNimApiKey: process.env.NVIDIA_NIM_API_KEY || '',
      nvidiaNimEndpoint: process.env.NVIDIA_NIM_ENDPOINT || '',
      embeddingModel: process.env.NVIDIA_EMBEDDING_MODEL || 'nvidia/nemotron-3-embed-1b',
    });
    processingStage = 'chunking';
    const chunks = retrievalAgent.chunkDocument(extracted.text, {
      rfpId: rfp.id,
      sourceFileName: rfp.fileName,
      fileType: rfp.fileType,
    });
    await retrievalAgent.storeDocumentChunksWithoutEmbeddings(rfp.id, chunks);
    processingStage = 'embedding';
    const embeddingCount = await retrievalAgent.embedStoredDocumentChunks(rfp.id);

    const chunkedAt = new Date().toISOString();
    const embeddedAt = new Date().toISOString();

    // Extract questions using QuestionExtractionAgent
    const questionExtractor = new QuestionExtractionAgent();
    const extractionResult = await questionExtractor.extractQuestions(extracted.text, rfp.id);
    const questions = extractionResult.success && extractionResult.data ? extractionResult.data : [];

    if (questions.length > 0) {
      await adminClient.from('questions').delete().eq('rfp_id', rfp.id);
      await adminClient.from('questions').insert(
        questions.map((q) => ({
          id: q.id,
          rfp_id: rfp.id,
          question_text: q.questionText,
          section: q.section,
          question_order: q.order,
          question_type: q.type,
          metadata: q.metadata,
        }))
      );
    }

    const { error: readyError } = await adminClient.from('rfps').update({
      status: 'ready',
      chunkCount: chunks.length,
      chunkingError: null,
      chunkedAt,
      embeddingCount,
      embeddingError: null,
      embeddedAt,
    }).eq('id', rfp.id).eq('userId', user.id);
    if (readyError) throw new Error(readyError.message);

    return NextResponse.json({
      id: rfp.id,
      status: 'ready',
      chunkCount: chunks.length,
      questionCount: questions.length,
      warnings: extracted.warnings,
    });
  } catch (error) {

    const message = error instanceof Error ? error.message : 'Document extraction failed.';
    console.error('RFP extraction failed:', error);

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
      const adminClient = createClient(supabaseUrl, requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      if (ownedRfpId) {
        const update = processingStage === 'embedding'
          ? { status: 'failed', embeddingError: message }
          : processingStage === 'chunking'
            ? { status: 'failed', chunkingError: message }
            : { status: 'failed', extractionError: message };
        await adminClient.from('rfps').update(update).eq('id', ownedRfpId);
      }
    } catch (updateError) {
      console.error('Failed to record extraction error:', updateError);
    }

    return NextResponse.json({ error: 'We could not extract text from this document.' }, { status: 422 });
  }
}

function mimeTypeForFileType(fileType: string, fileName: string) {
  switch (fileType) {
    case 'pdf': return 'application/pdf';
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'md': return 'text/markdown';
    case 'txt': return 'text/plain';
    default: throw new Error(`Unsupported document type for ${fileName}.`);
  }
}
