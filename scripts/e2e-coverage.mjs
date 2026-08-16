// API + unit coverage: runs the phase E2E scripts and the vitest unit suite,
// parses their output into structured suites, and (standalone) prints a console
// table + writes an HTML coverage report. e2e-full.mjs reuses runApiSuites() and
// adds the Playwright UI suite. Requires the dev server for the API suites.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { printConsole, writeHtmlReport } from './e2e-report.mjs';

const API_SUITES = [
  { name: 'Unit — CEFR evaluator & cost calculator', kind: 'tap', cmd: 'npx vitest run --reporter=tap' },
  { name: 'API — Phase 1: limits, status, JD visibility', kind: 'check', cmd: 'node scripts/test-phase1.mjs' },
  { name: 'API — Phase 2: super-admin company management', kind: 'check', cmd: 'node scripts/test-phase2.mjs' },
  { name: 'API — Phase 3: manager team & invitations', kind: 'check', cmd: 'node scripts/test-phase3.mjs' },
];
// Declared but not run, so the report is honest about what isn't covered.
const SKIPPED = [
  { name: 'API — Practice / live LLM assessment', skipped: true, reason: 'Requires a live LLM provider (currently unavailable — see e2e-run.mjs / e2e:practice)' },
];

const BASE = 'http://localhost:3000';
// Pre-compile the dev server's API routes so the first real suite call doesn't
// race a cold compile (which manifests as a transient fetch failure). Each hit
// is unauthenticated (returns 401/403/400) but still triggers compilation.
export async function warmup() {
  const hit = async (method, path, body) => {
    try { await fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(25000) }); } catch { /* ignore */ }
  };
  await Promise.all([
    hit('POST', '/api/admin', { action: 'warm' }),
    hit('POST', '/api/team', { action: 'warm' }),
    hit('POST', '/api/lesson/start', {}),
    hit('GET', '/api/invite/accept?token=warm'),
  ]);
}

function parseCheck(out) {
  const cases = [];
  for (const line of out.split('\n')) {
    const m = line.match(/^\s*(✅|❌)\s+(.+?)\s*$/);
    if (!m) continue;
    const ok = m[1] === '✅';
    const [name, ...rest] = m[2].split(' — ');
    cases.push({ name: name.trim(), ok, detail: rest.join(' — ').trim() || undefined });
  }
  return cases;
}
function parseTap(out) {
  const cases = [];
  for (const line of out.split('\n')) {
    const m = line.match(/^(ok|not ok)\s+\d+\s+-\s+(.+?)\s*$/);
    if (!m) continue;
    if (/# SKIP/i.test(line)) continue;
    cases.push({ name: m[2].replace(/\s*>\s*/g, ' › ').trim(), ok: m[1] === 'ok' });
  }
  return cases;
}

function runOne(s) {
  const r = spawnSync(s.cmd, { shell: true, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const stdout = (r.stdout || '') + (r.stderr || '');
  const cases = s.kind === 'tap' ? parseTap(stdout) : parseCheck(stdout);
  return { cases, status: r.status, tail: stdout.trim().split('\n').slice(-3).join(' | ') };
}

export function runApiSuites({ log = true } = {}) {
  const out = [];
  for (const s of API_SUITES) {
    if (log) console.log(`▶ ${s.name} …`);
    const t0 = Date.now();
    let res = runOne(s);
    // Zero parsed cases + non-zero exit usually means a transient (e.g. a cold
    // dev-server fetch hiccup) that printed no check lines — retry once.
    if (res.cases.length === 0 && res.status !== 0) {
      if (log) console.log(`  ↻ retrying ${s.name} (transient)…`);
      res = runOne(s);
    }
    const cases = res.cases.length ? res.cases : [{ name: 'suite executed', ok: res.status === 0, detail: res.status === 0 ? undefined : `exit ${res.status} — ${res.tail}` }];
    out.push({ name: s.name, kind: s.kind, cases, durationMs: Date.now() - t0 });
  }
  return [...out, ...SKIPPED];
}

// Standalone entry (cross-platform: compare resolved paths, not URL strings).
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  await warmup();
  const suites = runApiSuites();
  const sum = printConsole(suites);
  const html = writeHtmlReport(suites, null, { title: 'API + unit coverage', timestamp: new Date().toISOString() });
  fs.writeFileSync('coverage-report.html', html);
  console.log('  HTML report → coverage-report.html\n');
  process.exit(sum.ok ? 0 : 1);
}
