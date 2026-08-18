# SPEECK.AI — Functional Route & Feature Map

Complete map of every route in the Next.js 14 app (`src/app`), its purpose, auth
requirement, user-visible features, and the happy-path + edge cases exercised (or
worth exercising) by the E2E suite in `e2e/`.

Legend for the **Spec** column points at the Playwright file that covers the route
(see `docs/` route→spec matrix printed by `scripts/e2e-coverage-full.mjs`).

---

## PAGES

### `/` — Landing (`src/app/page.tsx`)
- **Purpose:** Marketing landing; funnels visitors into signup / demo.
- **Auth:** Public. Auth-aware nav — the nav/CTA reads `login()` / `start()` when
  logged out and `dashboard()` / `go()` when logged in (`supabase.auth.getUser`).
- **Features:**
  - Hero (`masterTechEnglish()`, README code block, `start_training()` +
    `demo.run()` CTAs, trust badges).
  - `#demo` section with an **EN / FR / PT** language selector. Each button swaps
    the `<video>` `<source>` `src` to `/demo/demo-<lang>.mp4` (and the poster to
    `/demo/demo-<lang>-poster.jpg`). Labels show `flag · CEFR level · industry`.
  - `#features` (Voice-First Practice, Real Production Scenarios, Instant Feedback…),
    `#how-it-works` (numbered workflow steps), `#pricing` (3 plans: `$0`, `$12`
    popular, `$299`), footer.
  - `LanguageSwitcher` (UI i18n) in hero/features/pricing.
- **Happy path:** page loads, nav anchors scroll to sections, `demo.run()` → `/demo`,
  CTA → `/auth/signup`.
- **Edge cases:** demo selector switches video source per language; pricing plan
  CTAs all link to `/auth/signup`.
- **Spec:** `landing.spec.ts` (+ existing `demo.spec.ts`).

### `/demo` — Guest / authenticated practice (`src/app/demo/page.tsx`)
- **Purpose:** The live practice experience (guest = demo mode 2-min limit;
  authenticated = full 5-min).
- **Auth:** Public (works signed-out in demo mode; picks up session if present).
- **Features:**
  - Setup screen reads `?lang=&level=&jd=` from the URL; shows JD title + language.
  - `scenario.start()` begins the scenario → calls `/api/lesson/start` then
    `/api/chat` (opening turn returns TITLE + SPEAKER + first line).
  - Chat: text input (`type your response`), `send()`, voice mode (mic), audio TTS
    playback (`/api/tts`), live progress/phase, quick feedback.
  - Auto-completes on time limit → LLM CEFR evaluation (`/api/evaluate`) → CEFR
    assessment modal; background save via `/api/lesson/complete`; upsell to sign up.
- **Happy path:** start → conversation UI appears → send a message → user bubble shows.
- **Edge cases:** completion modal on progress=100/time-limit; opening-turn fallback
  line if `/api/chat` fails; demo vs full mode limits.
- **Spec:** `demo.spec.ts`, `practice-flow.spec.ts` (live-LLM, opt-in `E2E_RUN=1`).

### `/dashboard` — Individual dashboard (`src/app/dashboard/page.tsx`)
- **Purpose:** Personal analytics home.
- **Auth:** Required — redirects to `/auth/login` when signed out.
- **Features:**
  - **Paywall gate:** FREE individuals (no company, not premium, not super-admin)
    see `DashboardPaywall` (`subscribe()`, perks, `keep_practicing()`, `home()`,
    `logout()`) **unless** `platform_settings.free_dashboard_enabled` is true.
  - Full dashboard: welcome header, **global filters** (language `Global/EN/FR/PT`
    + date range) that drive every panel; 4 KPI StatCards (`totalConversations`,
    `averageScore`, `practice_time`, `last_activity`); `CefrTrendChart`;
    `recent_conversations` list (links to `/dashboard/session/<scenario_id>`);
    `quick_actions` (`start_practice()`, `view_history()/hide_history()`),
    `improvement_tips`; nav (`home()`, `practice()`, `settings()`, `logout()`).
  - Conditional buttons: `team_dashboard()` for managers, `admin_dashboard()` for
    the hardcoded owner (`dash.crs@gmail.com`).
  - `PracticeSetup` modal (language/level/JD → `/demo?…`).
  - `?error=admin_required` shows a dismissible banner.
- **Happy path (full):** manager/corporate user logs in → KPI cards + filters +
  recent_conversations render; toggling a language filter re-scopes panels.
- **Edge cases:** free user sees paywall; unauthenticated redirect; date-range
  narrowing hides out-of-range activity.
- **Spec:** `dashboard.spec.ts`.

