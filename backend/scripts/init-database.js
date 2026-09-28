const fs = require('node:fs/promises')
const path = require('node:path')
const validateDatabaseEnvironment = require('../config/environment')
const pool = require('../config/database')

// Initialize missing tables only. Existing tables require inspection, not automatic replacement.
async function initializeDatabase() {
    let client
    try {
        validateDatabaseEnvironment()
        client = await pool.connect()
        const schema = await fs.readFile(path.join(__dirname, '../database/schema.sql'), 'utf8')
        await client.query('BEGIN')
        // Stop rather than wait indefinitely for another session's schema lock.
        await client.query("SET LOCAL lock_timeout = '5s'")
        await client.query(schema)
        await client.query('COMMIT')
        console.log('Schema initialization finished. Existing tables and records were preserved.')
    } catch (error) {
        if (client) await client.query('ROLLBACK').catch(() => {})
        console.error('Schema initialization failed:', error.code || error.message)
        process.exitCode = 1
    } finally {
        if (client) client.release()
        await pool.end()
    }
}

initializeDatabase()
