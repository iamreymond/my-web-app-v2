const express = require('express')
const pool = require('../config/database')
const jsonBody = require('../middleware/jsonBody')

const router = express.Router()

router.get('/', async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                id,
                name,
                email,
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
        const { name, email } = req.body

        // Validate types before trimming; match the database's field limits.
        if (typeof name !== 'string' || !name.trim() || [...name.trim()].length > 100) {
            return res.status(400).json({ error: 'Name must contain 1 to 100 characters' })
        }
        if (typeof email !== 'string' || email.trim().length > 255 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            return res.status(400).json({ error: 'A valid email of up to 255 characters is required' })
        }

        const result = await pool.query(
            `
                INSERT INTO users (name, email)
                VALUES ($1, $2)
                RETURNING id, name, email, created_at AS "createdAt"
            `,
            [
                name.trim(),
                email.trim().toLowerCase(),
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

module.exports = router