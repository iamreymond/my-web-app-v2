const pool = require('../config/database')
const { validPassword, hashPassword } = require('../config/passwords')
const validate = require('../config/environment')

// Deliberately activate a preserved assignment record without replacing its ID or existing credentials.
async function activate() {
    try {
        validate()
        const email = process.env.LEGACY_ACCOUNT_EMAIL?.trim().toLowerCase()
        const password = process.env.LEGACY_ACCOUNT_PASSWORD
        if (!email || !validPassword(password)) throw new Error('Set LEGACY_ACCOUNT_EMAIL and a valid LEGACY_ACCOUNT_PASSWORD privately')
        const result = await pool.query(`UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
            WHERE lower(email) = $2 AND password_hash IS NULL AND role = 'user' RETURNING id`,
        [await hashPassword(password), email])
        console.log(result.rowCount ? 'Legacy User login enabled; assignments preserved.' : 'No legacy User without a password matched; nothing changed.')
    } catch (error) {
        console.error('Legacy activation failed:', error.code || error.message)
        process.exitCode = 1
    } finally { await pool.end() }
}
activate()
