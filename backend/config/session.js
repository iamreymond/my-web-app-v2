const session = require('express-session')
const PgSession = require('connect-pg-simple')(session)
const pool = require('./database')

function createSessionMiddleware() {
    const secret = process.env.SESSION_SECRET
    if (!secret || secret.length < 32 || secret === 'replace_with_a_random_secret_of_at_least_32_characters') {
        throw new Error('SESSION_SECRET must be a private random value of at least 32 characters')
    }
    // Only an opaque signed ID reaches the browser. Session data stays in PostgreSQL.
    // Automated unit tests use MemoryStore; real application startup always uses PostgreSQL.
    const store = process.env.NODE_ENV === 'test'
        ? new session.MemoryStore()
        : new PgSession({ pool, tableName: 'sessions', createTableIfMissing: false })
    return session({
        name: 'worktracker.sid', secret, store,
        resave: false, saveUninitialized: false,
        cookie: {
            httpOnly: true, sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 8 * 60 * 60 * 1000,
        },
    })
}

module.exports = createSessionMiddleware
