import { test, expect } from '@playwright/test';

// Auth pages + auth-guarded redirects. Covers /auth/login, /auth/signup,
// /auth/callback, /auth/logout, and the "must be signed in" redirects for the
// dashboard/settings/session pages (gaps not covered by the other suites).

test.describe('Auth pages', () => {
  test('login page renders form + OAuth providers', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.getByText('auth.login()')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /auth\.google\(\)/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /auth\.microsoft\(\)/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /auth\.github\(\)/ })).toBeVisible();
    await expect(page.getByPlaceholder('you@company.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
    await expect(page.getByRole('button', { name: /authenticate\(\)/i })).toBeVisible();
  });

  test('invalid credentials show an inline error', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByPlaceholder('you@company.com').fill('nobody-e2e@invalid.example');
    await page.getByPlaceholder('••••••••').fill('definitely-wrong-password');
    await page.getByRole('button', { name: /authenticate\(\)/i }).click();
    // The page surfaces the Supabase error under "// error:".
    await expect(page.getByText(/\/\/ error:/i)).toBeVisible({ timeout: 20_000 });
    // Still on the login page (no redirect on failure).
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('signup page renders form + OAuth providers', async ({ page }) => {
    await page.goto('/auth/signup');
    await expect(page.getByText('auth.signup()')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /auth\.google\(\)/ })).toBeVisible();
    // Full name, email, company, password inputs.
    await expect(page.getByPlaceholder('you@company.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
    await expect(page.getByRole('button', { name: /create_account\(\)/i })).toBeVisible();
    // Link across to login.
    await expect(page.getByRole('link', { name: /auth\.login\(\)/ })).toBeVisible();
  });

  test('login <-> signup are cross-linked', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByRole('link', { name: /auth\.signup\(\)/ }).click();
    await expect(page).toHaveURL(/\/auth\/signup/);
  });

  test('callback page shows the completing-sign-in state', async ({ page }) => {
    await page.goto('/auth/callback');
    await expect(page.getByText(/Completing sign in/i)).toBeVisible({ timeout: 20_000 });
  });

  test('logout page signs out and redirects home', async ({ page }) => {
    await page.goto('/auth/logout');
    await expect(page).toHaveURL(/localhost:3000\/?$/, { timeout: 20_000 });
  });
});

test.describe('Auth-guarded redirects (signed out)', () => {
  test('/dashboard redirects to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 30_000 });
  });

  test('/dashboard/settings redirects to login', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 30_000 });
  });

  test('/dashboard/session/<id> redirects to login', async ({ page }) => {
    await page.goto('/dashboard/session/00000000-0000-0000-0000-000000000000');
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 30_000 });
  });
});
