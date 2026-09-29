const express = require('express')
const pool = require('../config/database')
const jsonBody = require('../middleware/jsonBody')
const { requireAdmin } = require('../middleware/auth')

const { taskFields, fail, validId, managementTransaction } = require('../config/management')
const router = express.Router()

const validStatuses = [
    'Open',
    'In Progress',
    'Completed',
]

const validPriorities = [
    'Low',
    'Medium',
    'High',
]

router.get('/', async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                id,
                title,
                description,
                status,
                priority,
                user_id AS "userId",
                created_at AS "createdAt",
                updated_at AS "updatedAt"
            FROM tasks
            WHERE ($1::boolean OR user_id = $2)
            ORDER BY id
        `, [req.account.role === 'admin', req.account.id])

        res.json(result.rows)
    } catch (error) {
        next(error)
    }
})

function taskInput(body) {
    const { title, description = '', priority = 'Medium', status = 'Open', userId = null } = body
    if (typeof title !== 'string' || !title.trim() || [...title.trim()].length > 200) fail(400, 'Task title must contain 1 to 200 characters')
    if (typeof description !== 'string' || [...description].length > 10000) fail(400, 'Description must be a string of at most 10000 characters')
    if (!validPriorities.includes(priority)) fail(400, 'Invalid task priority')
    if (!validStatuses.includes(status)) fail(400, 'Invalid task status')
    if (userId !== null && (!Number.isInteger(userId) || !validId(userId))) fail(400, 'Assigned user ID must be a positive integer or null')
    return [title.trim(), description.trim(), priority, userId, status]
}

async function saveTask(req, editing) {
    const values = taskInput(req.body)
    return managementTransaction(async client => {
        const actor = await client.query("SELECT id FROM users WHERE id = $1 AND active = true AND role = 'admin' AND password_hash IS NOT NULL", [req.account.id])
        if (!actor.rows.length) fail(403, 'Admin access required')
        let existing
        if (editing) {
            existing = (await client.query('SELECT user_id AS "userId" FROM tasks WHERE id = $1 FOR UPDATE', [Number(req.params.id)])).rows[0]
            if (!existing) fail(404, 'Task not found')
        }
        if (values[3] !== null) {
            const user = (await client.query('SELECT id, active FROM users WHERE id = $1', [values[3]])).rows[0]
            if (!user) fail(400, 'Assigned user does not exist')
            // Preserve an existing inactive assignment, but never assign new work to it.
            if (user.active === false && (!editing || existing.userId !== values[3])) fail(400, 'Cannot assign a task to an inactive account')
        }
        const result = editing
            ? await client.query(`UPDATE tasks SET title = $1, description = $2, priority = $3,
                user_id = $4, status = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING ${taskFields}`, [...values, Number(req.params.id)])
            : await client.query(`INSERT INTO tasks (title, description, priority, user_id, status)
                VALUES ($1, $2, $3, $4, $5) RETURNING ${taskFields}`, values)
        return result.rows[0]
    })
}

router.param('id', (req, res, next, id) => {
    if (!validId(id)) return res.status(400).json({ error: 'Task ID must be a positive integer' })
    next()
})
router.get('/:id', async (req, res, next) => {
    try {
        const result = await pool.query(`SELECT ${taskFields} FROM tasks WHERE id = $1 AND ($2::boolean OR user_id = $3)`, [Number(req.params.id), req.account.role === 'admin', req.account.id])
        if (!result.rows[0]) fail(404, 'Task not found')
        res.json(result.rows[0])
    } catch (error) { next(error) }
})
router.post('/', requireAdmin, jsonBody, async (req, res, next) => {
    try { res.status(201).json(await saveTask(req, false)) }
    catch (error) {
        if (error.code === '23503') return res.status(400).json({ error: 'Assigned user does not exist' })
        next(error)
    }
})
router.put('/:id', requireAdmin, jsonBody, async (req, res, next) => {
    try { res.json(await saveTask(req, true)) } catch (error) { next(error) }
})
router.delete('/:id', requireAdmin, async (req, res, next) => {
    try {
        const result = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING id', [Number(req.params.id)])
        if (!result.rows.length) fail(404, 'Task not found')
        res.json({ message: 'Task deleted' })
    } catch (error) { next(error) }
})

router.patch('/:id/status', jsonBody, async (req, res, next) => {
    try {
        const { id } = req.params
        const { status } = req.body
        if (!/^[1-9]\d*$/.test(id) || Number(id) > 2147483647) {
            return res.status(400).json({ error: 'Task ID must be a positive integer' })
        }

        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                error: 'Invalid task status',
            })
        }

        const result = await pool.query(
            `
                UPDATE tasks
                SET
                    status = $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2 AND ($3::boolean OR user_id = $4)
                RETURNING
                    id,
                    title,
                    description,
                    status,
                    priority,
                    user_id AS "userId",
                    created_at AS "createdAt",
                    updated_at AS "updatedAt"
            `,
            [status, Number(id), req.account.role === 'admin', req.account.id]
        )

        if (result.rows.length === 0) {
            // Use 403 for regular users without revealing whether an unowned task exists.
            if (req.account.role !== 'admin') return res.status(403).json({ error: 'You may only update your assigned tasks' })
            return res.status(404).json({
                error: 'Task not found',
            })
        }

        res.json(result.rows[0])
    } catch (error) {
        next(error)
    }
})

module.exports = router