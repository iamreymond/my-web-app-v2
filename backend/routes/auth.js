const express = require('express')
const bcrypt = require('bcryptjs')
const { randomBytes } = require('node:crypto')
const { rateLimit } = require('express-rate-limit')
const pool = require('../config/database')
const jsonBody = require('../middleware/jsonBody')

const router = express.Router()
// Unknown accounts still perform a hash comparison, reducing obvious account-enumeration timing differences.
const dummyHash = bcrypt.hashSync(randomBytes(32).toString('hex'), 12)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 20,
    standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Too many sign-in attempts. Please try again in 15 minutes.' },
})

router.get('/me', (req, res) => res.json({ user: req.account || null }))

router.post('/login', loginLimiter, jsonBody, async (req, res, next) => {
    let createdSession = false
    try {
        const { email, password } = req.body
        if (typeof email !== 'string' || email.length > 255 ||
            typeof password !== 'string' || password.length === 0 || bcrypt.truncates(password)) {
            return res.status(401).json({ error: 'Email or password is incorrect' })
        }
        const result = await pool.query(`
            SELECT id, name, email, role, active, password_hash, created_at AS "createdAt", updated_at AS "updatedAt"
            FROM users WHERE lower(email) = $1
        `, [email.trim().toLowerCase()])
        const account = result.rows[0]
        const matches = await bcrypt.compare(password, account?.password_hash || dummyHash)
        if (!matches || !account?.password_hash || account.active === false) {
            return res.status(401).json({ error: 'Email or password is incorrect' })
        }
        // Replace any previous session ID after login to prevent session fixation.
        await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()))
        createdSession = true
        req.session.userId = account.id
        await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()))
        // If a password change raced with login, its session deletion may have happened before this save.
        // Recheck afterward: either this detects the change, or a later change deletes the saved session.
        // FOR SHARE waits for an in-flight password transaction instead of reading its old committed hash.
        const latest = await pool.query('SELECT password_hash, active FROM users WHERE lower(email) = $1 FOR SHARE', [account.email.toLowerCase()])
        if (latest.rows[0]?.password_hash !== account.password_hash || latest.rows[0]?.active === false) {
            await new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()))
            return res.status(401).json({ error: 'Email or password is incorrect' })
        }
        const { id, name, role, active, createdAt, updatedAt } = account
        res.json({ user: { id, name, email: account.email, role, active, createdAt, updatedAt } })
    } catch (error) {
        // A saved session must not survive an unsuccessful final database check.
        if (createdSession && req.session) {
            return req.session.destroy(() => next(error))
        }
        next(error)
    }
})

router.post('/logout', async (req, res, next) => {
    // Delete the server session, not just the browser cookie; copied cookies stop working too.
    req.session.destroy(error => {
        if (error) return next(error)
        res.clearCookie('worktracker.sid', {
            path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
        })
        res.json({ message: 'Signed out' })
    })
})

module.exports = router
