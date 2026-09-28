const express = require('express')
const pool = require('./config/database')
const usersRouter = require('./routes/users')
const tasksRouter = require('./routes/tasks')
const errorHandler = require('./middleware/errors')
const validateDatabaseEnvironment = require('./config/environment')

const app = express()

const PORT = process.env.PORT || 3000

// Limit request size before parsing user-supplied JSON.
app.use(express.json({ limit: '100kb' }))

app.use('/api/users', usersRouter)
app.use('/api/tasks', tasksRouter)

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
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`)
        })
    } catch (error) {
        console.error('Backend configuration error:', error.message)
        process.exitCode = 1
    }
}

module.exports = app
