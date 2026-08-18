import { test, expect } from '@playwright/test';

// Invitation landing page (`/invite/[token]`). Covers the invalid-token error
// branch (deterministic, no auth) and the valid-token choice screen is exercised
// at the API level in api-routes.spec.ts. A bogus token → GET /api/invite/accept
// returns { valid:false } → the page shows an error card.

test.describe('Invite landing', () => {
  test('a bogus token shows the invalid-invitation error', async ({ page }) => {
    await page.goto('/invite/this-token-does-not-exist-e2e');
    // REASON_MSG.invalid is hardcoded English, not translated.
    await expect(page.getByText(/Invalid or expired invitation link/i)).toBeVisible({ timeout: 30_000 });
    // Error card offers a way home.
    await expect(page.getByRole('link').first()).toBeVisible();
  });

  test('an empty-ish token still resolves to the invalid state (no crash)', async ({ page }) => {
    await page.goto('/invite/x');
    await expect(page.getByText(/Invalid or expired invitation link/i)).toBeVisible({ timeout: 30_000 });
  });
});
