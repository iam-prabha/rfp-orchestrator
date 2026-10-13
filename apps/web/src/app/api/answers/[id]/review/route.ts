import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server-auth';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, adminClient } = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const body = await request.json() as {
      status?: 'approved' | 'rejected' | 'reviewing';
      finalAnswer?: string;
      reviewNotes?: string;
    };

    if (!body.status || !['approved', 'rejected', 'reviewing'].includes(body.status)) {
      return NextResponse.json({ error: 'Valid status is required.' }, { status: 400 });
    }

    const { data: answer, error: answerError } = await adminClient
      .from('answers')
      .select('id, rfpId')
      .eq('id', params.id)
      .maybeSingle();

    if (answerError) throw new Error(answerError.message);
    if (!answer) return NextResponse.json({ error: 'Answer not found.' }, { status: 404 });

    // Verify ownership of the underlying RFP
    const { data: rfp } = await adminClient
      .from('rfps')
      .select('id')
      .eq('id', answer.rfpId)
      .eq('userId', user.id)
      .maybeSingle();

    if (!rfp) return NextResponse.json({ error: 'Access denied.' }, { status: 403 });

    const updatePayload: Record<string, unknown> = {
      status: body.status,
      reviewedBy: user.id,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (body.finalAnswer !== undefined) {
      updatePayload.finalAnswer = body.finalAnswer;
    }

    if (body.reviewNotes !== undefined) {
      updatePayload.reviewNotes = body.reviewNotes;
    }

    const { data: updated, error: updateError } = await adminClient
      .from('answers')
      .update(updatePayload)
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({ answer: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Review action failed.' },
      { status: 500 }
    );
  }
}
