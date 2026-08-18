import { test, expect } from '@playwright/test';
import { login, MEMBER_EMAIL, TEAM_PW } from './fixtures';

// Session review page (`/dashboard/session/[id]`). A real reviewable session is
// produced by practice-flow.spec.ts (opt-in, live LLM); here we cover the
// deterministic branches: auth redirect (in auth.spec.ts) and the not-found
// state for an unknown id, plus that the page shell/structure loads.

test.describe('Session review', () => {
  test('unknown session id shows the not-found state', async ({ page }) => {
    await login(page, MEMBER_EMAIL, TEAM_PW);
    // A well-formed but non-existent UUID → getLessonDetail returns null.
    await page.goto('/dashboard/session/11111111-2222-3333-4444-555555555555');
    await expect(page.getByText('// session_not_found')).toBeVisible({ timeout: 30_000 });
    // Back link to the dashboard.
    await expect(page.getByRole('link', { name: /cd \.\.\/dashboard/ })).toBeVisible();
  });

  test('back link returns to the dashboard', async ({ page }) => {
    await login(page, MEMBER_EMAIL, TEAM_PW);
    await page.goto('/dashboard/session/11111111-2222-3333-4444-555555555555');
    await expect(page.getByText('// session_not_found')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('link', { name: /cd \.\.\/dashboard/ }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
