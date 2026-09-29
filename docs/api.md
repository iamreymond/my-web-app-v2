# Work Tracker API

The Express API uses JSON. The default local base URL is `http://localhost:3000`.
The backend persists users and tasks in PostgreSQL. The React frontend calls these
endpoints through its API service and Vite's local proxy. See [database setup](database.md)
for connection configuration and the [README](../README.md) for local startup.

## Authentication and access

Use POST /api/auth/login with an email/password JSON object and preserve the returned
HttpOnly cookie. GET /api/auth/me returns { "user": null } when signed out or a safe
account when signed in. POST /api/auth/logout destroys the session. All writes,
including login/logout, require the header X-Requested-With: WorkTracker.
See [Accounts setup](accounts.md) for bootstrap, cookies, passwords, and migration.

All users endpoints and task creation/full editing/deletion require Admin access. GET tasks returns all tasks for
Admins and only assigned tasks for Users; query parameters cannot override this.
PATCH task status permits Admins or the assigned User. Missing/unowned task IDs
return 403 for Users, while a missing task returns 404 for Admins. Unauthenticated
protected requests return 401; forbidden actions return 403. Login throttling
returns 429. All account responses exclude password hashes.

## Endpoints

| Method | Path | Success | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | 200 | Check database connectivity |
| GET | `/api/auth/me` | 200 | Current safe account, or null |
| PUT | `/api/profile` | 200 | Edit own name/email |
| PUT | `/api/profile/password` | 200 | Change own password and revoke sessions |
| GET | `/api/users` | 200 | Return users ordered by ID |
| POST | `/api/users` | 201 | Create an active user |
| GET | `/api/users/:id` | 200 | User details and task summary (Admin) |
| PUT | `/api/users/:id` | 200 | Edit name, email, role (Admin) |
| PATCH | `/api/users/:id/status` | 200 | Set active boolean (Admin) |
| DELETE | `/api/users/:id` | 200 | Safe user deletion (Admin) |
| GET | `/api/tasks` | 200 | Return tasks ordered by ID |
| POST | `/api/tasks` | 201 | Create an optionally assigned task |
| GET | `/api/tasks/:id` | 200 | Task details (Admin or owner; otherwise 404) |
| PUT | `/api/tasks/:id` | 200 | Replace editable task fields (Admin) |
| DELETE | `/api/tasks/:id` | 200 | Delete task (Admin) |
| PATCH | `/api/tasks/:id/status` | 200 | Change task status |

POST, PUT, and PATCH require `Content-Type: application/json` and a JSON object.
The maximum request body size is 100 KB. Unknown fields are ignored except password,
password_hash, and active fields in Admin user edits, which are rejected. Self-profile
endpoints reject every field outside their allowlist, and User task-status requests
reject every field except status. Task creation
accepts a valid status and defaults to Open.

## Create a user

```json
{ "name": "Alice Example", "email": "alice@example.com", "password": "<private initial password>", "role": "user" }
```

Name must be a nonblank string of up to 100 characters after trimming. Email must
have a basic `name@domain.suffix` shape and be at most 255 characters. Email is
trimmed and lowercased before saving. A database uniqueness conflict returns 409.
This does not verify mailbox ownership or deliverability.

Account creation also requires a password (at least 12 characters, at most 72 UTF-8
bytes). Role is admin or user, defaulting to user. The angle-bracketed password above
is a placeholder, not a suggested credential.

User records have `id`, `name`, `email`, `role`, `active`, `canLogin`, `createdAt`, and `updatedAt`. Both listing and creation
use camelCase JSON timestamps (previously the user routes returned `created_at`).

## Create a task

```json
{
  "title": "Prepare documentation",
  "description": "Document the local setup steps.",
  "priority": "High",
  "userId": 1
}
```

