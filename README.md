# My Web App V2

`my-web-app-v2` is a structured rebuild of the original web application project.

The goal is to build a full-stack web application while understanding how each technology, architectural layer, and development process fits together.

## Application Stack

- HTML
- CSS
- JavaScript
- React
- Node.js
- Express.js
- PostgreSQL
- REST API
- Postman
- Git
- GitHub

## Target Architecture

Browser  
↓  
React Frontend  
↓  
REST API / HTTP / JSON  
↓  
Node.js + Express Backend  
↓  
PostgreSQL

## Project Structure

- `frontend/` — frontend application
- `backend/` — backend/API application
- `backend/database/` — database schema
- `docs/` — project documentation

## Development Approach

See [PostgreSQL setup](docs/database.md) for environment configuration, safe schema
initialization, backend startup, and connectivity checks. See [API reference](docs/api.md)
for endpoints and request examples. The frontend reads and saves real PostgreSQL
data through Express; browser refreshes preserve saved users and tasks.

## Local startup

Use Node.js 22.12+ (Node 24 recommended) and a running local PostgreSQL server.
Follow the database setup guide above for `my_web_app_v2` and `backend/.env`.
Do not overwrite an existing `.env` or recreate an existing database.
Follow [Accounts setup](docs/accounts.md) to configure SESSION_SECRET and private
bootstrap Admin settings before the commands below. Bootstrap is safe to repeat.

In one terminal, from `backend/`:

```text
npm ci
npm run db:migrate:accounts
npm run admin:bootstrap
npm run db:check
npm start
```

In another terminal, from `frontend/`:

```text
npm ci
npm run dev
```

Open `http://localhost:5173`. Express runs on port 3000 by default. Install
dependencies only when needed; both servers must remain running while using the app.

The browser sends relative `/api` requests through `src/services/api.js`. Vite
proxies them to Express, so local development needs no additional CORS middleware.
If Express uses another port, copy `frontend/.env.example` to `frontend/.env`, set
`API_PROXY_TARGET`, and restart Vite. Never put database credentials in frontend files.

App restores the cookie session before loading data. Admins manage all users/tasks;
Users see only their assigned tasks and their Profile. Express enforces these permissions.
Forms await successful API responses before clearing input or updating state. Initial
load failures show a Retry button. Reload the page to refresh changes made elsewhere.

Run `npm test` in each application directory. From `frontend/`, `npm run build`
creates the production bundle; `npm run preview` serves it locally on port 4173
with the same API proxy. Vite preview is for local verification, not production hosting.
A future deployment must route `/api` to Express; the static bundle itself has no proxy.

The project is developed progressively using:

Architecture → Implementation → Testing → Verification → Review

Major application technologies are introduced only when their role in the architecture becomes relevant.

## Previous Project

The original `my-web-app` project remains unchanged and serves only as a reference for previous learning and implementation experience.
