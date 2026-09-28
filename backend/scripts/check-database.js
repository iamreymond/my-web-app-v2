const validateDatabaseEnvironment = require('../config/environment')
const pool = require('../config/database')

// Check the actual connection identity and table presence without changing data.
async function checkDatabase() {
    try {
        validateDatabaseEnvironment()
        const result = await pool.query(`
            SELECT current_database() AS database, current_user AS role,
                   to_regclass('public.users') AS users,
                   to_regclass('public.tasks') AS tasks
        `)
        const info = result.rows[0]
        console.log(info)
        if (info.database !== process.env.DB_NAME || !info.users || !info.tasks) {
            throw new Error('Configured database identity or required tables do not match')
        }
    } catch (error) {
        console.error('Database check failed:', error.code || error.message)
        process.exitCode = 1
    } finally {
        await pool.end()
    }
}

checkDatabase()
