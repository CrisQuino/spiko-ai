// Shared constants for the Playwright UI suite. The accounts below are seeded by
// global-setup.ts against the Supabase project. ADMIN_EMAIL must be in the
// dashboard's super-admin allowlist (NEXT_PUBLIC_SUPER_ADMIN_EMAILS in .env.local).
export const ADMIN_EMAIL = 'p2-admin@spiko-test.example';
export const ADMIN_PW = 'Phase2-test-Passw0rd!';

export const MANAGER_EMAIL = 'ui-manager@e2eui.example';
export const MEMBER_EMAIL = 'ui-member@e2eui.example';
export const TEAM_PW = 'E2E-ui-Passw0rd!';
export const COMPANY_NAME = 'E2E UI Co';
export const COMPANY_SLUG = 'e2e-ui-co-uitest';

// Log in through the real UI (email/password form on /auth/login).
import type { Page } from '@playwright/test';
export async function login(page: Page, email: string, password: string) {
  await page.goto('/auth/login');
  await page.getByPlaceholder('you@company.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: /authenticate\(\)/i }).click();
  // Land on the dashboard (the app redirects there after login).
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 }).catch(() => {});
}
