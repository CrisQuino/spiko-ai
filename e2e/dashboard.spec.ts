import { test, expect } from '@playwright/test';
import { login, MANAGER_EMAIL, MEMBER_EMAIL, TEAM_PW, ADMIN_EMAIL, ADMIN_PW } from './fixtures';

// Individual dashboard (`/dashboard`): full analytics view, global filters, KPI
// cards, recent conversations, quick actions — plus the paywall gate and the
// admin-access denial. The full dashboard is exercised with a corporate manager
// (never paywalled); the paywall UI is verified only when it is actually shown.

test.describe('Individual dashboard — full view', () => {
  test('renders KPI cards, filters and panels for a corporate user', async ({ page }) => {
    await login(page, MANAGER_EMAIL, TEAM_PW);
    await page.goto('/dashboard');

    // Corporate users are never paywalled → the real dashboard renders.
    await expect(page.getByText(/recent_conversations/)).toBeVisible({ timeout: 30_000 });

    // Global language filter buttons.
    await expect(page.getByRole('button', { name: 'Global' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'EN', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'FR', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'PT', exact: true })).toBeVisible();

    // KPI StatCards (titles are rendered verbatim).
    await expect(page.getByText('totalConversations')).toBeVisible();
    await expect(page.getByText('averageScore')).toBeVisible();
    await expect(page.getByText('practice_time')).toBeVisible();
    await expect(page.getByText('last_activity')).toBeVisible();

    // Quick actions.
    await expect(page.getByRole('button', { name: /start_practice\(\)/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /view_history\(\)|hide_history\(\)/ })).toBeVisible();
    // Managers get the team_dashboard() shortcut.
    await expect(page.getByRole('link', { name: /team_dashboard\(\)/ })).toBeVisible();
  });

  test('language filter is interactive and history toggles', async ({ page }) => {
    await login(page, MEMBER_EMAIL, TEAM_PW);
    await page.goto('/dashboard');
    await expect(page.getByText(/recent_conversations|no_conversations/)).toBeVisible({ timeout: 30_000 });

    // Toggle a language filter (should not error / panels stay mounted).
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(page.getByText('totalConversations')).toBeVisible();

    // Hide/show history toggle.
    const toggle = page.getByRole('button', { name: /view_history\(\)|hide_history\(\)/ });
    await toggle.click();
    await expect(toggle).toBeVisible();

    // Settings nav link present.
    await expect(page.getByRole('link', { name: /settings\(\)/ })).toBeVisible();
  });

  test('start_practice() opens the practice setup modal', async ({ page }) => {
    await login(page, MEMBER_EMAIL, TEAM_PW);
    await page.goto('/dashboard');
    await expect(page.getByRole('button', { name: /start_practice\(\)/ }).first()).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: /start_practice\(\)/ }).first().click();
    // PracticeSetup renders in a .max-w-lg modal with its own start button.
    await expect(page.locator('.max-w-lg')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Individual dashboard — paywall gate', () => {
  // The paywall shows for FREE individuals when free_dashboard_enabled is off.
  // The seeded admin account is a free-channel user that is NOT the hardcoded
  // dashboard owner, so it either sees the paywall or the dashboard depending on
  // the live platform setting — assert whichever branch is presented.
  test('free user sees either the paywall or the dashboard (deterministic branch check)', async ({ page }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PW);
    await page.goto('/dashboard');

    const paywall = page.getByRole('button', { name: /subscribe\(\)/ });
    const dashboard = page.getByText(/recent_conversations/);
    // One of the two branches must render.
    await expect(paywall.or(dashboard)).toBeVisible({ timeout: 30_000 });

    if (await paywall.isVisible().catch(() => false)) {
      // Paywall branch: verify the upsell UI.
      await expect(page.getByRole('button', { name: /keep_practicing\(\)/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /home\(\)/ })).toBeVisible();
    }
  });
});

test.describe('Admin access gate', () => {
  test('non-super-admin sees access.denied() on /admin', async ({ page }) => {
    await login(page, MEMBER_EMAIL, TEAM_PW);
    await page.goto('/admin');
    await expect(page.getByText('access.denied()')).toBeVisible({ timeout: 30_000 });
  });
});
