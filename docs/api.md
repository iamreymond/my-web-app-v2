# Work Tracker API

The Express API uses JSON. The default local base URL is `http://localhost:3000`.
The backend persists users and tasks in PostgreSQL. The React frontend calls these
endpoints through its API service and Vite's local proxy. See [database setup](database.md)
for connection configuration and the [README](../README.md) for local startup.

## Endpoints

| Method | Path | Success | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | 200 | Check database connectivity |
| GET | `/api/users` | 200 | Return users ordered by ID |
| POST | `/api/users` | 201 | Create a user |
| GET | `/api/tasks` | 200 | Return tasks ordered by ID |
| POST | `/api/tasks` | 201 | Create an optionally assigned task |
| PATCH | `/api/tasks/:id/status` | 200 | Change task status |

POST and PATCH require `Content-Type: application/json` and a JSON object.
The maximum request body size is 100 KB. Unknown fields are ignored; task creation
always uses the database's `Open` default, regardless of a submitted status.

## Create a user

```json
{ "name": "Alice Example", "email": "alice@example.com" }
```

Name must be a nonblank string of up to 100 characters after trimming. Email must
have a basic `name@domain.suffix` shape and be at most 255 characters. Email is
trimmed and lowercased before saving. A database uniqueness conflict returns 409.
This does not verify mailbox ownership or deliverability.

User records have `id`, `name`, `email`, and `createdAt`. Both listing and creation
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
Description is an optional string, defaulting to empty; explicit null is rejected.
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
| 404 | Unknown route or task not found |
| 409 | Duplicate email |
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
No additional test dependencies are required.

For manual Postman checks after database configuration is resolved, use the sample
bodies above, verify successful creates appear in GET results, and verify status
updates persist. Repeat with invalid fields, duplicate emails, and missing IDs.
Creation and update requests write to the configured database; use deliberate test data.
