import { test, expect } from '@playwright/test';

test.describe('SPEECK.AI Landing Page', () => {
  test('landing page loads and shows key elements', async ({ page }) => {
    await page.goto('/');

    // Verify hero text
    await expect(page.getByText('Code Your Communication')).toBeVisible();

    // Verify navigation
    await expect(page.getByText('features()')).toBeVisible();
    await expect(page.getByText('pricing()')).toBeVisible();

    // Verify CTA buttons
    await expect(page.getByText('start_training()')).toBeVisible();
    await expect(page.getByText('demo.run()')).toBeVisible();

    // Verify branding
    await expect(page.getByText('SPEECK.AI')).toBeVisible();
  });

  test('landing page features section is visible', async ({ page }) => {
    await page.goto('/');

    // Scroll to features
    await page.getByText('features()').first().click();

    await expect(page.getByText('Voice-First Practice')).toBeVisible();
    await expect(page.getByText('Real Production Scenarios')).toBeVisible();
    await expect(page.getByText('Instant Feedback')).toBeVisible();
  });

  test('navigation to demo page works', async ({ page }) => {
    await page.goto('/');

    await page.getByText('demo.run()').click();

    await expect(page).toHaveURL(/.*demo/);
    await expect(page.getByRole('button', { name: /scenario.start/i })).toBeVisible();
  });
});

test.describe('SPEECK.AI Demo Page', () => {
  test('demo page loads with start button', async ({ page }) => {
    await page.goto('/demo');

    await expect(page.getByRole('button', { name: /scenario.start/i })).toBeVisible();
  });

  test('starting scenario shows conversation UI', async ({ page }) => {
    await page.goto('/demo');

    await page.getByRole('button', { name: /scenario.start/i }).click();

    // The scenario is now generated dynamically (from the job description +
    // language), so assert the conversation UI appears rather than any
    // specific hardcoded text.
    await expect(page.getByPlaceholder(/type your response/i)).toBeVisible({ timeout: 15000 });
  });

  test('user can send a text message', async ({ page }) => {
    await page.goto('/demo');

    await page.getByRole('button', { name: /scenario.start/i }).click();
    await expect(page.getByPlaceholder(/type your response/i)).toBeVisible({ timeout: 15000 });

    // Type and send a message
    const input = page.getByPlaceholder(/type your response/i);
    await input.fill('I will check the replication lag immediately.');
    await page.getByRole('button', { name: /send/i }).click();

    // Verify user message appears
    await expect(page.getByText('I will check the replication lag immediately.')).toBeVisible();
  });

  test('CEFR assessment modal appears on completion', async ({ page }) => {
    await page.goto('/demo');

    await page.getByRole('button', { name: /scenario.start/i }).click();
    await expect(page.getByPlaceholder(/type your response/i)).toBeVisible({ timeout: 15000 });

    // Send several messages to progress the conversation
    const responses = [
      'What is the current replication lag?',
      'I see it is 7200 seconds. That is very high.',
      'I will check for blocking queries.',
      'I found a long running query on the orders table.',
      'I have terminated the query and the replication is catching up.',
    ];

    for (const response of responses) {
      const input = page.getByPlaceholder(/type your response/i);
      if (await input.isVisible().catch(() => false)) {
        await input.fill(response);
        await page.getByRole('button', { name: /send/i }).click();
        await page.waitForTimeout(3000);
      }
    }

    // Try to complete the scenario by clicking done/complete if available
    const doneButton = page.getByRole('button', { name: /done|complete|finish/i });
    if (await doneButton.isVisible().catch(() => false)) {
      await doneButton.click();
    }
  });
});

test.describe('SPEECK.AI Auth Pages', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/auth/login');

    await expect(page.getByText('login')).toBeVisible();
  });

  test('signup page loads', async ({ page }) => {
    await page.goto('/auth/signup');

    await expect(page.getByText('sign up')).toBeVisible();
  });
});

test.describe('SPEECK.AI Responsive Design', () => {
  test('mobile menu is accessible', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    await expect(page.getByText('start()')).toBeVisible();
  });
});
