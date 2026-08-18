import { test, expect } from '@playwright/test';

// Landing page (`/`): hero, sections, pricing, footer, auth-aware nav, and the
// #demo EN/FR/PT language selector that swaps the embedded video source. These
// cover gaps not exercised by demo.spec.ts (which only checks a few hero bits).

test.describe('Landing page', () => {
  test('hero, nav and CTAs render', async ({ page }) => {
    await page.goto('/');
    // Branding + nav (auth-aware: logged out shows login()).
    await expect(page.getByText('SPEECK.AI').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('features()').first()).toBeVisible();
    await expect(page.getByText('workflow()').first()).toBeVisible();
    await expect(page.getByText('pricing()').first()).toBeVisible();
    await expect(page.getByText('login()').first()).toBeVisible();
    // Hero CTAs.
    await expect(page.getByText('start_training()').first()).toBeVisible();
    await expect(page.getByText('demo.run()').first()).toBeVisible();
  });

  test('features, workflow and pricing sections are present', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Voice-First Practice')).toBeVisible();
    await expect(page.getByText('Real Production Scenarios')).toBeVisible();
    await expect(page.getByText('Instant Feedback')).toBeVisible();
    // Pricing: three tiers ($0 / $12 / $299).
    await expect(page.getByText('$0').first()).toBeVisible();
    await expect(page.getByText('$12').first()).toBeVisible();
    await expect(page.getByText('$299').first()).toBeVisible();
  });

  test('#demo language selector swaps the video source (EN → FR → PT)', async ({ page }) => {
    await page.goto('/');
    const source = page.locator('#demo video source');

    // Default is English.
    await expect(source).toHaveAttribute('src', /\/demo\/demo-en\.mp4/, { timeout: 30_000 });

    // FR button (label is "🇫🇷 FR · A2 · TECH").
    await page.locator('#demo').getByRole('button', { name: /FR/ }).click();
    await expect(source).toHaveAttribute('src', /\/demo\/demo-fr\.mp4/);

    // PT button ("🇧🇷 PT · B1 · FINANCE").
    await page.locator('#demo').getByRole('button', { name: /PT/ }).click();
    await expect(source).toHaveAttribute('src', /\/demo\/demo-pt\.mp4/);

    // Back to EN.
    await page.locator('#demo').getByRole('button', { name: /EN/ }).click();
    await expect(source).toHaveAttribute('src', /\/demo\/demo-en\.mp4/);
  });

  test('try_it_live() links to the live demo', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /try_it_live\(\)/i })).toHaveAttribute('href', '/demo');
  });

  test('pricing plan CTAs point at signup', async ({ page }) => {
    await page.goto('/');
    // Every pricing CTA is a link to /auth/signup (there are also hero + footer links).
    const signupLinks = page.locator('a[href="/auth/signup"]');
    await expect(signupLinks.first()).toBeVisible({ timeout: 30_000 });
    expect(await signupLinks.count()).toBeGreaterThan(0);
  });
});