### `/dashboard/team` — Manager team dashboard (`src/app/dashboard/team/page.tsx`)
- **Purpose:** Company-scoped management + analytics for managers.
- **Auth:** Required, `role = manager` (server enforces via `/api/team`).
- **Features:** company-scoped `DashboardAnalytics` (**priceView** — managers see
  marked-up *price*, never raw cost); `company_management()`, `company_jds()`,
  `team_members`, member JDs / promote, invites (`invite_member()` modal with
  domain hint, `send_invite()`), domain mode, `set_member_role`.
- **Happy path:** manager logs in → analytics panels + management render; invite
  modal opens.
- **Edge cases:** seat limits, domain mismatch, already-member/invited (API level).
- **Spec:** `team-panel.spec.ts` (existing).

### `/dashboard/settings` — Settings (`src/app/dashboard/settings/page.tsx`)
- **Purpose:** Profile / company / role management.
- **Auth:** Required — redirects to `/auth/login` when signed out.
- **Features:** profile info (name/email/role), company section (create company, or
  view team link for managers/admins), dev-only role toggles
  (`become_employee/manager`), sign out.
- **Happy path:** authenticated user sees profile + company section.
- **Edge cases:** unauthenticated redirect; no-company state shows create form.
- **Spec:** `auth.spec.ts` (unauth redirect), `dashboard.spec.ts` (nav link).

### `/dashboard/session/[id]` — Session review (`src/app/dashboard/session/[id]/page.tsx`)
- **Purpose:** Review a completed practice session.
- **Auth:** Required — redirects to `/auth/login` when signed out.
- **Features:** summary (date, duration, CEFR overall level, tokens); `cefr_metrics`
  breakdown (pronunciation/fluency/vocabulary/grammar/interaction/comprehension +
  scores, technical jargon); feedback (quick + final); `conversation` transcript.
- **Happy path:** valid id → metrics + transcript; a real reviewable session is
  produced by `practice-flow.spec.ts` (`/dashboard/session/<id>`).
- **Edge cases:** unknown id → `// session_not_found` + back link; unauthenticated
  redirect.
- **Spec:** `session-review.spec.ts`.

### `/auth/login` (`src/app/auth/login/page.tsx`)
- **Purpose:** Email/password + OAuth (Google/Microsoft/GitHub) login.
- **Auth:** Public.
- **Features:** `auth.login()` heading, OAuth buttons, email (`you@company.com`) +
  password (`••••••••`) fields, `authenticate()` submit, error banner, links to
  signup/home. On success → `/dashboard` (or `/invite/<token>` if `?invite=`).
- **Happy path:** valid creds → `/dashboard`.
- **Edge cases:** invalid creds → inline error; `?invite=` carried through.
- **Spec:** `auth.spec.ts`.

### `/auth/signup` (`src/app/auth/signup/page.tsx`)
- **Purpose:** Account creation (email/password + OAuth).
- **Auth:** Public.
- **Features:** `auth.signup()` heading, OAuth buttons, fullName/email/company/
  password fields, `create_account()` submit, error banner. On success →
  `/dashboard` (or `/invite/<token>` if `?invite=`).
- **Spec:** `auth.spec.ts`.

### `/auth/callback` (`src/app/auth/callback/page.tsx`)
- **Purpose:** OAuth return handler — listens for `SIGNED_IN` → `/dashboard`.
- **Auth:** Public (transient). Shows "Completing sign in…" spinner.
- **Spec:** `auth.spec.ts` (renders spinner).

### `/auth/logout` (`src/app/auth/logout/page.tsx`)
- **Purpose:** Signs out then redirects to `/`.
- **Auth:** Public. Shows "Logging out…" then navigates home.
- **Spec:** `auth.spec.ts`.

### `/invite/[token]` (`src/app/invite/[token]/page.tsx`)
- **Purpose:** Corporate invitation landing / acceptance.
- **Auth:** Public; auto-accepts if already logged in (via `/api/invite/accept`).
- **Features:** loads invite via `GET /api/invite/accept?token=`; valid → shows
  company/role/email/expiry + `create & join` / `have account, sign in` (both
  carry `?invite=<token>`); invalid/expired/used/mismatch → error card + go-home.
- **Happy path:** valid token (logged-out) → signup/login choices.
- **Edge cases:** bogus token → "Invalid or expired invitation link"; accept as
  wrong email → `email_mismatch`; suspended/full company.
- **Spec:** `invite.spec.ts` (+ API in `api-routes.spec.ts`).

### `/admin` — Super-admin (`src/app/admin/page.tsx`, layout `src/app/admin/layout.tsx`)
- **Purpose:** Platform-wide analytics + super-admin management.
- **Auth:** Required, email in `NEXT_PUBLIC_SUPER_ADMIN_EMAILS` (UI gate);
  server enforces via `/api/admin`. Non-admins see `access.denied()`.
