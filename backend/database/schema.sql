-- Run against an already-created database. These statements never replace existing tables.
-- IF NOT EXISTS does not upgrade older table definitions; inspect differences separately.
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    -- NULL is reserved for preserved legacy assignment records that cannot log in.
    password_hash TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    role VARCHAR(10) NOT NULL DEFAULT 'user' CONSTRAINT users_role_check CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Management edits explicitly refresh this timestamp.
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'Open',
    priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
    -- Preserve tasks if a user is removed through an external database operation.
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- The API explicitly updates this timestamp when task status changes.
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT tasks_status_check
        CHECK (status IN ('Open', 'In Progress', 'Completed')),

    CONSTRAINT tasks_priority_check
        CHECK (priority IN ('Low', 'Medium', 'High'))
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (lower(email));

-- Opaque session IDs refer to server-side data; expiration supports automatic pruning.
CREATE TABLE IF NOT EXISTS sessions (
    sid VARCHAR NOT NULL PRIMARY KEY,
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expire_idx ON sessions (expire);
