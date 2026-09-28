# Local PostgreSQL setup

Install and start PostgreSQL locally, and use a Node.js version supporting
`--env-file` (Node 20.6 or newer; the frontend has its own Vite requirements).
The project's existing database is `my_web_app_v2`, with role `postgres`.
Do not recreate an existing database or reset its tables.

For a new environment only, create the database once using an authorized
PostgreSQL administrator, for example `createdb -U postgres my_web_app_v2`.
Enter the password at the prompt rather than putting it on the command line.

## Environment

From `backend/`, copy `.env.example` to `.env` only if `.env` does not already
exist. Set `DB_PASSWORD` to your local PostgreSQL password in that file.
The example contains a placeholder, not a working password.

| Variable | Local setting |
| --- | --- |
| DB_HOST | localhost |
| DB_PORT | 5432 |
| DB_NAME | my_web_app_v2 |
| DB_USER | postgres |
| DB_PASSWORD | Your private local password |
| PORT | 3000 |

`.env` is ignored by Git. Never paste credentials into logs, issues, or commits.
Node loads this file through `--env-file=.env`; existing shell variables take
precedence. If a password contains `#`, quote its value in `.env` so it is not
interpreted as a comment. Configuration validation reports variable names only.

PostgreSQL error `28P01` means the server rejected authentication. Compare the
host/port/role against the verified local connection, check for overriding shell
variables, and update the local secret. Do not disable authentication to fix it.

## Initialize and verify

Run these from `backend/` after installing the project's declared dependencies:

```text
npm run db:check
npm run db:init
npm run db:check
npm start
```

`db:check` is read-only and reports the connected database, role, and whether both
public tables exist. It does not certify that every column/constraint matches.
On a new database the first check will fail until initialization creates tables.

`db:init` executes `database/schema.sql` inside a transaction. It creates missing
tables only, preserving existing tables and rows. It does not create the database,
drop data, reset sequences, or migrate older table definitions. For an existing
database, inspect differences before deciding whether any ALTER is necessary.

Then request `GET http://localhost:3000/api/health` in Postman. A successful
response proves a PostgreSQL query completed; database connection failure returns
503 with safe JSON. Use [the API reference](api.md) for user/task requests.

## How persistence works

Routes use one shared `pg.Pool`, configured from the environment. Each
`pool.query()` borrows and returns a connection automatically. Parameterized SQL
keeps submitted values separate from SQL commands. Successful INSERT and UPDATE
queries commit before the API responds; later GET requests read those saved rows.

Connections time out after five seconds; SQL statements time out after ten
seconds. Idle connection errors are logged by code rather than unhandled events.
The HTTP server remains able to return safe failures when the database is down.

The schema uses primary keys, unique emails, task status/priority checks, and an
optional foreign key to users. If a user is deleted externally, `ON DELETE SET
NULL` retains their tasks as unassigned. User deletion is not an API feature.

Timestamps default at insertion. Task status updates explicitly refresh
`updated_at`; arbitrary external SQL updates do not do so automatically. The
current schema uses timestamps without time zone; keep local application/database
timezone settings consistent. Changing timestamp types is a separate data decision.

The existing users table also includes `updated_at`, which the schema preserves.
There is no user-edit endpoint or timestamp trigger; this column currently defaults
at insertion and is not exposed by the user API.

## Tests

`npm test` runs isolated API and environment tests without live database access.
Real persistence verification is separate: create a uniquely labeled temporary
user/task through the API, read them back, update status, and verify it with SQL.
Remove only those exact verification records afterward (task before user), and
never reset sequences to hide the normal gaps left by temporary records.
