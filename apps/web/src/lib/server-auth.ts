import { NextRequest } from 'next/server';
import { createClient, User, SupabaseClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export interface AuthenticatedContext {
  user: User | null;
  adminClient: SupabaseClient;
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export async function getAuthenticatedUser(request: NextRequest): Promise<AuthenticatedContext> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const authorization = request.headers.get('authorization');
  const accessToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';

  let user: User | null = null;

  // 1. Bearer Token Auth
  if (accessToken) {
    const { data: authData, error: authError } = await adminClient.auth.getUser(accessToken);
    if (!authError && authData.user) {
      user = authData.user;
    }
  }

  // 2. Cookie Session Auth Fallback
  if (!user) {
    try {
      const cookieClient = createRouteHandlerClient({ cookies });
      const { data: cookieData, error: cookieError } = await cookieClient.auth.getUser();
      if (!cookieError && cookieData.user) {
        user = cookieData.user;
      }
    } catch {
      // Cookie parsing fallback failed or unavailable
    }
  }

  return { user, adminClient };
}
