import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createMiddlewareClient({ req: request, res: response });
  const pathname = request.nextUrl.pathname;

  let user = null;
  let hasInvalidRefreshToken = false;

  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user) {
      user = data.user;
    } else if (error) {
      if (
        error.message?.includes('Refresh Token') ||
        error.message?.includes('refresh_token') ||
        (error as any).status === 400
      ) {
        hasInvalidRefreshToken = true;
      }
    }
  } catch (err: any) {
    if (
      err?.message?.includes('Refresh Token') ||
      err?.message?.includes('refresh_token') ||
      err?.status === 400
    ) {
      hasInvalidRefreshToken = true;
    }
    user = null;
  }

  // If refresh token is expired or invalid, clear all supabase auth cookies
  if (hasInvalidRefreshToken) {
    const allCookies = request.cookies.getAll();
    for (const cookie of allCookies) {
      if (cookie.name.includes('supabase') || cookie.name.startsWith('sb-')) {
        response.cookies.delete(cookie.name);
      }
    }
  }

  const isProtectedPath = pathname.startsWith('/dashboard') || pathname === '/profile';

  if (isProtectedPath && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    // Forward any cleared cookie headers
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') {
        redirectResponse.headers.append(key, value);
      }
    });
    return redirectResponse;
  }

  if ((pathname === '/login' || pathname === '/signup') && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = { matcher: ['/dashboard/:path*', '/profile', '/login', '/signup'] };