- **Features:** `DashboardAnalytics` with **Channel** (free/B2C/B2B) + **Company**
  filters (shown when >1 option), `api_ai_costs()`, `activity()`, `top_users()`,
  `cefr_distribution()`, `recent_lessons()`; `super_admin()` panel —
  `platform_settings()` (`free_monthly_sessions`, `free_max_jds`,
  `premium_max_jds`, **`margin_pct`**, `save_settings()`, **`free_dashboard_access`
  toggle**), `companies()` CRUD (create/suspend/delete, edit limits, invite
  manager, company/member JDs, members + roles), `account_access()` (live user
  search + channel filter + `ban()`/`delete()`).
- **Spec:** `admin-panel.spec.ts` (existing) + `dashboard.spec.ts::admin gate` for
  the non-admin denial.

---

## API ROUTES

| Route | Method | Auth | Happy path | Edge / status codes | Spec |
|---|---|---|---|---|---|
| `/api/auth/check` | GET | cookie (optional) | `200 { authenticated:false }` when signed out | never throws — always `200` | `api-routes.spec.ts` |
| `/api/chat` | POST | none | opening turn returns `message`+`title`+`speaker` (needs live LLM) | invalid/empty body still routes; `500` when LLM/provider unavailable — asserted **reachable + non-404** only | `api-routes.spec.ts` (partial) |
| `/api/evaluate` | POST | none | `200 { assessment, source }`; empty messages → `source:'heuristic'` | LLM failure → `source:'unavailable'` placeholder (still `200`) | `api-routes.spec.ts` |
| `/api/tts` | POST | none | text + Google config → `200` audio; else `200 { fallback:true }` | no `text` → `400` | `api-routes.spec.ts` |
| `/api/lesson/start` | POST | Bearer (unless `demoMode`) | `demoMode:true` → `200 { lessonId }` | no auth → `401`; revoked → `403`; limits (`free_limit`/`daily`/`monthly`/`company_suspended`) → `403` | `api-routes.spec.ts` |
| `/api/lesson/complete` | POST | Bearer (optional, demo ok) | `200 { assessment, costs }` | no user messages → `400` | `api-routes.spec.ts` |
| `/api/admin` | POST | Bearer super-admin | `list_companies` etc → `200` | not super-admin / no auth → `403`; unknown action → `400` | `api-routes.spec.ts` (auth-gated + authed) |
| `/api/team` | POST | Bearer manager | `overview`/`analytics` → `200` (analytics `priceView:true`) | not manager / no auth → `403`; unknown action → `400`; invite errors `400/403/409` | `api-routes.spec.ts` |
| `/api/send-invite` | POST | none | sends email → `200` | no `RESEND_API_KEY` → `500`; missing fields → `400` — asserted **reachable + non-404** | `api-routes.spec.ts` (partial) |
| `/api/invite/accept` | GET | none | valid token → `200 { valid:true, company_name }` | no token → `400`; unknown token → `404 { valid:false }` | `api-routes.spec.ts` |
| `/api/invite/accept` | POST | Bearer | matching user → `200 { ok:true }` | no auth → `401`; no token → `400`; email mismatch → `403`; used/expired → `400` | `api-routes.spec.ts` |

**Admin actions** (POST `/api/admin`): `list_companies`, `create_company`,
`update_company`, `suspend_company`, `delete_company`, `invite_manager`,
`list_members`, `remove_from_company`, `ban_user`, `delete_user`, `list_users`,
`list/upload/update/delete_company_jd`, `list_member_jds`, `promote_jd`,
`set_member_role`, `get_settings`, `update_settings` (incl. `margin_pct` +
`free_dashboard_enabled`).

**Team actions** (POST `/api/team`): `overview`, `analytics`, `set_domain_mode`,
`set_member_role`, `list/upload/update/delete_company_jd`, `list_member_jds`,
`promote_jd`, `invite_member`, `cancel_invite`, `remove_member`.

---

## Partial / non-deterministic coverage notes

- **`/api/chat`** and **`/demo` full conversation** require a live LLM provider
  (per memory, both Claude and Kimi are currently blocked). E2E asserts the route
  **exists and is reachable** (non-404, validates/attempts) rather than a full
  graded conversation. The full semantic run lives in `practice-flow.spec.ts`,
  gated behind `E2E_RUN=1` + a seeded user.
- **`/api/send-invite`** depends on `RESEND_API_KEY`; asserted reachable (non-404)
  and returning a controlled error/`400` when unconfigured — no email is sent.
- **`/dashboard` paywall branch** depends on `platform_settings.free_dashboard_enabled`
  and the account's channel. Covered tolerantly: `dashboard.spec.ts` asserts the
  full dashboard for a corporate (never-paywalled) manager, and verifies the
  paywall UI **only when it is presented**.
- Authenticated API assertions (`/api/admin`, `/api/team` → `200`) require the
  seeded accounts + Supabase env in `.env.local`; those tests `skip` when env is
  absent.
