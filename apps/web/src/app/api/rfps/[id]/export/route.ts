import { NextRequest, NextResponse } from 'next/server';
import { ExportService, ExportItem } from '@repo/orchestrator';
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

    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'docx';

    if (!['docx', 'xlsx'].includes(format)) {
      return NextResponse.json({ error: 'Supported formats are docx and xlsx.' }, { status: 400 });
    }

    const { data: rfp, error: rfpError } = await adminClient
      .from('rfps')
      .select('id, title, fileName')
      .eq('id', params.id)
      .eq('userId', user.id)
      .maybeSingle();

    if (rfpError) throw new Error(rfpError.message);
    if (!rfp) return NextResponse.json({ error: 'RFP not found.' }, { status: 404 });

    // Fetch questions and answers
    const { data: questions } = await adminClient
      .from('questions')
      .select('*')
      .eq('rfp_id', params.id)
      .order('question_order', { ascending: true });

    const { data: answers } = await adminClient
      .from('answers')
      .select('*')
      .eq('rfpId', params.id);

    const answerMap = new Map((answers || []).map((a) => [a.questionId, a]));

    const exportItems: ExportItem[] = (questions || []).map((q) => ({
      question: {
        id: q.id,
        rfpId: q.rfp_id,
        questionText: q.question_text,
        section: q.section,
        order: q.question_order,
        type: q.question_type,
        metadata: q.metadata,
        createdAt: new Date(q.created_at),
        updatedAt: new Date(q.updated_at),
      },
      answer: answerMap.get(q.id) || null,
    }));

    const exportService = new ExportService();
    const cleanTitle = rfp.title || rfp.fileName || 'RFP-Response';

    if (format === 'docx') {
      const docxBuffer = await exportService.exportToDocx(cleanTitle, exportItems);
      return new NextResponse(docxBuffer as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(cleanTitle)}.docx"`,
        },
      });
    } else {
      const xlsxBuffer = await exportService.exportToXlsx(cleanTitle, exportItems);
      return new NextResponse(xlsxBuffer as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(cleanTitle)}.xlsx"`,
        },
      });
    }
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Export failed.' },
      { status: 500 }
    );
  }
}
