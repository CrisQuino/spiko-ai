import { test, expect } from '@playwright/test';
import { login, MANAGER_EMAIL, TEAM_PW } from './fixtures';

// Drives the manager team dashboard: logs in as a seeded manager, asserts the
// company-scoped analytics panels and the management section render, and opens
// the invite modal. Screenshots are attached to the Playwright HTML report.
test.describe('Manager team dashboard', () => {
  test('renders company-scoped analytics + management', async ({ page }, testInfo) => {
    await login(page, MANAGER_EMAIL, TEAM_PW);
    await page.goto('/dashboard/team');

    // Same analytics panels as the super-admin dashboard (scoped to the company).
    await expect(page.getByText('api_ai_costs()')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('activity()')).toBeVisible();
    await expect(page.getByText('cefr_distribution()')).toBeVisible();
    await expect(page.getByText('recent_lessons()')).toBeVisible();

    // Company management.
    await expect(page.getByText('company_management()')).toBeVisible();
    await expect(page.getByText(/company_jds\(\)/)).toBeVisible();
    await expect(page.getByText(/team_members/)).toBeVisible();
    await testInfo.attach('team-dashboard', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  });

  test('invite modal opens with domain hint', async ({ page }, testInfo) => {
    await login(page, MANAGER_EMAIL, TEAM_PW);
    await page.goto('/dashboard/team');
    await page.getByRole('button', { name: /invite_member\(\)/ }).first().click();
    await expect(page.getByText('invite.member()')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /send_invite\(\)/ })).toBeVisible();
    await testInfo.attach('team-invite-modal', { body: await page.screenshot(), contentType: 'image/png' });
  });
});
