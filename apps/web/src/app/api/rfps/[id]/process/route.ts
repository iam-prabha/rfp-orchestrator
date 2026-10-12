import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractDocument } from '@repo/ingestion';

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
  const authorization = request.headers.get('authorization');
  const accessToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';

  if (!accessToken) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  try {
    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const authClient = createClient(supabaseUrl, requiredEnv('SUPABASE_ANON_KEY'));
    const adminClient = createClient(supabaseUrl, requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser(accessToken);

    if (authError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { data: rfp, error: rfpError } = await adminClient
      .from('rfps')
      .select('id, fileName, fileSize, fileType, storagePath, userId')
      .eq('id', params.id)
      .eq('userId', user.id)
      .maybeSingle<RfpRecord>();

    if (rfpError) throw new Error(rfpError.message);
    if (!rfp) return NextResponse.json({ error: 'RFP not found.' }, { status: 404 });

    await adminClient.from('rfps').update({ status: 'processing', extractionError: null }).eq('id', rfp.id);
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
    }).eq('id', rfp.id);

    if (updateError) throw new Error(updateError.message);
    return NextResponse.json({ id: rfp.id, status: 'processed', warnings: extracted.warnings });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Document extraction failed.';
    console.error('RFP extraction failed:', error);

    try {
      const supabaseUrl = requiredEnv('SUPABASE_URL');
      const adminClient = createClient(supabaseUrl, requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      await adminClient.from('rfps').update({ status: 'failed', extractionError: message }).eq('id', params.id);
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
