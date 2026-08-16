// Shared reporting for the E2E coverage harness: a console table and a
// self-contained HTML coverage report. Consumed by e2e-coverage.mjs (API +
// unit) and e2e-full.mjs (adds the Playwright UI suite).
//
// A "suite" is { name, kind, cases: [{ name, ok, detail }], skipped?, reason?,
// durationMs? }. Everything below is pure formatting — no side effects beyond
// writing the HTML file / printing.

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function summarize(suites) {
  let total = 0, passed = 0, failed = 0, skippedSuites = 0;
  for (const s of suites) {
    if (s.skipped) { skippedSuites += 1; continue; }
    for (const c of s.cases) { total += 1; c.ok ? (passed += 1) : (failed += 1); }
  }
  return { total, passed, failed, skippedSuites, suites: suites.length, ok: failed === 0 };
}

export function printConsole(suites) {
  const bar = '─'.repeat(64);
  console.log(`\n${bar}\n  FUNCTIONALITY COVERAGE\n${bar}`);
  for (const s of suites) {
    if (s.skipped) {
      console.log(`\n  ⃝  ${s.name}  [SKIPPED] — ${s.reason || ''}`);
      continue;
    }
    const p = s.cases.filter((c) => c.ok).length;
    const light = p === s.cases.length ? '🟢' : p === 0 ? '🔴' : '🟡';
    console.log(`\n  ${light} ${s.name}  (${p}/${s.cases.length})${s.durationMs != null ? `  ${(s.durationMs / 1000).toFixed(1)}s` : ''}`);
    for (const c of s.cases) console.log(`      ${c.ok ? '✅' : '❌'} ${c.name}${!c.ok && c.detail ? ` — ${c.detail}` : ''}`);
  }
  const sum = summarize(suites);
  console.log(`\n${bar}`);
  console.log(`  ${sum.ok ? '✅ ALL PASSED' : '❌ ' + sum.failed + ' FAILED'}  ·  ${sum.passed}/${sum.total} checks across ${sum.suites} suites${sum.skippedSuites ? ` (${sum.skippedSuites} skipped)` : ''}`);
  console.log(`${bar}\n`);
  return sum;
}

export function writeHtmlReport(suites, outPath, meta = {}) {
  const sum = summarize(suites);
  const pct = sum.total ? Math.round((sum.passed / sum.total) * 100) : 0;
  const card = (s) => {
    if (s.skipped) {
      return `<div class="suite skip"><div class="shead"><span class="dot"></span><h2>${esc(s.name)}</h2><span class="tag">SKIPPED</span></div><p class="reason">${esc(s.reason || '')}</p></div>`;
    }
    const p = s.cases.filter((c) => c.ok).length;
    const cls = p === s.cases.length ? 'pass' : p === 0 ? 'fail' : 'partial';
    const rows = s.cases.map((c) => `<li class="${c.ok ? 'ok' : 'bad'}"><span class="mk">${c.ok ? '✓' : '✕'}</span><span class="cn">${esc(c.name)}</span>${!c.ok && c.detail ? `<span class="cd">${esc(c.detail)}</span>` : ''}</li>`).join('');
    return `<div class="suite ${cls}"><div class="shead"><span class="dot"></span><h2>${esc(s.name)}</h2><span class="tag">${p}/${s.cases.length}${s.durationMs != null ? ` · ${(s.durationMs / 1000).toFixed(1)}s` : ''}</span></div><ul>${rows}</ul></div>`;
  };
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SPIKO — Coverage Report</title>
<style>
:root{--bg:#0b0f14;--panel:#131a22;--ln:#223;--fg:#e8eef5;--mut:#8aa0b4;--ok:#10b981;--bad:#ef4444;--warn:#f59e0b;--accent:#06b6d4}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.wrap{max-width:1000px;margin:0 auto;padding:32px 20px 64px}
h1{font-size:22px;margin:0 0 4px}.sub{color:var(--mut);margin:0 0 24px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:28px}
.kpi{background:var(--panel);border:1px solid var(--ln);border-radius:12px;padding:16px}
.kpi .v{font-size:26px;font-weight:700}.kpi .l{color:var(--mut);font-size:12px}
.gauge{height:10px;background:#0006;border-radius:999px;overflow:hidden;margin-top:10px}
.gauge>i{display:block;height:100%;background:linear-gradient(90deg,var(--ok),var(--accent))}
.suite{background:var(--panel);border:1px solid var(--ln);border-left-width:4px;border-radius:12px;margin:14px 0;overflow:hidden}
.suite.pass{border-left-color:var(--ok)}.suite.fail{border-left-color:var(--bad)}.suite.partial{border-left-color:var(--warn)}.suite.skip{border-left-color:var(--mut);opacity:.75}
.shead{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--ln)}
.shead h2{font-size:15px;margin:0;flex:1}.tag{color:var(--mut);font-size:12px}
.dot{width:10px;height:10px;border-radius:50%}.pass .dot{background:var(--ok)}.fail .dot{background:var(--bad)}.partial .dot{background:var(--warn)}.skip .dot{background:var(--mut)}
ul{list-style:none;margin:0;padding:8px 16px}li{display:flex;align-items:baseline;gap:10px;padding:5px 0;border-bottom:1px solid #1c252e}li:last-child{border:0}
.mk{width:14px}.ok .mk{color:var(--ok)}.bad .mk{color:var(--bad)}.cn{flex:1}.cd{color:var(--bad);font-size:12px}
.reason{color:var(--mut);padding:12px 16px;margin:0;font-size:13px}
.ft{color:var(--mut);font-size:12px;margin-top:24px;text-align:center}
.big{font-size:15px;font-weight:700}.big.ok{color:var(--ok)}.big.bad{color:var(--bad)}
</style></head><body><div class="wrap">
<h1>SPIKO · Functionality Coverage</h1>
<p class="sub">${esc(meta.title || 'End-to-end coverage across API, unit, and UI suites')} · ${esc(meta.timestamp || '')}</p>
<div class="kpis">
<div class="kpi"><div class="v ${sum.ok ? 'ok' : 'bad'}" style="color:${sum.ok ? 'var(--ok)' : 'var(--bad)'}">${pct}%</div><div class="l">checks passing</div><div class="gauge"><i style="width:${pct}%"></i></div></div>
<div class="kpi"><div class="v">${sum.passed}/${sum.total}</div><div class="l">checks passed</div></div>
<div class="kpi"><div class="v" style="color:${sum.failed ? 'var(--bad)' : 'var(--fg)'}">${sum.failed}</div><div class="l">checks failed</div></div>
<div class="kpi"><div class="v">${sum.suites}</div><div class="l">suites${sum.skippedSuites ? ` · ${sum.skippedSuites} skipped` : ''}</div></div>
</div>
<p class="big ${sum.ok ? 'ok' : 'bad'}">${sum.ok ? '✓ ALL CHECKS PASSED' : '✕ ' + sum.failed + ' CHECK(S) FAILED'}</p>
${suites.map(card).join('\n')}
<p class="ft">Generated by scripts/e2e-full.mjs · ${esc(meta.commit || '')}</p>
</div></body></html>`;
  // Written by the caller via fs to keep this module side-effect-light? We write here for convenience.
  return html;
}
