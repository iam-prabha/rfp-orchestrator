'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase';

export function RetryProcessingButton({ rfpId }: { rfpId: string }) {
  const [retrying, setRetrying] = useState(false);

  async function retry() {
    setRetrying(true);
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) await fetch(`/api/rfps/${rfpId}/process`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    window.location.reload();
  }

  return <Button type="button" variant="outline" size="sm" onClick={retry} disabled={retrying}>
    {retrying && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
    {retrying ? 'Retrying…' : 'Retry processing'}
  </Button>;
}
