// Full E2E harness (one command): runs the API + unit coverage suites AND the
// Playwright UI suite (real browser, chromium), then prints a combined console
// coverage table and writes a self-contained HTML coverage report. The Playwright
// run also produces its own HTML report (with per-step screenshots).
//
//   npm run e2e:full   → console table + coverage-report.html + playwright-report/
//
// Requires a running dev server (npm run dev) and Supabase env in .env.local.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { runApiSuites, warmup } from './e2e-coverage.mjs';
import { printConsole, writeHtmlReport } from './e2e-report.mjs';

console.log('\n▶ Warming up API routes (avoids cold-compile flakes) …');
await warmup();
console.log('▶ [1/2] API + unit suites …');
const apiSuites = runApiSuites();

console.log('\n▶ [2/2] Playwright UI suite (chromium, serial — real browser) …');
fs.mkdirSync('test-results', { recursive: true });
const jsonPath = 'test-results/pw-results.json';
try { fs.rmSync(jsonPath, { force: true }); } catch { /* ignore */ }
const r = spawnSync(
  'npx playwright test --project=chromium --workers=1 e2e/admin-panel.spec.ts e2e/team-panel.spec.ts --reporter=json',
  { shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: jsonPath } }
);

let uiSuite;
try {
  const j = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const cases = [];
  const walk = (suite, prefix) => {
    const title = (suite.title || '').replace(/\.spec\.ts$/, '');
    const p = prefix ? `${prefix} › ${title}` : title;
    for (const spec of suite.specs || []) cases.push({ name: `${p} › ${spec.title}`, ok: !!spec.ok });
    for (const sub of suite.suites || []) walk(sub, p);
  };
  for (const s of j.suites || []) walk(s, '');
  if (!cases.length) cases.push({ name: 'playwright run', ok: r.status === 0, detail: r.status === 0 ? undefined : `exit ${r.status}` });
  uiSuite = { name: 'UI — Playwright (admin + team panels, real browser)', kind: 'ui', cases, durationMs: j.stats?.duration || 0 };
} catch {
  uiSuite = { name: 'UI — Playwright (admin + team panels, real browser)', kind: 'ui', cases: [{ name: 'playwright run', ok: r.status === 0, detail: r.status === 0 ? undefined : `exit ${r.status}` }] };
}

const all = [...apiSuites, uiSuite];
const sum = printConsole(all);
const html = writeHtmlReport(all, null, { title: 'Full E2E — API + unit + UI', timestamp: new Date().toISOString() });
fs.writeFileSync('coverage-report.html', html);
console.log('  📄 HTML coverage report → coverage-report.html');
console.log('  🎭 Playwright report (with screenshots) → npx playwright show-report\n');
process.exit(sum.ok ? 0 : 1);
