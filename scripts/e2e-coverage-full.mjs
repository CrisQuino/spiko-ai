// Functional route coverage: maps every route in the app to the Playwright
// spec(s) that cover it, then runs `playwright test --list` to confirm those
// specs are actually discovered, and prints a coverage matrix. Server-independent
// for the matrix itself (it only lists tests, it does not run them).
//
//   node scripts/e2e-coverage-full.mjs   →  route → spec matrix + % coverage
//
// This complements scripts/e2e-coverage.mjs (API + unit) and scripts/e2e-full.mjs
// (which runs the API + unit + Playwright UI suites for pass/fail results).
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// route → covering spec file(s). Keep in sync with docs/ROUTES.md.
const ROUTE_SPECS = [
  // Pages
  ['/', ['landing.spec.ts', 'demo.spec.ts']],
  ['/demo', ['demo.spec.ts', 'practice-flow.spec.ts']],
  ['/dashboard', ['dashboard.spec.ts', 'auth.spec.ts']],
  ['/dashboard/team', ['team-panel.spec.ts']],
  ['/dashboard/settings', ['auth.spec.ts', 'dashboard.spec.ts']],
  ['/dashboard/session/[id]', ['session-review.spec.ts', 'auth.spec.ts']],
  ['/admin', ['admin-panel.spec.ts', 'dashboard.spec.ts']],
  ['/auth/login', ['auth.spec.ts', 'demo.spec.ts']],
  ['/auth/signup', ['auth.spec.ts', 'demo.spec.ts']],
  ['/auth/callback', ['auth.spec.ts']],
  ['/auth/logout', ['auth.spec.ts']],
  ['/invite/[token]', ['invite.spec.ts', 'api-routes.spec.ts']],
  // API
  ['/api/auth/check', ['api-routes.spec.ts']],
  ['/api/chat', ['api-routes.spec.ts', 'practice-flow.spec.ts']],
  ['/api/evaluate', ['api-routes.spec.ts', 'practice-flow.spec.ts']],
  ['/api/tts', ['api-routes.spec.ts']],
  ['/api/lesson/start', ['api-routes.spec.ts', 'practice-flow.spec.ts']],
  ['/api/lesson/complete', ['api-routes.spec.ts', 'practice-flow.spec.ts']],
  ['/api/admin', ['api-routes.spec.ts', 'admin-panel.spec.ts']],
  ['/api/team', ['api-routes.spec.ts', 'team-panel.spec.ts']],
  ['/api/send-invite', ['api-routes.spec.ts']],
  ['/api/invite/accept', ['api-routes.spec.ts', 'invite.spec.ts']],
];

// Ask Playwright which tests exist (does NOT run them).
function discoveredSpecFiles() {
  const r = spawnSync('npx playwright test --list', { shell: true, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const out = (r.stdout || '') + (r.stderr || '');
  const files = new Set();
  // Lines look like: "[chromium] › landing.spec.ts:12:7 › Landing page › …"
  // (Playwright shows the path relative to testDir, so no e2e/ prefix.)
  for (const m of out.matchAll(/(?:e2e[\\/])?([\w.-]+\.spec\.ts):\d+/g)) files.add(m[1]);
  const total = (out.match(/Total:\s*(\d+)/) || [])[1] || null;
  return { files, raw: out, total };
}

function run() {
  const { files, total } = discoveredSpecFiles();
  const bar = '─'.repeat(72);
  console.log(`\n${bar}\n  FUNCTIONAL ROUTE COVERAGE  (route → covering spec)\n${bar}`);

  let covered = 0;
  const pad = (s, n) => (s.length >= n ? s : s + ' '.repeat(n - s.length));
  for (const [route, specs] of ROUTE_SPECS) {
    const present = specs.filter((s) => files.has(s));
    const ok = present.length > 0;
    if (ok) covered += 1;
    const mark = ok ? '🟢' : '🔴';
    const specList = specs.map((s) => (files.has(s) ? s : `${s}(?)`)).join(', ');
    console.log(`  ${mark} ${pad(route, 26)} ${specList}`);
  }

  const pct = Math.round((covered / ROUTE_SPECS.length) * 100);
  console.log(`${bar}`);
  console.log(`  ${covered}/${ROUTE_SPECS.length} routes covered (${pct}%)` + (total ? `  ·  ${total} tests discovered` : ''));
  console.log(`  spec files discovered: ${[...files].sort().join(', ') || '(none — is Playwright installed?)'}`);
  console.log(`${bar}\n`);

  return covered === ROUTE_SPECS.length;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const ok = run();
  process.exit(ok ? 0 : 1);
}

export { ROUTE_SPECS, discoveredSpecFiles };
