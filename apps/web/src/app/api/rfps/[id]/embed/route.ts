import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { RetrievalAgent } from '@repo/retrieval';

export const runtime = 'nodejs';

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authorization = request.headers.get('authorization');
  const accessToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!accessToken) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  let ownedRfpId: string | null = null;
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
    const serviceKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: authError } = await adminClient.auth.getUser(accessToken);
    if (authError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { data: rfp, error: rfpError } = await adminClient
      .from('rfps')
      .select('id, status, userId')
      .eq('id', params.id)
      .eq('userId', user.id)
      .maybeSingle();
    if (rfpError) throw new Error(rfpError.message);
    if (!rfp) return NextResponse.json({ error: 'RFP not found.' }, { status: 404 });
    ownedRfpId = rfp.id;

    const { error: processingError } = await adminClient.from('rfps').update({
      status: 'processing',
      embeddingError: null,
      embeddingCount: 0,
      embeddedAt: null,
    }).eq('id', rfp.id).eq('userId', user.id);
    if (processingError) throw new Error(processingError.message);

    const agent = new RetrievalAgent({
      supabaseUrl,
      supabaseServiceKey: serviceKey,
      nvidiaNimApiKey: requiredEnv('NVIDIA_NIM_API_KEY'),
      nvidiaNimEndpoint: requiredEnv('NVIDIA_NIM_ENDPOINT'),
      embeddingModel: process.env.NVIDIA_EMBEDDING_MODEL || 'nvidia/nemotron-3-embed-1b',
    });
    const embeddingCount = await agent.embedStoredDocumentChunks(rfp.id);
    const embeddedAt = new Date().toISOString();
    const { error: readyError } = await adminClient.from('rfps').update({
      status: 'ready',
      embeddingCount,
      embeddingError: null,
      embeddedAt,
    }).eq('id', rfp.id).eq('userId', user.id);
    if (readyError) throw new Error(readyError.message);

    return NextResponse.json({ id: rfp.id, status: 'ready', embeddingCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Embedding generation failed.';
    console.error('RFP embedding failed:', error);
    if (ownedRfpId) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
        const adminClient = createClient(supabaseUrl, requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        await adminClient.from('rfps').update({ status: 'failed', embeddingError: message }).eq('id', ownedRfpId);
      } catch (updateError) {
        console.error('Failed to record embedding error:', updateError);
      }
    }
    return NextResponse.json({ error: 'We could not generate embeddings for this document.' }, { status: 422 });
  }
}
