// Records a demo walkthrough video of the authenticated practice flow: a user
// logs in, starts a practice scenario, and interacts with the AI role-play
// partner. Playwright records the real browser to a .webm, which we then embed
// on the landing page's demo control.
//
//   npm run dev        # in another terminal
//   npm run record:demo
//
// Output: public/demo/demo-walkthrough.webm
import { chromium } from 'playwright';
import fs from 'node:fs';

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const l = line.trim(); if (!l || l.startsWith('#') || !l.includes('=')) continue;
  const i = l.indexOf('='); env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
}
const BASE = 'http://localhost:3000';
const EMAIL = process.env.E2E_EMAIL || 'spiko-e2e@example.com';
const PASSWORD = process.env.E2E_PASSWORD || 'Test-e2e-Passw0rd!';
const OUT_DIR = 'public/demo';
const SIZE = { width: 1280, height: 720 };

// A natural, competent B2 incident-response exchange for a Backend Engineer.
const TURNS = [
  'Hi, thanks for the heads-up. What exactly is failing, and which service is affected?',
  "Okay, let me pull the logs and trace the failing request to see where the exception is thrown.",
  "It looks like a slow database query is timing out under load — I'll add an index and check the N+1 pattern.",
  "I'll write a quick regression test that reproduces the timeout before I ship the fix.",
  "Deploying to staging now, watching the latency metrics, then I'll roll it out to production.",
];

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir: OUT_DIR, size: SIZE } });
  const page = await context.newPage();
  const bubbles = () => page.locator('p.text-sm.leading-relaxed');
  const input = () => page.getByPlaceholder(/response|réponse|resposta/i);

  // 1) Log in.
  await page.goto(`${BASE}/auth/login`);
  await pause(1200);
  await page.locator('input[type="email"]').pressSequentially(EMAIL, { delay: 35 });
  await page.locator('input[type="password"]').pressSequentially(PASSWORD, { delay: 35 });
  await pause(500);
  await page.locator('input[type="password"]').press('Enter');
  await page.waitForURL(/.*dashboard/, { timeout: 30_000 });
  await pause(1800);

  // 2) Open practice setup and start a scenario.
  await page.getByRole('button', { name: /start_practice|start_first_practice/i }).first().click();
  const modal = page.locator('.max-w-lg');
  await modal.waitFor({ state: 'visible', timeout: 10_000 });
  await pause(900);
  await modal.getByRole('button', { name: /English/ }).click();
  await pause(500);
  await modal.getByRole('button', { name: 'B2', exact: true }).click();
  await pause(500);
  await modal.locator('select').selectOption({ label: 'Backend Engineer' }).catch(async () => {
    // Fall back to the first available JD if that exact title isn't seeded.
    const opts = await modal.locator('select option').all();
    if (opts.length > 1) await modal.locator('select').selectOption({ index: 1 });
  });
  await pause(800);
  await modal.getByRole('button', { name: /start_practice/i }).click();
  await page.waitForURL(/.*demo\?/, { timeout: 15_000 });
  await page.getByRole('button', { name: /scenario\.start/i }).click({ timeout: 15_000 });

  // 3) Wait for the AI opener, then converse.
  await input().waitFor({ state: 'visible', timeout: 20_000 });
  await page.locator('p.text-sm.leading-relaxed').first().waitFor({ timeout: 45_000 });
  await pause(2500);

  for (const turn of TURNS) {
    const before = await bubbles().count();
    await input().pressSequentially(turn, { delay: 22 });
    await pause(400);
    await input().press('Enter');
    // Wait for the AI reply (bubble count grows by user + ai).
    const start = Date.now();
    while ((await bubbles().count()) <= before + 1 && Date.now() - start < 45_000) await pause(500);
    await pause(2200); // let the viewer read the reply
  }
  await pause(2500);

  // 4) Finalize the video.
  const videoPath = await page.video()?.path();
  await context.close();
  await browser.close();

  if (videoPath && fs.existsSync(videoPath)) {
    const dest = `${OUT_DIR}/demo-walkthrough.webm`;
    fs.copyFileSync(videoPath, dest);
    console.log(`✓ recorded → ${dest} (${(fs.statSync(dest).size / 1e6).toFixed(1)} MB)`);
  } else {
    console.error('✕ no video produced');
    process.exit(1);
  }
}
main().catch((e) => { console.error('ERR', e); process.exit(1); });
