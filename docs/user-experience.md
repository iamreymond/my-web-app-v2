# Regular User experience (Stage 4.6B)

## Personal workload

The User navigation remains Dashboard, My Tasks, Profile, Logout. Express filters
GET `/api/tasks` by the session's account ID; React receives only that User's work.
There is no separate `/tasks/my` endpoint. The personal Dashboard shows Open,
In Progress, Completed, total assigned tasks, counts by priority, and up to three
unfinished tasks ordered by priority (newest first within a priority). Priority
totals include completed work. No organization-wide statistics appear.

My Tasks supports case-insensitive title/description search, combined status and
priority filters, and newest/oldest/highest-priority/status sorting. Status sorting
places Open before In Progress before Completed. Sorting operates on a copy of
API data; filters do not change dashboard counts. Filters reset on navigation or
refresh. There are separate empty-workload and no-filter-matches messages.

View Details fetches GET `/api/tasks/:id` under the same ownership restriction and
shows full description, priority, status, and created/updated dates. The existing
PATCH `/api/tasks/:id/status` updates only the status and timestamp. Users may choose
Open, In Progress, or Completed; any transition is allowed. The displayed status
changes only after a successful save. If the new status no longer matches a filter,
the task leaves the list and the feedback explains why.

Users cannot create/delete tasks or change title, description, priority, or assignment.
Admin task PUT/DELETE/POST return 403 to Users. An unowned detail request returns 404;
an unowned or missing status target returns 403 without revealing existence. User
status requests containing any field other than `status` return 403. These rules
are enforced by Express/SQL, regardless of manually supplied IDs or role parameters.
Reassignment takes effect on subsequent requests; refresh to see another session's
changes. This stage adds no polling or real-time transport.

## Profile

GET `/api/auth/me` is reused for safe account data: ID, name, email, role, active
status, created date, and updated date. No new profile-read endpoint is needed.
PUT `/api/profile` accepts exactly `name` and `email`; identity comes only from the
session. Extra keys (including role, active, ID, password, and hash) are rejected.
Name must be nonblank and at most 100 characters. Email must have a basic valid
shape and be at most 255 characters; both fields are trimmed and email lowercased.
Case-insensitive duplicate emails return 409. The database updates `updatedAt`.

After success, React refreshes the safe account/header data without unmounting the
form. Failed profile requests preserve input. Role and status remain read-only.
Changing email does not verify mailbox ownership or send email. Use the new email
for the next login; password and active sessions otherwise remain unchanged.

## Change password, not password reset

PUT `/api/profile/password` accepts exactly `currentPassword`, `newPassword`, and
`confirmPassword`. It requires an authenticated active account, verifies the current
bcrypt hash, validates matching confirmation, and uses the existing bcryptjs cost-12
hashing helper. Policy remains at least 12 characters and no more than 72 UTF-8 bytes.
Passwords are not trimmed; the new password must differ from the current password.
Wrong current passwords, malformed values, policy failures, and confirmation mismatch
return safe 400 errors. Attempts are limited to 10 per account per 15 minutes using
the existing rate-limit package; this local in-process limit resets on restart.

The new hash, updated timestamp, and deletion of all PostgreSQL sessions for the
account commit together in the existing management transaction. The request's session
is destroyed and its cookie cleared. React clears account/workload state and shows
'Your password has been changed. Please sign in again.' Only the new password works.
The password-change form clears password inputs after a submitted request; passwords
are never stored in URLs, localStorage, or sessionStorage, or returned/logged by the API.

Login rechecks the credential after saving its session. FOR SHARE waits for an
in-flight password transaction, preventing an old-password login racing the change
from leaving a surviving session. Password changes are serialized with existing
account management so two simultaneous changes cannot verify the same outdated hash.

The profile APIs act only on the authenticated account (including an Admin calling
them directly); no Admin profile navigation or management redesign was added.
All writes retain the request-verification header, HttpOnly/SameSite cookie behavior,
active-account checks, parameterized SQL, and safe JSON errors.

## Database and startup

No schema, migrations, dependencies, or environment settings were added. Existing
users/password_hash/updated_at and sessions tables suffice. Use the existing README
startup commands after the Stage 4.6A migrations. Do not reset the database or sequences.
PostgreSQL, bootstrap Admin credentials, and the session secret remain unchanged.

## Manual verification

1. As Admin, create a uniquely named temporary User and three assigned tasks with
   different priorities/statuses. Keep unrelated tasks assigned to another account.
