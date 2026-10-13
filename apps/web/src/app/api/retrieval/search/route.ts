import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
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
    const requestedThreshold = typeof body.similarityThreshold === 'number'
      ? Math.min(Math.max(body.similarityThreshold, 0), 1)
      : null;
    const similarityThreshold = requestedThreshold ?? 0.25;
    const rfpId = typeof body.rfpId === 'string' && body.rfpId ? body.rfpId : undefined;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
    const serviceKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    let user = null;
    if (accessToken) {
      const { data, error: authError } = await adminClient.auth.getUser(accessToken);
      if (authError) console.error('Retrieval bearer auth validation failed:', authError.message);
      user = data.user;
    }
    if (!user) {
      const cookieClient = createRouteHandlerClient({ cookies });
      const { data, error: cookieAuthError } = await cookieClient.auth.getUser();
      if (cookieAuthError) console.error('Retrieval cookie auth validation failed:', cookieAuthError.message);
      user = data.user;
    }
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    if (rfpId) {
      const { data: rfp, error: rfpError } = await adminClient
        .from('rfps')
        .select('id, status, chunkCount')
        .eq('id', rfpId)
        .eq('userId', user.id)
        .maybeSingle();
      if (rfpError) throw new Error(rfpError.message);
      if (!rfp) return NextResponse.json({ error: 'RFP not found.' }, { status: 404 });
      if (rfp.chunkCount === 0 || rfp.status !== 'ready') {
        return NextResponse.json({
          query,
          results: [],
          notice: `This document is ${rfp.status} with ${rfp.chunkCount || 0} chunks. Embedding generation might still be in progress.`,
          processingTimeMs: 0,
        });
      }
    }

    const agent = new RetrievalAgent({
      supabaseUrl,
      supabaseServiceKey: serviceKey,
      nvidiaNimApiKey: requiredEnv('NVIDIA_NIM_API_KEY'),
      nvidiaNimEndpoint: requiredEnv('NVIDIA_NIM_ENDPOINT'),
      embeddingModel: process.env.NVIDIA_EMBEDDING_MODEL || 'nvidia/nemotron-3-embed-1b',
    });
    const startedAt = Date.now();
    let results = await agent.searchSimilar(query, { userId: user.id, rfpId }, {
      limit,
      similarityThreshold,
    });

    // Adaptive fallback: if no explicit threshold was passed and 0 matches found at 0.25, retry at 0.15
    if (results.length === 0 && requestedThreshold === null) {
      results = await agent.searchSimilar(query, { userId: user.id, rfpId }, {
        limit,
        similarityThreshold: 0.15,
      });
    }

    return NextResponse.json({ query, results, processingTimeMs: Date.now() - startedAt });
  } catch (error) {

    console.error('Retrieval search failed:', error);
    return NextResponse.json({ error: 'Search failed.' }, { status: 422 });
  }
}
