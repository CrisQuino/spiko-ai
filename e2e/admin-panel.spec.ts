import { test, expect } from '@playwright/test';
import { login, ADMIN_EMAIL, ADMIN_PW } from './fixtures';

// Drives the real super-admin dashboard UI: logs in, asserts every panel renders,
// and captures screenshots per step (attached to the Playwright HTML report).
test.describe('Super-admin dashboard', () => {
  test('renders analytics + management panels', async ({ page }, testInfo) => {
    await login(page, ADMIN_EMAIL, ADMIN_PW);
    await page.goto('/admin');

    // Analytics panels (shared component).
    await expect(page.getByText('api_ai_costs()')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('activity()')).toBeVisible();
    await expect(page.getByText(/top_users\(\)/)).toBeVisible();
    await expect(page.getByText('cefr_distribution()')).toBeVisible();
    await expect(page.getByText('recent_lessons()')).toBeVisible();
    await testInfo.attach('admin-analytics', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });

    // Super-admin management.
    await expect(page.getByText('super_admin()')).toBeVisible();
    await expect(page.getByText(/platform_settings\(\)/)).toBeVisible();
    await expect(page.getByText(/companies\(\)/)).toBeVisible();
    await expect(page.getByText('account_access()')).toBeVisible();
  });

  test('account_access search filters live', async ({ page }, testInfo) => {
    await login(page, ADMIN_EMAIL, ADMIN_PW);
    await page.goto('/admin');
    const search = page.getByPlaceholder(/type to search by email/i);
    await expect(search).toBeVisible({ timeout: 30_000 });
    await search.fill('demo-user');
    // Live (debounced) search should surface a ban control for a B2C match.
    await expect(page.getByRole('button', { name: 'ban()' }).first()).toBeVisible({ timeout: 15_000 });
    await testInfo.attach('account-access-search', { body: await page.screenshot(), contentType: 'image/png' });
  });
});
