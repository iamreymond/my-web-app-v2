# Stage 5 — Comprehensive Testing & Bug Fixes

Verification completed September 30, 2026. Stage 5 is complete and ready for review.
The application is suitable as the baseline workload for the next learning stage;
this is not a claim of infrastructure or operational production readiness.

## Scope and environment

- Branch: `testing/stage-5-stabilization`; starting HEAD: `2198120`.
- Working tree was clean at the initial inspection. Interruptions were resumed without discarding changes.
- Windows / PowerShell, Node.js 24.21.0, PostgreSQL 18, existing `my_web_app_v2` database.
- Existing React/Vite frontend on `127.0.0.1:5173`, Express backend on port 3000.
- Browser tests used the Codex in-app Chromium browser. Viewports: 1280×900, 768×900, 390×844.
- Feature scope remained frozen. No dependencies, schema changes, credentials, branches, commits,
  merges, database resets, sequence resets, or DevOps tooling were introduced.
- Existing source, routes, middleware, schema/migrations, configuration, tests, and documentation
  were reviewed. The four runtime fixes below are intentionally small.

## Results and reproducible checks

| Check | Initial baseline | Final result |
| --- | --- | --- |
| Backend `npm test` | 52 passing | 56 passing, 0 failed/skipped |
| Frontend `npm test` | 19 passing | 20 passing, 0 failed/skipped |
| Frontend `npm run build` | Previously working | Passed; 32 modules transformed |
| Backend and frontend `npm audit --json` | Not repeated as a baseline | Both: 0 known vulnerabilities |
| Backend `npm run db:check` | Previously verified | Passed against the existing database |
| JavaScript syntax and Git whitespace | Reviewed | Passed |
| Live API verification | Separate from unit-test counts | 89 checked requests passed, plus cleanup |
| Real-record preservation | 3 users, 2 tasks | 3 users, 2 tasks; unchanged comparison passed |

Run tests/build from each package directory with its existing npm scripts. On this Windows
machine the npm PowerShell launcher was unreliable; the installed npm CLI was invoked through
Node without changing package definitions.

The opt-in `backend/scripts/verify-stage5.cjs` runs against a running local backend:

```text
cd backend
node --env-file=.env scripts/verify-stage5.cjs
```

It reads the local bootstrap Admin credential, generates random disposable account passwords in
memory, creates uniquely named test records, checks API responses and PostgreSQL independently,
then deletes its own tasks/users and logs out its sessions. It compares all pre-existing user/task
rows before and after using a digest without displaying hashes or credentials. It is deliberately
outside `node --test`: normal automated tests do not mutate the local database. Do not run the
live verifier concurrently with someone editing legitimate application data. An interrupted live
run can require cleanup of its exact disposable records; do not delete unrelated records.

## Defects reproduced and fixed

| Defect | Reproduction / root cause | Minimal fix | Regression evidence |
| --- | --- | --- | --- |
| Example session secret accepted | The validator rejected a differently spelled placeholder containing `of_`; the actual `.env.example` value passed. The new test initially failed with a missing expected exception. | Reject both spellings; keep the existing secret length requirement and session store. | Test reads the actual example and requires rejection. |
| Canceled response could expire the current UI session | A 401 body finishing after load cancellation still dispatched `session-expired`; cancellation was only considered in the catch block. The regression initially recorded the unwanted event. | Check the combined abort signal after reading the response body, before processing data or authentication events. | Canceled-response regression emits no session-expiry event; existing legitimate-401 behavior still passes. |
| Failed final login check left a valid session | Login saved its session before the final password/active-state check. If that database query failed, error handling returned 500 without deleting the saved session. The regression observed two authenticated sessions instead of the single pre-existing session. | Track whether login regenerated a session and destroy it on the error path before forwarding the failure. | Failed final check returns 500, leaves no new authenticated session, and does not authenticate a subsequent request. |
| Occupied port reported successful startup | Express passes listen errors to its callback. The callback ignored the error, logged that the server was running, and exited successfully. | Handle the callback error, log only its code, set exit status 1, and omit the success message. | A child process attempts to bind an occupied port; requires exit 1, `EADDRINUSE`, and no running-server message. |

