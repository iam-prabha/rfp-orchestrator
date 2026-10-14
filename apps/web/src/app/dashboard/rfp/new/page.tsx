import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';
import { RfpUploadForm } from '@/components/rfp-upload-form';

export const dynamic = 'force-dynamic';

export default async function NewRfpPage() {
  let user = null;
  try {
    const { data, error } = await createServerClient().auth.getUser();
    if (!error && data?.user) {
      user = data.user;
    }
  } catch {
    user = null;
  }
  if (!user) redirect('/login');
  return <RfpUploadForm />;
}
