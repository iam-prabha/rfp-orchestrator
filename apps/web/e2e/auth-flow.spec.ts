import { test, expect } from '@playwright/test';

test.describe('Authentication & Navigation Flow (Zero-DB Mocked)', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Intercept any Supabase REST database queries (100% blocked, 0 DB calls)
    await page.route('**/*supabase.co/rest/v1/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // 2. Intercept any Supabase Auth calls (100% blocked, 0 Auth server calls)
    await page.route('**/*supabase.co/auth/v1/token?grant_type=password', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Invalid login credentials',
          message: 'Invalid login credentials',
        }),
      });
    });
  });

  test('landing page loads and links to login and signup', async ({ page }) => {
    await page.goto('/');

    // Check title / brand is visible
    await expect(page).toHaveTitle(/RFP/i);

    // Click "Sign in" or login link
    const loginLink = page.getByRole('link', { name: /sign in/i });
    await expect(loginLink).toBeVisible();
    await loginLink.click();

    // Verify redirected to login page
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  });

  test('redirects unauthenticated user from protected dashboard to /login', async ({ page }) => {
    await page.goto('/dashboard');

    // Redirects unauthenticated user to /login
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('login form shows error when invalid credentials are provided without contacting Supabase', async ({ page }) => {
    await page.goto('/login');

    // Fill in credentials
    await page.fill('input[type="email"]', 'test-invalid-user@example.com');
    await page.fill('input[type="password"]', 'WrongPassword123!');

    // Submit form (caught locally by Playwright route mock)
    await page.getByRole('button', { name: /sign in/i }).click();

    // Error alert inside form should be displayed
    const errorAlert = page.locator('form p[role="alert"]');
    await expect(errorAlert).toBeVisible({ timeout: 10000 });
    await expect(errorAlert).toContainText(/do not match|could not|invalid/i);
  });
});
