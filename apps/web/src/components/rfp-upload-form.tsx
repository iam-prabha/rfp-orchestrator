'use client';

import { ChangeEvent, FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileUp, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const FILE_TYPES = {
  pdf: { extension: '.pdf', mimeType: 'application/pdf' },
  docx: { extension: '.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  xlsx: { extension: '.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  txt: { extension: '.txt', mimeType: 'text/plain' },
  md: { extension: '.md', mimeType: 'text/markdown' },
} as const;

type UploadFileType = keyof typeof FILE_TYPES;

function getFileType(file: File): UploadFileType | null {
  const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
  return (Object.entries(FILE_TYPES).find(([, values]) => values.extension === extension || values.mimeType === file.type)?.[0] as UploadFileType | undefined) ?? null;
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function RfpUploadForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;
    setError(null);
    if (!selectedFile) {
      setFile(null);
      return;
    }
    if (!getFileType(selectedFile)) {
      setFile(null);
      setError('That file type is not supported. Upload a PDF, DOCX, XLSX, TXT, or Markdown file.');
      return;
    }
    if (selectedFile.size === 0 || selectedFile.size > MAX_FILE_SIZE) {
      setFile(null);
      setError('Files must be larger than 0 bytes and no bigger than 10 MB.');
      return;
    }
    setFile(selectedFile);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError('Choose an RFP file before uploading.');
      return;
    }

    setError(null);
    setIsUploading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const fileType = getFileType(file);

    if (!user || !fileType) {
      setError('Your session may have expired. Sign in again and choose a supported file.');
      setIsUploading(false);
      return;
    }

    const rfpId = crypto.randomUUID();
    const storagePath = `rfp/${user.id}/${rfpId}/${safeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage.from('rfp-files').upload(storagePath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

    if (uploadError) {
      console.error('RFP storage upload failed:', uploadError);
      setError('We could not upload that file. Check your connection and try again.');
      setIsUploading(false);
      return;
    }

    const { error: recordError } = await supabase.from('rfps').insert({
      id: rfpId,
      title: file.name,
      clientName: 'Unknown Client',
      status: 'uploaded',
      fileName: file.name,
      fileSize: file.size,
      fileType,
      storagePath,
      metadata: { keywords: [], sections: 0 },
      userId: user.id,
    });

    if (recordError) {
      console.error('RFP record creation failed:', recordError);
      await supabase.storage.from('rfp-files').remove([storagePath]);
      setError('The file uploaded, but we could not create its workspace record. Please try again.');
      setIsUploading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return <main className="min-h-screen bg-slate-50"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl items-center px-6 py-5 lg:px-8"><Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"><ArrowLeft className="h-4 w-4" /> Back to workspace</Link></div></header><section className="mx-auto max-w-2xl px-6 py-16 lg:px-8"><p className="text-sm font-medium text-blue-600">New RFP</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Upload a questionnaire</h1><p className="mt-4 text-slate-600">Add the original document to start a response workspace. Processing and question extraction will come next.</p><form onSubmit={handleSubmit} className="mt-10 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"><label htmlFor="rfp-file" className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-slate-300 px-6 py-12 text-center transition hover:border-blue-400 hover:bg-blue-50/30"><FileUp className="h-8 w-8 text-blue-600" /><span className="mt-4 font-medium text-slate-900">Choose an RFP or questionnaire</span><span className="mt-2 text-sm text-slate-500">PDF, DOCX, XLSX, TXT, or Markdown · 10 MB maximum</span><input id="rfp-file" type="file" accept=".pdf,.docx,.xlsx,.txt,.md" onChange={handleFileChange} className="sr-only" /></label>{file && <p className="mt-4 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">Selected: <span className="font-medium">{file.name}</span></p>}{error && <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm leading-6 text-red-700">{error}</p>}<Button type="submit" className="mt-6 w-full" disabled={isUploading}>{isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {isUploading ? 'Uploading…' : 'Upload RFP'}</Button></form></section></main>;
}
