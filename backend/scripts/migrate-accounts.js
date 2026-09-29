const fs = require('node:fs/promises')
const path = require('node:path')
const pool = require('../config/database')
const validate = require('../config/environment')

async function migrate() {
    let client
    try {
        validate()
        client = await pool.connect()
        await client.query('BEGIN')
        await client.query("SET LOCAL lock_timeout = '5s'")
        await client.query(await fs.readFile(path.join(__dirname, '../database/accounts.sql'), 'utf8'))
        await client.query('COMMIT')
        console.log('Account migration complete; existing records preserved.')
    } catch (error) {
        if (client) await client.query('ROLLBACK').catch(() => {})
        console.error('Account migration failed:', error.code || error.message)
        process.exitCode = 1
    } finally {
        if (client) client.release()
        await pool.end()
    }
}
migrate()
