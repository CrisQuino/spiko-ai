import { test, expect, Page } from '@playwright/test';

// End-to-end walkthrough of the authenticated practice flow, driven via the
// text input (no microphone). Requires a seeded test user + JD (see _e2e_seed.mjs).
// Credentials come from env so the spec carries no secrets.
const EMAIL = process.env.E2E_EMAIL || 'spiko-e2e@example.com';
const PASSWORD = process.env.E2E_PASSWORD || 'Test-e2e-Passw0rd!';
const JD_TITLE = process.env.E2E_JD_TITLE || 'Director, Software Engineering';

// Opt-in: needs a seeded test user + JD (scripts/e2e-seed.mjs) and makes real
// LLM calls, so it is skipped by default (e.g. in CI). Run with E2E_RUN=1.
test.skip(!process.env.E2E_RUN, 'Set E2E_RUN=1 after seeding a test user (scripts/e2e-seed.mjs)');

const bubbles = (page: Page) => page.locator('p.text-sm.leading-relaxed');
const responseInput = (page: Page) => page.getByPlaceholder(/response|réponse|resposta/i);

async function login(page: Page) {
  await page.goto('/auth/login');
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('input[type="password"]').press('Enter');
  await page.waitForURL(/.*dashboard/, { timeout: 30_000 });
}

async function openSetupAndStart(page: Page, langLabel: RegExp, level: string) {
  // Open the Practice Setup modal from the dashboard.
  await page.getByRole('button', { name: /start_practice|start_first_practice/i }).first().click();

  const modal = page.locator('.max-w-lg');
  await expect(modal).toBeVisible({ timeout: 10_000 });

  // 1. language, 2. level, 3. job description (seeded → preselected).
  await modal.getByRole('button', { name: langLabel }).click();
  await modal.getByRole('button', { name: level, exact: true }).click();
  await modal.locator('select').selectOption({ label: JD_TITLE });

  await modal.getByRole('button', { name: /start_practice/i }).click();

  // Now on /demo intro screen → begin the scenario.
  await expect(page).toHaveURL(/.*demo\?/, { timeout: 15_000 });
  await page.getByRole('button', { name: /scenario\.start/i }).click({ timeout: 15_000 });
}

async function say(page: Page, text: string) {
  const before = await bubbles(page).count();
  await responseInput(page).fill(text);
  await responseInput(page).press('Enter');
  // user bubble appears immediately, AI reply follows after the LLM call.
  await expect.poll(() => bubbles(page).count(), { timeout: 40_000 }).toBeGreaterThan(before + 1);
}

async function runScenario(page: Page, langLabel: RegExp, level: string, userTurns: string[]) {
  await login(page);
  await openSetupAndStart(page, langLabel, level);

  // Opener (an AI bubble) must appear.
  await expect(responseInput(page)).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => bubbles(page).count(), { timeout: 40_000 }).toBeGreaterThan(0);

  const opener = (await bubbles(page).first().innerText()).trim();
  console.log('\n===== OPENER (' + level + ') =====\n' + opener + '\n');
  expect(opener.length).toBeGreaterThan(10);

  for (const turn of userTurns) {
    await say(page, turn);
    const last = (await bubbles(page).last().innerText()).trim();
    console.log('----- AI reply -----\n' + last + '\n');
    expect(last.length).toBeGreaterThan(5);
  }
}

test.describe('Practice flow (JD-driven, authenticated)', () => {
  test('English — Director JD at B2', async ({ page }) => {
    test.setTimeout(180_000);
    await runScenario(page, /English/, 'B2', [
      'Thanks for flagging this. What exactly is the budget shortfall, and which teams are affected?',
      'Let me align finance and the team leads. I will prioritize the payment reliability work first.',
    ]);
  });

  test('French — Director JD at A2', async ({ page }) => {
    test.setTimeout(180_000);
    await runScenario(page, /Français/, 'A2', [
      'Bonjour. Quel est le problème exactement ?',
      'D accord. Je vais parler avec les chefs d équipe et décider des priorités.',
    ]);
  });
});
