# Admin management (Stage 4.6A)

## Upgrade and startup

On the existing feature branch, from `backend/`, run:

```text
npm run db:migrate:accounts
npm run db:migrate:management
npm run db:check
npm start
```

For an empty database, `db:init` includes the final schema. The management migration
adds `users.active BOOLEAN NOT NULL DEFAULT true` and ensures `updated_at` exists.
It is transactional and repeatable, with a five-second lock timeout. It does not
reset data, recreate tables, or reset sequences. Existing account status starts
active; legacy records without a password still cannot sign in. The account
migration and management migration must both run before bootstrap on older databases.

## User management

Admins create accounts with name, email, initial password, and admin/user role.
List cards show role, active status, creation date, and whether legacy login is
enabled. View loads current details from the API, including updated date and counts
of assigned tasks by status. Edit changes only name, email, and role; no password
field is shown or accepted in this endpoint. Email uniqueness is case-insensitive.

Deactivate preserves all assignments, rejects new logins with the usual generic
login error, and deletes stored sessions. Every authenticated request rereads account
status, so revoked access cannot continue. React returns to sign-in on the next 401.
Reactivation allows a fresh login; it does not restore old cookies. Legacy login
enablement and active/inactive status are separate concepts.

Deletion requires explicit confirmation and is blocked with 409 while any tasks,
including completed tasks, are assigned. Reassign or delete those tasks first.
No API operation cascades task deletion. The existing foreign key remains ON DELETE
SET NULL for external database operations; API safeguards are stricter.

An Admin cannot delete, deactivate, or demote their current account. At least one
active Admin with a password must remain. A legacy record without login cannot be
promoted until its login is deliberately enabled. Role changes revoke the target's
sessions. The acting Admin is rechecked within management transactions. Account
changes and assignment writes share a short users-table lock, making concurrent
safeguards understandable for this small local application. This favors correctness
over high write throughput; revisit lock granularity only when workload requires it.

## Task management

Admins create, view, edit, and delete tasks. Create and Edit support title,
description, priority, status, and optional assignment. View includes full description,
assignment, and created/updated dates. Delete requires explicit confirmation.

A new assignment cannot target an inactive account. Editing other fields may retain
an existing inactive assignment so historical work remains manageable; the select
labels that option explicitly. Unassignment and reassignment are allowed. On the
next API request the former assignee cannot read/update the task and the new assignee
can. Open tabs refresh to see changes from another session; this stage adds no polling
or real-time transport. User status updates keep their atomic ownership restriction.

## UI and dashboard

Inline detail sections, reused edit forms, and inline delete confirmations avoid a
new router or modal focus-management system. Saves update shared React state only
after API success. Errors preserve form values and deletion targets; pending actions
are disabled. Switching pages cancels the current edit. Search/filter state resets
when leaving a management page. Browser refresh reloads persisted API data.

Users support name/email search, role/status filters, and name/newest sorting.
Tasks support title search, status/priority/assignee filters (including unassigned),
and newest/title/highest-priority sorting. Filters combine, run locally on the
API-returned arrays, and do not change database records or dashboard totals.

Dashboard cards show total, active, and inactive users; Open, In Progress, Completed,
and unassigned tasks; and task counts by priority. Active includes legacy assignment
records marked active, even if login is not enabled. Priority counts include completed
work. No charting dependency was added. Regular User pages retain their existing scope.

## Manual verification

1. Sign in as Admin; refresh and verify session restoration and dashboard totals.
2. Create two temporary Users with unique test emails. View details, edit name/email,
   exercise search/filter/sort, and try a duplicate email (expect preserved input).
3. Deactivate one User; login must fail. An already signed-in session must lose access
   on its next request. Reactivate, then sign in again with the same password.
4. Create an assigned task, view its details, edit title/description/priority/status,
   and refresh. Verify the User can update only their own task and view Profile.
5. Reassign to the second User. Refresh both accounts: only the new assignee sees it.
6. Try deleting an assigned User: expect 409 and an explanatory message. Cancel a
   task deletion first, then confirm deletion of the temporary task. Delete only
   the temporary Users afterward and verify dashboard counts return to baseline.
