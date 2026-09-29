const pool = require('../config/database')
const validate = require('../config/environment')
const { validPassword, hashPassword } = require('../config/passwords')

async function bootstrap() {
    let client
    try {
        validate()
        const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim()
        const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase()
        const password = process.env.BOOTSTRAP_ADMIN_PASSWORD
        if (!name || name.length > 100 || !email || email.length > 255 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !validPassword(password) ||
            password === 'your_private_initial_admin_password') {
            throw new Error('Set valid BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD (12 characters minimum, 72 bytes maximum)')
        }
        const hash = await hashPassword(password)
        client = await pool.connect()
        await client.query('BEGIN')
        // Serialize bootstrap attempts so two processes cannot both create the first admin.
        await client.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE')
        const admins = await client.query("SELECT id FROM users WHERE role = 'admin' AND password_hash IS NOT NULL")
        if (admins.rowCount) {
            await client.query('ROLLBACK')
            console.log('An active Admin already exists; no account was changed.')
            return
        }
        // Never overwrite an existing user's credentials or silently promote an assignment record.
        await client.query(`INSERT INTO users (name, email, password_hash, role)
            VALUES ($1, $2, $3, 'admin')`, [name, email, hash])
        await client.query('COMMIT')
        console.log('Initial Admin created. Password was not logged.')
    } catch (error) {
        if (client) await client.query('ROLLBACK').catch(() => {})
        console.error('Admin bootstrap failed:', error.code || error.message)
        process.exitCode = 1
    } finally {
        if (client) client.release()
        await pool.end()
    }
}
bootstrap()
