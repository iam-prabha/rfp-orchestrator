import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';
import { RfpUploadForm } from '@/components/rfp-upload-form';

export const dynamic = 'force-dynamic';

export default async function NewRfpPage() {
  const { data: { user } } = await createServerClient().auth.getUser();
  if (!user) redirect('/login');
  return <RfpUploadForm />;
}
