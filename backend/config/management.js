const pool = require('./database')

const userFields = `id, name, email, role, active, (password_hash IS NOT NULL) AS "canLogin",
    created_at AS "createdAt", updated_at AS "updatedAt"`
const taskFields = `id, title, description, status, priority, user_id AS "userId",
    created_at AS "createdAt", updated_at AS "updatedAt"`

function fail(status, message) { throw Object.assign(new Error(message), { publicStatus: status }) }
function validId(id) { return /^[1-9]\d*$/.test(String(id)) && Number(id) <= 2147483647 }
function userInput({ name, email, role }) {
    if (typeof name !== 'string' || !name.trim() || [...name.trim()].length > 100) fail(400, 'Name must contain 1 to 100 characters')
    if (typeof email !== 'string' || email.trim().length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) fail(400, 'A valid email of up to 255 characters is required')
    if (!['admin', 'user'].includes(role)) fail(400, 'Role must be admin or user')
}

// Serialize account safeguards and assignment changes so concurrent requests cannot bypass them.
async function managementTransaction(work) {
    const client = await pool.connect()
    try {
        await client.query('BEGIN')
        await client.query("SET LOCAL lock_timeout = '5s'")
        await client.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE')
        const result = await work(client)
        await client.query('COMMIT')
        return result
    } catch (error) {
        await client.query('ROLLBACK')
        throw error
    } finally { client.release() }
}

module.exports = { userFields, taskFields, fail, validId, userInput, managementTransaction }
