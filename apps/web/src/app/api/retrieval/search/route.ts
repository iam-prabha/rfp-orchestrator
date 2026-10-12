import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { RetrievalAgent } from '@repo/retrieval';

export const runtime = 'nodejs';

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  const accessToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!accessToken) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  try {
    const body = await request.json() as {
      query?: unknown;
      rfpId?: unknown;
      limit?: unknown;
      similarityThreshold?: unknown;
    };
    const query = typeof body.query === 'string' ? body.query.trim() : '';
    if (!query) return NextResponse.json({ error: 'A search query is required.' }, { status: 400 });

    const limit = typeof body.limit === 'number' ? Math.min(Math.max(Math.floor(body.limit), 1), 50) : 10;
    const similarityThreshold = typeof body.similarityThreshold === 'number'
      ? Math.min(Math.max(body.similarityThreshold, 0), 1)
      : 0.7;
    const rfpId = typeof body.rfpId === 'string' && body.rfpId ? body.rfpId : undefined;
    const supabaseUrl = process.env.SUPABASE_URL || requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
    const anonKey = process.env.SUPABASE_ANON_KEY || requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    const serviceKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const authClient = createClient(supabaseUrl, anonKey);
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser(accessToken);
    if (authError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    if (rfpId) {
      const { data: rfp, error: rfpError } = await adminClient
        .from('rfps')
        .select('id')
        .eq('id', rfpId)
        .eq('userId', user.id)
        .maybeSingle();
      if (rfpError) throw new Error(rfpError.message);
      if (!rfp) return NextResponse.json({ error: 'RFP not found.' }, { status: 404 });
    }

    const agent = new RetrievalAgent({
      supabaseUrl,
      supabaseServiceKey: serviceKey,
      nvidiaNimApiKey: requiredEnv('NVIDIA_NIM_API_KEY'),
      nvidiaNimEndpoint: requiredEnv('NVIDIA_NIM_ENDPOINT'),
      embeddingModel: process.env.NVIDIA_EMBEDDING_MODEL || 'NV-Embed-QA',
    });
    const startedAt = Date.now();
    const results = await agent.searchSimilar(query, { userId: user.id, rfpId }, {
      limit,
      similarityThreshold,
    });

    return NextResponse.json({ query, results, processingTimeMs: Date.now() - startedAt });
  } catch (error) {
    console.error('Retrieval search failed:', error);
    return NextResponse.json({ error: 'Search failed.' }, { status: 422 });
  }
}
