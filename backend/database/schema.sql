-- Run against an already-created database. These statements never replace existing tables.
-- IF NOT EXISTS does not upgrade older table definitions; inspect differences separately.
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Matches the existing database; no user-edit endpoint updates this column yet.
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