2. Sign in as that User. Verify own dashboard counts and absence of Admin navigation.
3. Search by title/description, combine filters, exercise all sorts, and inspect
   details. Change own task status; refresh and verify persisted status/counts.
4. View Profile. Try a duplicate email, then save a new name/email. Check the header,
   profile timestamps, refresh persistence, and new email login.
5. Establish a second session for the temporary account. Try a wrong current password,
   weak/overlong new password, and confirmation mismatch. Successful change must sign
   out, reject the old password and copied old cookie, and accept the new password.
6. As Admin, verify saved profile/status changes; exercise CRUD, deactivation,
   reactivation, reassignment, safe deletion, and existing Admin safeguards.
7. Call APIs directly as User: another task detail must return 404; another task's
   status and Admin CRUD must return 403; profile role/active/ID fields must return 400.
   Unauthenticated profile requests return 401 and inactive accounts stay blocked.
8. Check desktop/mobile layout, empty tasks and empty filters, preserved input on
   failures, backend outage/retry, refresh, and browser console.
9. Delete only the temporary tasks and User. Keep legitimate data and sequences.

Run `npm test` in backend and frontend, plus `npm run build` in frontend. Unit HTTP
tests mock SQL (and adapt session deletion to their MemoryStore); live PostgreSQL
verification is needed to prove actual cross-session revocation. No additional test
framework is required.

## Verification — 2026-09-29

Branch: `feature/user-experience`, HEAD `1295fd4`; no commit, branch switch, or merge.
52 backend tests and 19 frontend tests passed. Existing Admin tests remain intact.
Production build, JavaScript syntax, and Git whitespace checks passed. Backend
production and full frontend dependency audits reported zero vulnerabilities.
No dependencies or schema changes were introduced.

Browser verification passed for personal counts, task search/filter/sort/details,
status persistence, safe profile fields, duplicate email feedback, successful
name/email editing, wrong-current-password rejection, password change with required
re-login, old-password failure, and new-password success. A separate pre-change
session was rejected against real PostgreSQL. API bypass checks rejected unowned
tasks, Admin CRUD, privileged profile fields, and forbidden task fields. Admin
views reflected the User changes; management regression and inactive-account
checks passed. Desktop/mobile layout, empty workload, form failure/input retention,
backend outage/retry recovery, and normal console checks passed. Expected negative
requests and intentional outage failures were observed; no normal-flow application
console errors were found.

Created one temporary Stage46B User and three High/Medium/Low tasks through Admin
management. Renamed the temporary profile and changed only its password. Deleted
all three tasks and the temporary User through Admin management after verification.
The database retains three legitimate users and two legitimate tasks. The temporary
credential file was removed and sequences were not reset. The permanent Admin and
PostgreSQL credentials were unchanged. Local .env remains ignored/untracked, examples
contain placeholders, and current-secret scanning of tracked/new files found zero
matches.

An initial test fixture generated a different hash on every mock read; it was corrected
to model a stable stored hash for the new login recheck. All tests then passed. Git
reports Windows LF/CRLF conversion notices only. No remaining Stage 4.6B blockers
were identified. Ready for manual review; Stage 5 was not started.

## Changed files

- [README.md](../README.md)
- [backend/middleware/auth.js](../backend/middleware/auth.js)
- [backend/routes/auth.js](../backend/routes/auth.js)
- [backend/routes/profile.js](../backend/routes/profile.js)
- [backend/routes/tasks.js](../backend/routes/tasks.js)
- [backend/server.js](../backend/server.js)
- [backend/test/api.test.js](../backend/test/api.test.js)
- [backend/test/profile.test.js](../backend/test/profile.test.js)
- [docs/accounts.md](../docs/accounts.md)
- [docs/api.md](../docs/api.md)
- [docs/user-experience.md](../docs/user-experience.md)
- [frontend/src/App.jsx](../frontend/src/App.jsx)
- [frontend/src/index.css](../frontend/src/index.css)
- [frontend/src/pages/Dashboard.jsx](../frontend/src/pages/Dashboard.jsx)
- [frontend/src/pages/Profile.jsx](../frontend/src/pages/Profile.jsx)
- [frontend/src/pages/Tasks.jsx](../frontend/src/pages/Tasks.jsx)
- [frontend/src/services/api.js](../frontend/src/services/api.js)
- [frontend/src/services/personal.js](../frontend/src/services/personal.js)
- [frontend/test/personal.test.js](../frontend/test/personal.test.js)
