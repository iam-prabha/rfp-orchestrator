import { middleware } from '../../middleware';
import { NextRequest } from 'next/server';

let mockGetUser = jest.fn();

jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createMiddlewareClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
  }),
}));

describe('Auth Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createMockRequest(pathname: string, cookies: Record<string, string> = {}) {
    const url = `https://rfp-orchestrator.com${pathname}`;
    const req = new NextRequest(url);
    for (const [name, value] of Object.entries(cookies)) {
      req.cookies.set(name, value);
    }
    return req;
  }

  it('allows authenticated user to access /dashboard', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@example.com' } },
      error: null,
    });

    const req = createMockRequest('/dashboard');
    const res = await middleware(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects unauthenticated user from /dashboard to /login?next=/dashboard', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const req = createMockRequest('/dashboard');
    const res = await middleware(req);

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('/login?next=%2Fdashboard');
  });

  it('clears supabase auth cookies when refresh token is invalid', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid Refresh Token: Refresh Token Not Found', status: 400 },
    });

    const req = createMockRequest('/dashboard', {
      'sb-access-token': 'expired-token',
      'sb-refresh-token': 'bad-token',
      'other-cookie': 'keep-me',
    });

    const res = await middleware(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login?next=%2Fdashboard');
  });
});
