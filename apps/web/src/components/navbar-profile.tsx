import Link from 'next/link';
import { ChevronDown, Settings, UserRound } from 'lucide-react';
import { SignOutButton } from '@/components/sign-out-button';

type NavbarProfileProps = {
  username: string;
  displayName?: string | null;
  email: string;
};

export function NavbarProfile({ username, displayName, email }: NavbarProfileProps) {
  const name = displayName?.trim() || `@${username}`;
  const initials = (displayName?.trim() || username)
    .split(/\s+|[_-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return <details className="relative">
    <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-left transition hover:border-slate-300 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">{initials || 'U'}</span>
      <span className="hidden min-w-0 sm:block">
        <span className="block max-w-32 truncate text-sm font-semibold text-slate-900">{name}</span>
        <span className="block max-w-32 truncate text-xs text-slate-500">@{username}</span>
      </span>
      <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
    </summary>
    <div className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg shadow-slate-200/60">
      <div className="flex items-center gap-3 border-b border-slate-100 px-2 pb-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700">{initials || 'U'}</span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-950">{name}</p>
          <p className="truncate text-sm text-slate-500">{email}</p>
        </div>
      </div>
      <div className="pt-2">
        <Link href="/profile" className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-950">
          <UserRound className="h-4 w-4 text-slate-400" aria-hidden="true" />
          Profile settings
        </Link>
        <Link href="/dashboard" className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-950">
          <Settings className="h-4 w-4 text-slate-400" aria-hidden="true" />
          Workspace
        </Link>
        <div className="mt-1 border-t border-slate-100 pt-2 [&_button]:w-full [&_button]:justify-start [&_button]:border-0 [&_button]:px-2 [&_button]:text-slate-700 [&_button]:hover:bg-slate-50 [&_button]:hover:text-slate-950">
          <SignOutButton />
        </div>
      </div>
    </div>
  </details>;
}
