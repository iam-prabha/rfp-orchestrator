'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase';

export function SignOutButton() {
  const router = useRouter();
  async function signOut() {
    await createClient().auth.signOut();
    router.push('/');
    router.refresh();
  }
  return <Button variant="outline" size="sm" onClick={signOut}><LogOut className="mr-2 h-4 w-4" /> Sign out</Button>;
}
