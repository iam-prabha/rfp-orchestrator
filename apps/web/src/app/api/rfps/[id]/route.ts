import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server-auth';

export const runtime = 'nodejs';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, adminClient } = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    // Find the RFP and verify ownership
    const { data: rfp, error: rfpError } = await adminClient
      .from('rfps')
      .select('id, storagePath, userId')
      .eq('id', params.id)
      .eq('userId', user.id)
      .maybeSingle();

    if (rfpError) throw new Error(rfpError.message);
    if (!rfp) {
      return NextResponse.json({ error: 'RFP not found.' }, { status: 404 });
    }

    // 1. Delete physical file from Supabase Storage
    if (rfp.storagePath) {
      const { error: storageError } = await adminClient.storage
        .from('rfp-files')
        .remove([rfp.storagePath]);

      if (storageError) {
        console.warn('Storage file deletion failed or file already missing:', storageError.message);
      }
    }

    // 2. Delete RFP row from database (cascades to document_chunks, questions, and answers)
    const { error: deleteError } = await adminClient
      .from('rfps')
      .delete()
      .eq('id', rfp.id)
      .eq('userId', user.id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    return NextResponse.json({ success: true, id: rfp.id });
  } catch (error) {
    console.error('Failed to delete RFP:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete RFP.' },
      { status: 500 }
    );
  }
}
