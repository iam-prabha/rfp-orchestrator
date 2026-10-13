'use client';

import { useState } from 'react';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { createClient } from '@/lib/supabase';

export function DeleteRfpButton({ rfpId, title }: { rfpId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setIsDeleting(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('You must be signed in to delete this file.');

      const response = await fetch(`/api/rfps/${rfpId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || 'Failed to delete RFP.');
      }

      setOpen(false);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting RFP');
      setIsDeleting(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(newOpen) => {
        if (isDeleting) return;
        setOpen(newOpen);
        if (!newOpen) setError(null);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-slate-400 hover:text-red-600 hover:bg-red-50"
          title="Delete RFP"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Delete {title}</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <AlertDialogTitle>Delete RFP Document</AlertDialogTitle>
              <p className="text-xs text-slate-500 font-normal mt-0.5 truncate max-w-xs sm:max-w-sm">
                {title}
              </p>
            </div>
          </div>
          <AlertDialogDescription className="pt-2 text-slate-600">
            Are you sure you want to delete <span className="font-semibold text-slate-800">“{title}”</span>?
            This will permanently remove the original file, all extracted document sections, vector embeddings, and any drafted answers. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isDeleting ? 'Deleting…' : 'Delete RFP'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
