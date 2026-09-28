// Fail with variable names only; configuration errors must never reveal credentials.
function validateDatabaseEnvironment() {
    for (const name of ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']) {
        if (!process.env[name] || !process.env[name].trim()) {
            throw new Error(`Missing required environment variable: ${name}`)
        }
    }
    const port = Number(process.env.DB_PORT)
    if (!/^\d+$/.test(process.env.DB_PORT) || !Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('DB_PORT must be an integer between 1 and 65535')
    }
    if (process.env.DB_PASSWORD === 'your_local_postgres_password') {
        throw new Error('Replace the DB_PASSWORD placeholder in your local environment')
    }
}

module.exports = validateDatabaseEnvironment
