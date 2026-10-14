import { NextRequest, NextResponse } from 'next/server';
import { RetrievalAgent } from '@repo/retrieval';
import { DraftingAgent, PromptRegistry } from '@repo/drafting';
import { calculateExplainableConfidence, routeForReview } from '@repo/orchestrator';
import { getAuthenticatedUser } from '@/lib/server-auth';

export const runtime = 'nodejs';

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; qid: string } }
) {
  try {
    const { user, adminClient } = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
    const serviceKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');

    // Verify RFP belongs to user
    const { data: rfp, error: rfpError } = await adminClient
      .from('rfps')
      .select('id, userId')
      .eq('id', params.id)
      .eq('userId', user.id)
      .maybeSingle();

    if (rfpError) throw new Error(rfpError.message);
    if (!rfp) return NextResponse.json({ error: 'RFP not found.' }, { status: 404 });

    // Load question from DB
    const { data: question, error: questionError } = await adminClient
      .from('questions')
      .select('id, question_text, question_type, section')
      .eq('id', params.qid)
      .eq('rfp_id', params.id)
      .maybeSingle();

    if (questionError) throw new Error(questionError.message);
    if (!question) return NextResponse.json({ error: 'Question not found.' }, { status: 404 });

    const promptRegistry = new PromptRegistry();
    const versionedPrompt = promptRegistry.get(question.question_type);

    // 1. Retrieve matching chunks
    const retrievalAgent = new RetrievalAgent({
      supabaseUrl,
      supabaseServiceKey: serviceKey,
      nvidiaNimApiKey: process.env.NVIDIA_NIM_API_KEY || '',
      nvidiaNimEndpoint: process.env.NVIDIA_NIM_ENDPOINT || '',
      embeddingModel: process.env.NVIDIA_EMBEDDING_MODEL || 'nvidia/nemotron-3-embed-1b',
    });

    const retrievalResult = await retrievalAgent.retrieveContext(
      question.question_text,
      { userId: user.id, rfpId: params.id },
      { limit: 5, similarityThreshold: 0.2 }
    );

    // 2. Draft the answer
    const draftingAgent = new DraftingAgent({
      supabaseUrl,
      supabaseServiceKey: serviceKey,
      nvidiaNimApiKey: process.env.NVIDIA_NIM_API_KEY || '',
      nvidiaNimEndpoint: process.env.NVIDIA_NIM_ENDPOINT || '',
      nvidiaNimModel: process.env.NVIDIA_LLM_MODEL || 'meta/llama-3.2-11b-vision-instruct',
      maxTokens: 1024,
      temperature: 0.2,
    });

    const draftResult = await draftingAgent.generateAnswer({
      question: question.question_text,
      questionId: question.id,
      rfpId: params.id,
      contextChunks: retrievalResult.results,
      questionType: question.question_type,
      lengthPreference: 'standard',
    });

    if (!draftResult.success || !draftResult.data) {
      throw new Error(draftResult.error || 'Failed to generate answer.');
    }

    const { answer } = draftResult.data;

    // 3. Explainable confidence calculation & review routing
    const confidenceBreakdown = calculateExplainableConfidence(
      answer.generatedAnswer,
      retrievalResult.results,
      question.question_type
    );

    const reviewDecision = routeForReview(
      { confidenceScore: confidenceBreakdown.total },
      { confidenceThreshold: 70, alwaysReviewSensitive: true },
      question.question_type === 'security' || question.question_type === 'legal'
    );

    // 4. Update the answer status & confidence in DB
    await adminClient
      .from('answers')
      .update({
        confidenceScore: confidenceBreakdown.total,
        status: reviewDecision.status,
        metadata: {
          confidenceBreakdown,
          promptId: versionedPrompt?.id,
          promptVersion: versionedPrompt?.version,
        },
      })
      .eq('id', answer.id);

    return NextResponse.json({
      answer: {
        ...answer,
        confidenceScore: confidenceBreakdown.total,
        status: reviewDecision.status,
      },
      confidenceBreakdown,
      reviewDecision,
      sources: draftResult.data.sources,
    });
  } catch (error) {
    console.error('Drafting question answer failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Draft generation failed.' },
      { status: 500 }
    );
  }
}