Title must be a nonblank string of up to 200 characters after trimming.
Description is an optional string of at most 10000 characters, defaulting to empty; explicit null is rejected.
Priority is `Low`, `Medium`, or `High`, defaulting to `Medium`.
`userId` is an existing user's integer ID, or null/omitted for an unassigned task.
String IDs are rejected. IDs must be between 1 and 2147483647.

Task records have `id`, `title`, `description`, `status`, `priority`, `userId`,
`createdAt`, and `updatedAt`. Creating a task returns the saved record.

## Change status

Send this body to `/api/tasks/1/status`:

```json
{ "status": "In Progress" }
```

Supported values are `Open`, `In Progress`, and `Completed`. Any transition between
these values is allowed. The update sets `updatedAt` and returns the saved task.
A valid but nonexistent task ID returns 404.

## Errors and health

Errors use `{ "error": "Human-readable message" }`. Health failures also include
`"status": "error"`. SQL details and stack traces are not sent to clients.

| Status | Meaning |
| --- | --- |
| 400 | Invalid JSON, body, field, ID, or nonexistent assigned user |
| 404 | Unknown route or record not found |
| 409 | Duplicate email, blocked deletion/Admin change, or concurrent management lock timeout |
| 413 | Request body too large |
| 415 | Unsupported content type, charset, or encoding |
| 500 | Unexpected server/database error |
| 503 | Health check cannot reach the database |

Successful health responses contain `status`, `message`, `database`, and `time`.
This endpoint checks database connectivity, not the presence of application tables.

## Local commands and verification

From `backend/`, run `npm start` with the existing local `.env` configured.
Do not put real passwords in documentation or source code.

Run `npm test` (or `node --test`) from `backend/`. Tests use Node's built-in test
runner, an ephemeral local HTTP port, and a mocked query method. They do not load
`.env`, connect to PostgreSQL, or prove that the live schema matches the queries.
Sessions use an isolated in-memory test store; authentication and ownership bypass
cases run alongside the original API tests.

For manual Postman checks after database configuration is resolved, use the sample
bodies above, verify successful creates appear in GET results, and verify status
updates persist. Repeat with invalid fields, duplicate emails, and missing IDs.
Creation and update requests write to the configured database; use deliberate test data.

## Admin edits and deletion

PUT `/api/users/:id` requires `{ "name": "Alice Example", "email": "alice@example.com", "role": "user" }`.
PATCH `/api/users/:id/status` requires `{ "active": false }` or `{ "active": true }`.
GET user details adds `taskSummary: { total, open, inProgress, completed }`.
Passwords are never editable through PUT. Status changes and edits update `updatedAt`.

PUT `/api/tasks/:id` uses the same editable fields as creation, including `status`.
It is a replacement of editable fields: omitted description/priority/status/userId
use the creation defaults, so callers should send the complete form. Assignment
must exist and be active, except that an existing inactive assignment may be retained.
Both DELETE routes return a 200 JSON `{ "message": "... deleted" }` response.

User deletion with assigned tasks and self deletion/deactivation/demotion return 409.
The last usable Admin is protected. Deactivation and role changes revoke sessions.
Full rules and manual checks are in [Admin management](admin-management.md).

## Self-service profile and password

PUT `/api/profile`: `{ "name": "My Name", "email": "me@example.com" }`.
Only these two keys are accepted; the session supplies the account ID. Returns the
saved safe User record. Duplicate emails return 409, validation errors 400.
GET `/api/auth/me` and login now include `active` and `updatedAt` in safe account data.

PUT `/api/profile/password` accepts `currentPassword`, `newPassword`, `confirmPassword`.
The current password must match, confirmation must match, and the replacement must
meet the existing 12-character/72-UTF-8-byte policy and differ from the old password.
Success returns `{ "message": "Your password has been changed. Please sign in again." }`.
All sessions for that account are revoked, including the current one. Wrong current
password/invalid fields return 400; expired/inactive authentication returns 401;
more than 10 attempts per account in 15 minutes returns 429. No credentials/hashes
are included in responses. See [User experience](user-experience.md) for full behavior.
