const express = require('express')
const pool = require('./config/database')
const usersRouter = require('./routes/users')
const tasksRouter = require('./routes/tasks')
const errorHandler = require('./middleware/errors')
const validateDatabaseEnvironment = require('./config/environment')

const createSessionMiddleware = require('./config/session')
const authRouter = require('./routes/auth')
const profileRouter = require('./routes/profile')
const { loadAccount, requireAccount, requireAdmin, protectWrites } = require('./middleware/auth')

const app = express()

const HOST = process.env.HOST || '127.0.0.1'
const PORT = process.env.PORT || 3000

// Limit request size before parsing user-supplied JSON.
app.use(express.json({ limit: '100kb' }))

// Health remains independent of cookie/session lookup, including during database outages.
app.get('/api/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()')

        res.json({
            status: 'ok',
            message: 'Backend is running',
            database: 'connected',
            time: result.rows[0].now,
        })
    } catch (error) {
        console.error('Health check failed:', error.code || 'DATABASE_ERROR')

        res.status(503).json({
            status: 'error',
            error: 'Database connection failed',
        })
    }
})

// Session cookies identify accounts; these backend checks are the security boundary.
app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
})
app.use('/api', createSessionMiddleware(), protectWrites, loadAccount)
app.use('/api/auth', authRouter)
app.use('/api/profile', requireAccount, profileRouter)
app.use('/api/users', requireAccount, requireAdmin, usersRouter)
app.use('/api/tasks', requireAccount, tasksRouter)


app.use((req, res) => {
    res.status(404).json({
        error: 'Route not found',
    })
})

// Error middleware must follow routes and the fallback handler.
app.use(errorHandler)

// Importing the app in tests does not start the normal development server.
if (require.main === module) {
    try {
        validateDatabaseEnvironment()
        app.listen(PORT, HOST, error => {
            if (error) {
                console.error('Backend startup failed:', error.code || 'LISTEN_ERROR')
                process.exitCode = 1
                return
            }
            console.log(`Server is running on ${HOST}:${PORT}`)
        })
    } catch (error) {
        console.error('Backend configuration error:', error.message)
        process.exitCode = 1
    }
}

module.exports = app
