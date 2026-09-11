const express = require('express')
const pool = require('./config/database')

const app = express()

const PORT = 3000

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
        res.status(500).json({
            status: 'error',
            message: 'Database connection failed',
        })
    }
})

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
})