All four regressions were observed failing before their fixes and passing afterward. An additional
backend test covers an actual refused database connection: health 503, login 500, no login cookie,
safe JSON/logs, and Express continuing to answer unauthenticated requests. It uses an unused
local port in an isolated process; the real PostgreSQL service stays running.

## CRUD and authorization matrix

| Operation | Admin | Regular User | Unauthenticated |
| --- | --- | --- | --- |
| Create/list/read/edit users | Allowed, validated | 403 | 401 |
| Activate/deactivate/delete users | Allowed subject to safeguards | 403 | 401 |
| Create/edit/reassign/delete tasks | Allowed, validated | 403 | 401 |
| List tasks | All tasks | Assigned tasks only; forged query filters ignored | 401 |
| Read task detail | Allowed | Own task allowed; another task returns 404 | 401 |
| Update task status | Allowed | Own status only; unowned/forbidden fields return 403 | 401 |
| Read own profile through `/api/auth/me` | Own safe account | Own safe account | `{ "user": null }` |
| Edit own profile / password | Authenticated API allowed | Allowed with validation | 401 |
| Change role/active state through self-service profile | Rejected | Rejected | 401 |

Admin User CREATE/READ/UPDATE/DELETE and Task CREATE/READ/UPDATE/DELETE passed both API and
browser verification. Assigned users cannot be deleted until work is reassigned/deleted. Self
deletion, deactivation, and demotion are blocked. Last-usable-Admin protection and legacy-account
promotion safeguards remain covered by automated tests; no permanent Admin was altered.

Direct API attempts covered listing/retrieving/managing other users, arbitrary task access,
task creation/deletion/reassignment, privileged status payloads, and self-service privilege changes.
Role and ownership decisions are made by Express/SQL, not by the hidden browser controls.

## Authentication, sessions, passwords, and negative inputs

- Valid/invalid/malformed login, inactive login, session restoration, logout, copied invalid cookies,
  and role re-reading passed. Cookies retain HttpOnly and SameSite=Lax; Secure is enabled by the
  existing production configuration (local HTTP naturally does not use a Secure cookie).
- Deactivation revokes access; reactivation does not revive the old session. Browser access after
  deactivation returns to Sign In on the next protected request.
- Password change validates the current password, rejects incorrect/mismatched/short/over-72-byte
  values, stores a bcrypt hash, revokes multiple sessions, rejects the old password, and permits the
  new password. No permanent account password was changed.
- Validation covered blank/whitespace values, wrong types/arrays/objects, malformed email, duplicate
  email, excessive lengths, invalid/nonexistent IDs, unsupported role/status/priority, inactive or
  nonexistent assignees, forbidden fields, malformed JSON, oversized bodies, and query-filter bypasses.
- Hostile-looking SQL/HTML text stayed ordinary data. Browser rendering displayed the literal text;
  no script ran. Existing query parameterization and React escaping remained intact.
- API responses were checked for password/hash/secret leakage and safe error handling. No plaintext
  passwords, hashes, session secret, database password, stack traces, or SQL details were returned.
  Safe account fields and the required signed session cookie remain part of the intended contract.

## Browser workflows and persisted state

Admin browser workflow passed: login → dashboard → create/view/edit user → deactivate/reactivate
→ create/view/edit task → assign/unassign/reassign → search/filter/sort → delete disposable task
→ delete disposable users → logout. Admin could see the regular user's saved profile and task changes.

Regular-user browser workflow passed: login → own dashboard/tasks → search and empty/filter states
→ task detail → status change → refresh → persisted completed task and updated dashboard → profile
edit → duplicate-email failure retaining input → successful edit → password change → mandatory
sign-in → old-password rejection → new-password login → logout/revocation.

The dashboard showed one completed assigned task for the disposable user after refresh. Admin
counts changed with mutations and returned after cleanup to 3 users, 0 open tasks, 1 in-progress
task, 1 completed task, 0 unassigned tasks, and priority totals High 1 / Medium 1 / Low 0.

Pending sign-in/password controls were disabled; success and error feedback appeared. Changing a
status that no longer matched the selected filter removed the card and explained why. Detail status
updated too. Profile updates changed the header without losing success feedback. Browser refresh
restored the PostgreSQL-backed session and saved records. Independent SQL confirmed the completed
task, reassignment, edited profile, inactive state, and sensible created/updated timestamps.

