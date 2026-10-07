import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';
import { AuthForm } from '@/components/auth-form';

export const dynamic = 'force-dynamic';

export default async function SignupPage() {
  const { data: { user } } = await createServerClient().auth.getUser();
  if (user) redirect('/dashboard');
  return <AuthForm mode="signup" />;
}
