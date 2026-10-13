import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server-auth';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, adminClient } = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { data: rfp, error: rfpError } = await adminClient
      .from('rfps')
      .select('id')
      .eq('id', params.id)
      .eq('userId', user.id)
      .maybeSingle();

    if (rfpError) throw new Error(rfpError.message);
    if (!rfp) return NextResponse.json({ error: 'RFP not found.' }, { status: 404 });

    // Fetch questions with any existing answers
    const { data: questions, error: qError } = await adminClient
      .from('questions')
      .select('*')
      .eq('rfp_id', params.id)
      .order('question_order', { ascending: true });

    if (qError) throw new Error(qError.message);

    const { data: answers, error: aError } = await adminClient
      .from('answers')
      .select('*')
      .eq('rfpId', params.id);

    if (aError) throw new Error(aError.message);

    const answerMap = new Map((answers || []).map((a) => [a.questionId, a]));

    const combined = (questions || []).map((q) => ({
      ...q,
      answer: answerMap.get(q.id) || null,
    }));

    return NextResponse.json({ questions: combined });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list questions.' },
      { status: 500 }
    );
  }
}