7. Call management routes with no cookie (401) and a User cookie (403). Try self
   deletion/deactivation/demotion as Admin (409), invalid IDs/roles/statuses (400),
   missing records (404), and inactive assignments (400).
8. Check console, failure feedback/retry, small-screen layout, and persistence.

Run `npm test` in each app and `npm run build` in frontend. Automated HTTP tests use
mocked PostgreSQL queries; actual database/browser checks remain necessary. No real
credentials belong in fixtures, documentation, examples, or screenshots. Verification
records must be cleaned up without resetting sequences.

## Stage verification — 2026-09-29

Verified on `feature/admin-management`, based on `a987d78`, with no commit or merge.
Backend: 42 tests passed. Frontend: 13 tests passed; production build passed.
JavaScript syntax and Git whitespace checks passed. Backend production dependencies
and the full frontend dependency audit both reported zero vulnerabilities.

Live PostgreSQL/API and browser checks covered account CRUD, blocked deletion,
inactive login and session revocation, Admin self-protection, task CRUD, ownership
after reassignment, filters, sorting, refresh persistence, regular User regression,
and backend outage/retry recovery. Desktop and mobile layouts were checked. Browser
console checks found no application warnings/errors during normal flows.

Temporary Stage46 Jane/John accounts and one verification task were deleted through
the API/UI. The database retains four existing users and two existing tasks (one Open,
one Completed). The temporary credential file was removed. No sequences were reset.
Current credentials were absent from tracked/new files; local .env remains ignored,
and .env.example contains placeholders. PostgreSQL credentials were unchanged.

Expected validation/authentication failures were observed during negative tests.
Git reported only Windows LF/CRLF conversion warnings. The first dependency audit
was blocked by the sandbox; rerunning with network permission succeeded.
No Stage 4.6A feature remains incomplete; ready for manual review.

## Changed files

- [README.md](../README.md)
- [backend/config/management.js](../backend/config/management.js)
- [backend/database/admin-management.sql](../backend/database/admin-management.sql)
- [backend/database/schema.sql](../backend/database/schema.sql)
- [backend/middleware/auth.js](../backend/middleware/auth.js)
- [backend/middleware/errors.js](../backend/middleware/errors.js)
- [backend/package.json](../backend/package.json)
- [backend/routes/auth.js](../backend/routes/auth.js)
- [backend/routes/tasks.js](../backend/routes/tasks.js)
- [backend/routes/users.js](../backend/routes/users.js)
- [backend/scripts/activate-legacy-user.js](../backend/scripts/activate-legacy-user.js)
- [backend/scripts/bootstrap-admin.js](../backend/scripts/bootstrap-admin.js)
- [backend/scripts/migrate-management.js](../backend/scripts/migrate-management.js)
- [backend/test/api.test.js](../backend/test/api.test.js)
- [backend/test/auth.test.js](../backend/test/auth.test.js)
- [backend/test/management.test.js](../backend/test/management.test.js)
- [docs/accounts.md](../docs/accounts.md)
- [docs/admin-management.md](../docs/admin-management.md)
- [docs/api.md](../docs/api.md)
- [docs/database.md](../docs/database.md)
- [frontend/src/App.jsx](../frontend/src/App.jsx)
- [frontend/src/components/ConfirmDelete.jsx](../frontend/src/components/ConfirmDelete.jsx)
- [frontend/src/components/TaskForm.jsx](../frontend/src/components/TaskForm.jsx)
- [frontend/src/components/UserForm.jsx](../frontend/src/components/UserForm.jsx)
- [frontend/src/index.css](../frontend/src/index.css)
- [frontend/src/pages/AdminTasks.jsx](../frontend/src/pages/AdminTasks.jsx)
- [frontend/src/pages/Dashboard.jsx](../frontend/src/pages/Dashboard.jsx)
- [frontend/src/pages/Users.jsx](../frontend/src/pages/Users.jsx)
- [frontend/src/services/api.js](../frontend/src/services/api.js)
- [frontend/src/services/management.js](../frontend/src/services/management.js)
- [frontend/test/management.test.js](../frontend/test/management.test.js)
