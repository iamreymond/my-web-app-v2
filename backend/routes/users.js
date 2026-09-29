const express = require('express')
const pool = require('../config/database')
const jsonBody = require('../middleware/jsonBody')
const { validPassword, hashPassword } = require('../config/passwords')
const { userFields, fail, validId, userInput, managementTransaction } = require('../config/management')

const router = express.Router()

router.get('/', async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                id,
                name,
                email,
                role,
                active,
                updated_at AS "updatedAt",
                (password_hash IS NOT NULL) AS "canLogin",
                created_at AS "createdAt"
            FROM users
            ORDER BY id
        `)

        res.json(result.rows)
    } catch (error) {
        next(error)
    }
})

router.post('/', jsonBody, async (req, res, next) => {
    try {
        const { name, email, password, role = 'user' } = req.body

        // Validate types before trimming; match the database's field limits.
        if (typeof name !== 'string' || !name.trim() || [...name.trim()].length > 100) {
            return res.status(400).json({ error: 'Name must contain 1 to 100 characters' })
        }
        if (typeof email !== 'string' || email.trim().length > 255 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            return res.status(400).json({ error: 'A valid email of up to 255 characters is required' })
        }

        if (!validPassword(password)) {
            return res.status(400).json({ error: 'Password must be at least 12 characters and at most 72 UTF-8 bytes' })
        }
        if (!['admin', 'user'].includes(role)) {
            return res.status(400).json({ error: 'Role must be admin or user' })
        }
        const passwordHash = await hashPassword(password)
        const result = await pool.query(
            `
                INSERT INTO users (name, email, password_hash, role)
                VALUES ($1, $2, $3, $4)
                RETURNING ${userFields}
            `,
            [
                name.trim(),
                email.trim().toLowerCase(),
                passwordHash,
                role,
            ]
        )

        res.status(201).json(result.rows[0])
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({
                error: 'Email already exists',
            })
        }

        next(error)
    }
})

router.param('id', (req, res, next, id) => {
    if (!validId(id)) return res.status(400).json({ error: 'User ID must be a positive integer' })
    next()
})

router.get('/:id', async (req, res, next) => {
    try {
        const result = await pool.query(`SELECT ${userFields} FROM users WHERE id = $1`, [Number(req.params.id)])
        if (!result.rows[0]) fail(404, 'User not found')
        const summary = await pool.query(`SELECT count(*)::int AS total,
            count(*) FILTER (WHERE status = 'Open')::int AS open,
            count(*) FILTER (WHERE status = 'In Progress')::int AS "inProgress",
            count(*) FILTER (WHERE status = 'Completed')::int AS completed
            FROM tasks WHERE user_id = $1`, [Number(req.params.id)])
        res.json({ ...result.rows[0], taskSummary: summary.rows[0] })
    } catch (error) { next(error) }
})

async function changeUser(req, action) {
    const id = Number(req.params.id)
    return managementTransaction(async client => {
        // Recheck the acting Admin after acquiring the lock, including concurrent revocations.
        const actor = await client.query("SELECT id FROM users WHERE id = $1 AND active = true AND role = 'admin' AND password_hash IS NOT NULL", [req.account.id])
        if (!actor.rows.length) fail(403, 'Admin access required')
        const result = await client.query(`SELECT ${userFields} FROM users WHERE id = $1`, [id])
        const user = result.rows[0]
        if (!user) fail(404, 'User not found')
        const removesAccess = action === 'delete' || (action === 'status' && !req.body.active) || (action === 'edit' && req.body.role !== 'admin')
        if (id === req.account.id && removesAccess) fail(409, 'You cannot delete, deactivate, or demote your own Admin account')
        if (user.role === 'admin' && user.active && user.canLogin && removesAccess) {
            const others = await client.query("SELECT id FROM users WHERE id <> $1 AND role = 'admin' AND active = true AND password_hash IS NOT NULL", [id])
            if (!others.rows.length) fail(409, 'At least one usable Admin account must remain')
        }
        if (action === 'edit' && req.body.role === 'admin' && !user.canLogin) fail(409, 'Enable login for this legacy account before granting Admin access')
        if (action === 'delete') {
            const assigned = await client.query('SELECT id FROM tasks WHERE user_id = $1 LIMIT 1', [id])
            if (assigned.rows.length) fail(409, 'This user cannot be deleted while tasks are assigned. Reassign or delete those tasks first.')
            await client.query('DELETE FROM users WHERE id = $1', [id])
        } else if (action === 'status') {
            await client.query('UPDATE users SET active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [req.body.active, id])
        } else {
            await client.query('UPDATE users SET name = $1, email = $2, role = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4', [req.body.name.trim(), req.body.email.trim().toLowerCase(), req.body.role, id])
        }
        // Remove sessions when access is revoked, so reactivation cannot revive a copied cookie.
        if (action === 'delete' || (action === 'status' && !req.body.active) || (action === 'edit' && user.role !== req.body.role)) {
            await client.query("DELETE FROM sessions WHERE sess->>'userId' = $1", [String(id)])
        }
        if (action === 'delete') return { message: 'User deleted' }
        return (await client.query(`SELECT ${userFields} FROM users WHERE id = $1`, [id])).rows[0]
    })
}

router.put('/:id', jsonBody, async (req, res, next) => {
    try {
        userInput(req.body)
        if ('password' in req.body || 'password_hash' in req.body || 'active' in req.body) fail(400, 'Use the account status action separately; passwords cannot be edited here')
        res.json(await changeUser(req, 'edit'))
    } catch (error) { next(error) }
})
router.patch('/:id/status', jsonBody, async (req, res, next) => {
    try {
        if (typeof req.body.active !== 'boolean') fail(400, 'Active must be true or false')
        res.json(await changeUser(req, 'status'))
    } catch (error) { next(error) }
})
router.delete('/:id', async (req, res, next) => {
    try { res.json(await changeUser(req, 'delete')) } catch (error) { next(error) }
})

module.exports = router