## Failure/recovery and responsive review

- Backend unavailable: the open page remained usable and showed a readable connection error.
  A controlled backend stop followed by page refresh showed the service-unavailable message and
  **Retry loading**. After restarting the backend, Retry restored the same user session and persisted
  workload. No manual database/session reset was needed.
- Database unavailable: the isolated refused-connection test returned safe 503/500 JSON and no
  authenticated session. The actual database was never stopped, and its check passed afterward.
- Invalid/revoked session: deactivating the disposable account forced Sign In on its next request.
- Desktop/tablet/mobile: forms, cards, profile details, and action buttons remained usable. Measured
  page scroll width matched client width. Mobile navigation intentionally scrolls horizontally inside
  its own container. Password controls and deletion confirmations remained reachable. No redesign
  or CSS change was necessary; the viewport override was reset after testing.
- Normal workflows showed no uncaught application exceptions or React warnings. The browser's
  available warn/error log capture returned an empty list. Deliberate duplicate-email, wrong-password,
  revoked-session, and outage requests were expected failures, not normal-workflow regressions.

## Secrets, cleanup, and repository review

- `backend/.env` remains ignored and untracked; all example secrets remain placeholders, including
  `DB_PASSWORD=your_local_postgres_password`.
- Exact-value scanning of tracked and new non-ignored files found no working PostgreSQL password,
  bootstrap Admin password, or session secret. Generated frontend assets were checked separately.
- No test credential file was created. Disposable passwords existed only in process/browser-test
  memory; browser variables were cleared. No environment file or permanent credential was changed.
- The live verifier removed its two temporary users and two tasks. Browser testing removed
  `Stage5 Browser Work`, `Stage5 Edited User`, and `Stage5 Profile Updated` (the latter began as
  `Stage5 Resume User` after the interrupted browser's in-memory password was lost).
- Final database count: **3 users and 2 tasks**. A complete-row digest comparison confirmed the
  legitimate records were unchanged. No sequence was reset. Browser finished signed out.
- Runtime changes are limited to the four fixes above. Test support and this document account for
  the other changes. No package/lockfile, schema, product-page, or unrelated change was made.

## Files changed

- `backend/config/session.js`
- `backend/routes/auth.js`
- `backend/server.js`
- `backend/test/environment.test.js`
- `backend/test/profile.test.js`
- `backend/test/startup.test.js` (new)
- `backend/test/database-outage.test.js` (new)
- `backend/scripts/verify-stage5.cjs` (new, opt-in live verification)
- `frontend/src/services/api.js`
- `frontend/test/api.test.js`
- `docs/stage-5-testing.md` (new)

## Non-issues and remaining limitations

- Development StrictMode can cancel/restart initial loads; this is expected. The cancellation
  authentication side effect was the actual defect and has its own regression test.
- Server processes and browser handles did not survive every interrupted tool session. Restarting
  them restored the app; that tool-lifecycle behavior was not an application defect.
- Git reports Windows LF-to-CRLF conversion notices; whitespace checks pass. No application build
  warning or dependency vulnerability remained.
- This is local functional/security-boundary verification, not a penetration test, load/stress test,
  cross-browser certification, or production deployment review. Automated route tests mostly use
  query/store doubles; the separate real-PostgreSQL checks provide persistence evidence.
- A complete browser network HAR and duplicate-request trace were not available through the browser
  tool. Successful UI results, direct API checks, and console inspection were verified; expected
  negative requests are documented. No exhaustive network-trace claim is made.
- HTTPS/proxy deployment behavior, distributed rate limiting, operations, scaling, backups, and
  infrastructure resilience remain future-stage work. The accepted historical credential issue
  was not revisited and Git history was not rewritten.

## Readiness

No blocking defect remains in the tested Stage 5 scope. Ready for the user's review and approval
before Stage 6. Changes remain uncommitted on `testing/stage-5-stabilization`; Stage 6 was not started.

```text
Browser / React
      ↓
REST API
      ↓
Authentication
      ↓
Authorization / Ownership
      ↓
Validation / Business Rules
      ↓
PostgreSQL
      ↓
Persistent State
```
