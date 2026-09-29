# Accounts and access control

Admins manage accounts and all tasks. Users see only their assigned tasks, update
their status, and edit their own name/email and password. There is no public registration.
See [Regular User experience](user-experience.md) for self-service validation and
password-change session revocation.

## Upgrade an existing Stage 4 database

From `backend/`, install the locked dependencies with `npm ci`, then run
`npm run db:migrate:accounts`. This transactional migration adds `password_hash`,
`role`, a case-insensitive email index, and the `sessions` table. It preserves all
existing users, tasks, assignments, and sequences. A conflicting legacy email
causes rollback rather than automatic merging or deletion.

Existing users become role `user` with a null password hash and cannot log in.
The Admin list labels these accounts "login not enabled". To activate one
deliberately, set `LEGACY_ACCOUNT_EMAIL` and `LEGACY_ACCOUNT_PASSWORD` in the ignored
local `.env`, run `npm run account:activate`, then remove those temporary settings.
The script only enables a legacy User without a password; it cannot overwrite an existing password
or grant an Admin role. Assigned tasks remain attached to the same user ID. This does not change the separate
active/inactive status; an inactive account must also be reactivated by an Admin.

For an empty future database, `npm run db:init` creates the final schema directly.
Do not use schema initialization as a substitute for upgrading existing tables.

Run `npm run db:migrate:management` afterward for account status. See
[Admin management](admin-management.md) for the new account safeguards and session revocation.

## First Admin

Set these values privately in `backend/.env`, never `.env.example`:

- `SESSION_SECRET`: a cryptographically random value of at least 32 characters.
- `BOOTSTRAP_ADMIN_NAME`: the first Admin's name.
- `BOOTSTRAP_ADMIN_EMAIL`: an email not already used by a legacy record.
- `BOOTSTRAP_ADMIN_PASSWORD`: your private initial account password.

Generate a session secret without displaying it using Node's `crypto.randomBytes`
and write it directly into the ignored local environment file. Keep this secret
stable across backend restarts; changing it invalidates existing login cookies.
It is unrelated to `DB_PASSWORD`. Do not use the example placeholder.

Run `npm run admin:bootstrap`. The script hashes the password, locks against
concurrent bootstrap attempts, and creates the first Admin only if no active
Admin exists. Repeating it does not reset passwords or create duplicates. Remove
the bootstrap password from `.env` after setup if you no longer need the input.

Passwords must contain at least 12 characters and no more than 72 UTF-8 bytes.
The byte limit prevents bcrypt's silent truncation. Passwords are not trimmed.
Normal account creation requires name, email, initial password, and role (defaults
to `user`). Deliver initial credentials privately; the application sends no email.

## Sessions and authorization

`express-session` signs an opaque cookie ID with `SESSION_SECRET`.
`connect-pg-simple` stores session data in PostgreSQL and prunes expired records.
Only the user ID and cookie metadata are stored in the session; roles and active status are re-read
from users on each request. Passwords use bcryptjs with cost 12 and random salts.
Neither plaintext passwords nor password hashes are returned by any API.

Cookies use HttpOnly, SameSite=Lax, and an eight-hour lifetime. Local HTTP works in
development. `NODE_ENV=production` requires HTTPS cookies; any future reverse
proxy trust configuration must match the actual deployment. This stage adds no
deployment infrastructure. Do not run the real server with `NODE_ENV=test`, which
is reserved for the isolated tests' in-memory session store.

Login regenerates the session ID. Logout deletes the server-side session and
clears the cookie. On refresh, React calls `/api/auth/me` to restore the account.
An expired session returns the UI to login; passwords and tokens are not placed
in localStorage. Authenticated API responses use `Cache-Control: no-store`.

All state-changing API calls require `X-Requested-With: WorkTracker`. Combined
with JSON requests, SameSite cookies, no cross-origin CORS permission, and rejection
of `Sec-Fetch-Site: cross-site`, this prevents cross-site forms/scripts from using
the session to perform writes. The frontend service adds the header automatically;
Postman callers must add it and preserve the login cookie.

Login is limited to 20 attempts per IP per 15 minutes. This simple limiter lives
in the Node process; it resets on restart and is not shared across future replicas.

Authentication identifies the account. Express role checks reject Admin actions
from Users. Task lists and status-update SQL include ownership restrictions;
supplying another `userId` or `role` in the request cannot change those restrictions.
React hides unavailable pages for usability, not as a security boundary.

## Verification

Run `npm test` in backend and frontend, then `npm run build` in frontend.
Backend tests retain the original API validation cases and add session, role,
ownership, invalid-cookie, request-verification, and rate-limit tests.

Browser check: sign in as Admin, create a User, assign a task, and log out. Sign
in as that User, verify only assigned work is visible, change status, refresh,
check Profile, and log out. Sign back in as Admin to confirm the persisted status.
Also call protected endpoints manually with no cookie and with a User cookie;
expect 401 and 403 respectively. A User updating an unowned or missing task gets
403 without revealing whether another user's task exists.

Keep the Stage 4 Git checkpoint unchanged. Rolling code back does not reverse the
additive database migration; preserve account data and make any rollback decision
explicitly rather than dropping columns or tables.
