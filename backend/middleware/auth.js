const pool = require('../config/database')

async function loadAccount(req, res, next) {
    try {
        if (req.session.userId) {
            // Re-read the role each time; a client cannot choose its role or retain revoked access.
            const result = await pool.query(`
                SELECT id, name, email, role, created_at AS "createdAt"
                FROM users WHERE id = $1 AND password_hash IS NOT NULL AND active = true
            `, [req.session.userId])
            req.account = result.rows[0]
            // Revoked accounts must sign in again after reactivation; old sessions stay invalid.
            if (!req.account) await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()))
        }
        next()
    } catch (error) { next(error) }
}

function requireAccount(req, res, next) {
    if (!req.account) return res.status(401).json({ error: 'Please sign in to continue' })
    next()
}

function requireAdmin(req, res, next) {
    if (req.account.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
    next()
}

function protectWrites(req, res, next) {
    // Cross-site forms cannot add this header; cross-origin scripts need CORS, which we do not enable.
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
        (req.get('X-Requested-With') !== 'WorkTracker' || req.get('Sec-Fetch-Site') === 'cross-site')) {
        return res.status(403).json({ error: 'Request verification failed' })
    }
    next()
}

module.exports = { loadAccount, requireAccount, requireAdmin, protectWrites }
