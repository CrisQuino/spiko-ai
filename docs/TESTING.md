# Automated testing & workflows

One command runs everything and prints a functionality-coverage report:

```bash
npm run dev          # in one terminal (the E2E suites hit the running app)
npm run e2e:full     # in another terminal
```

`e2e:full` runs the **API + unit** suites and the **Playwright UI** suite, then:

- prints a **console coverage table** (traffic-light per suite, PASS/FAIL per check),
- writes a self-contained **`coverage-report.html`** (open it in a browser),
- produces the **Playwright HTML report** with per-step screenshots — open it with `npm run e2e:report`.

Exit code is non-zero if any check fails, so it drops straight into CI.

## Prerequisites

- `npm install` (Playwright's Chromium is already installed in this repo).
- **`.env.local`** with the Supabase keys (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`) — the suites resolve the service-role key via the Management API to seed/verify data.
- A **running dev server** (`npm run dev`) on `http://localhost:3000`.

## Commands

| Command | What it runs |
|---|---|
| `npm run e2e:full` | **Everything**: API + unit + Playwright UI → console table + `coverage-report.html` + Playwright report |
| `npm run e2e:coverage` | API + unit only → console table + `coverage-report.html` |
| `npm run test:e2e` | Playwright only (all specs, all browser projects) |
| `npm run e2e:report` | Open the last Playwright HTML report (screenshots) |
| `npm run test` | Vitest unit tests (watch) — `npm run test -- --run` for one-shot |
| `npm run ci` | lint + typecheck + unit + build (no server needed) |
| `node scripts/test-phase1.mjs` | Phase 1 gates only (limits / status / JD visibility) |
| `node scripts/test-phase2.mjs` | Phase 2 super-admin API only |
| `node scripts/test-phase3.mjs` | Phase 3 manager/team API only |
| `npm run e2e:practice` | Live practice / LLM assessment run (**needs a working LLM provider**) |

## Coverage map

`e2e:full` aggregates these suites (the console table + `coverage-report.html` show every check):

- **Unit** — CEFR evaluator & cost calculator (`vitest`, `src/lib/__tests__`).
- **API — Phase 1** — free/corporate usage limits, account status + revocation, JD visibility, JD cap trigger.
- **API — Phase 2** — super-admin: companies CRUD, invite manager, member roles, remove/ban/delete users, company-JD CRUD, invite-domain policy, platform settings, B2C user list.
- **API — Phase 3** — manager team: overview, invite/accept lifecycle, seat/domain/dup guards, remove/co-manager, company-scoped analytics, domain mode, company-JD CRUD.
- **UI — Playwright** (real browser, chromium): super-admin dashboard renders + account_access live search; manager team dashboard renders (company-scoped analytics + management) + invite modal. Screenshots attached to the Playwright report.
- **Practice / LLM** — listed as **skipped** by default (requires a live LLM provider). Run it explicitly with `npm run e2e:practice`.

## Notes

- The Playwright UI suite auto-seeds its accounts/company via `e2e/global-setup.ts` (idempotent) and runs **serially** (`--workers=1`) so the dev server's on-demand route compilation doesn't cause cold-compile flakes.
- Test data uses throwaway domains (`*.spiko-test.example`, `*.e2eui.example`, `*.p3team.example`). Real/demo accounts (e.g. `spiko-e2e@…`, `demo-user-*`) and `QuinoCorp` are left untouched.
- All accounts the local dashboard gate honors come from `NEXT_PUBLIC_SUPER_ADMIN_EMAILS` in `.env.local` (production defaults to the owner only).
