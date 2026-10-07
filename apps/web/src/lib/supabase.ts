import {
  createClientComponentClient,
  createServerComponentClient,
} from '@supabase/auth-helpers-nextjs';

export const createClient = () => {
  return createClientComponentClient();
};

export const getSupabase = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  return createClient();
};

// Server-side client for server components
export const createServerClient = () => {
  const { cookies } = require('next/headers');

  return createServerComponentClient({ cookies });
};

export type SupabaseClient = ReturnType<typeof createClient>;
