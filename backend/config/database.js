const { Pool } = require('pg')

// Reuse connections across requests instead of opening a new connection for every query.
const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    // Bound connection attempts and queries so an unavailable database cannot hang requests.
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
    idleTimeoutMillis: 30000,
    max: 10,
    application_name: 'work-tracker',
})

// Idle connections can fail outside a request; handle that event without crashing Express.
pool.on('error', error => {
    console.error('PostgreSQL idle connection failed:', error.code || 'DATABASE_ERROR')
})

module.exports = pool
