const express = require('express')
const pool = require('../config/database')
const jsonBody = require('../middleware/jsonBody')

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
            ORDER BY id
        `)

        res.json(result.rows)
    } catch (error) {
        next(error)
    }
})

router.post('/', jsonBody, async (req, res, next) => {
    try {
        const {
            title,
            description = '',
            priority = 'Medium',
            userId = null,
        } = req.body

        // Check types before string operations so invalid input returns 400, not 500.
        if (typeof title !== 'string' || !title.trim() || [...title.trim()].length > 200) {
            return res.status(400).json({
                error: 'Task title must contain 1 to 200 characters',
            })
        }

        if (typeof description !== 'string') {
            return res.status(400).json({ error: 'Description must be a string' })
        }
        // PostgreSQL SERIAL IDs are positive signed 32-bit integers.
        if (userId !== null && (!Number.isInteger(userId) || userId < 1 || userId > 2147483647)) {
            return res.status(400).json({ error: 'Assigned user ID must be a positive integer or null' })
        }

        if (!validPriorities.includes(priority)) {
            return res.status(400).json({
                error: 'Invalid task priority',
            })
        }

        if (userId !== null) {
            const userResult = await pool.query(
                'SELECT id FROM users WHERE id = $1',
                [userId]
            )

            if (userResult.rows.length === 0) {
                return res.status(400).json({
                    error: 'Assigned user does not exist',
                })
            }
        }

        const result = await pool.query(
            `
                INSERT INTO tasks (
                    title,
                    description,
                    priority,
                    user_id
                )
                VALUES ($1, $2, $3, $4)
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
            [
                title.trim(),
                description.trim(),
                priority,
                userId,
            ]
        )

        res.status(201).json(result.rows[0])
    } catch (error) {
        // The user could disappear between the lookup and insert; the FK is authoritative.
        if (error.code === '23503') {
            return res.status(400).json({ error: 'Assigned user does not exist' })
        }
        next(error)
    }
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
                WHERE id = $2
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
            [status, Number(id)]
        )

        if (result.rows.length === 0) {
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