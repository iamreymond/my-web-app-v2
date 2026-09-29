const express = require('express')
const bcrypt = require('bcryptjs')
const { rateLimit } = require('express-rate-limit')
const pool = require('../config/database')
const jsonBody = require('../middleware/jsonBody')
const { validPassword, hashPassword } = require('../config/passwords')
const { userFields, userInput, fail, managementTransaction } = require('../config/management')

const router = express.Router()
const passwordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 10,
    keyGenerator: req => String(req.account.id),
    standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Too many password-change attempts. Please try again in 15 minutes.' },
})

router.put('/', jsonBody, async (req, res, next) => {
    try {
        // The session supplies the identity. Reject privileged fields instead of accepting mass assignment.
        if (Object.keys(req.body).some(key => !['name', 'email'].includes(key))) {
            fail(400, 'Only name and email can be changed in your profile')
        }
        userInput({ ...req.body, role: req.account.role })
        const result = await pool.query(`UPDATE users SET name = $1, email = $2,
            updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND active = true
            RETURNING ${userFields}`, [req.body.name.trim(), req.body.email.trim().toLowerCase(), req.account.id])
        if (!result.rows[0]) fail(401, 'Please sign in to continue')
        res.json(result.rows[0])
    } catch (error) { next(error) }
})

router.put('/password', passwordLimiter, jsonBody, async (req, res, next) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body
        if (Object.keys(req.body).some(key => !['currentPassword', 'newPassword', 'confirmPassword'].includes(key))) {
            fail(400, 'Only password-change fields are allowed')
        }
        if (typeof currentPassword !== 'string' || !currentPassword || bcrypt.truncates(currentPassword)) fail(400, 'Enter a valid current password')
        if (!validPassword(newPassword)) fail(400, 'New password must be at least 12 characters and at most 72 UTF-8 bytes')
        if (typeof confirmPassword !== 'string' || confirmPassword !== newPassword) fail(400, 'New password confirmation does not match')
        if (currentPassword === newPassword) fail(400, 'Choose a new password different from your current password')

        await managementTransaction(async client => {
            // Re-read under the existing account lock; two changes cannot both verify an outdated password.
            const result = await client.query('SELECT password_hash FROM users WHERE id = $1 AND active = true FOR UPDATE', [req.account.id])
            const hash = result.rows[0]?.password_hash
            if (!hash) fail(401, 'Please sign in to continue')
            if (!await bcrypt.compare(currentPassword, hash)) fail(400, 'Current password is incorrect')
            const replacement = await hashPassword(newPassword)
            await client.query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [replacement, req.account.id])
            // Commit the new hash and all-device session revocation together.
            await client.query("DELETE FROM sessions WHERE sess->>'userId' = $1", [String(req.account.id)])
        })
        await new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()))
        res.clearCookie('worktracker.sid', { path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })
        res.json({ message: 'Your password has been changed. Please sign in again.' })
    } catch (error) { next(error) }
})

module.exports = router
