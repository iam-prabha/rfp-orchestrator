import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createMiddlewareClient({ req: request, res: response });
  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith('/dashboard') && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }
  if ((pathname === '/login' || pathname === '/signup') && user) return NextResponse.redirect(new URL('/dashboard', request.url));
  return response;
}

export const config = { matcher: ['/dashboard/:path*', '/login', '/signup'] };
