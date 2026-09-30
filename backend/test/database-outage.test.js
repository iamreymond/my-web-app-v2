const { test } = require('node:test')
const assert = require('node:assert/strict')
const net = require('node:net')
const { once } = require('node:events')
const { randomBytes } = require('node:crypto')

test('database outage returns safe health/login failures without stopping Express', async context => {
    // Use an unused local port in this isolated test process; never stop the real database.
    const reservation = net.createServer().listen(0, '127.0.0.1')
    await once(reservation, 'listening')
    const port = reservation.address().port
    await new Promise(resolve => reservation.close(resolve))
    Object.assign(process.env, {
        NODE_ENV: 'development', SESSION_SECRET: randomBytes(48).toString('hex'),
        DB_HOST: '127.0.0.1', DB_PORT: String(port), DB_NAME: 'unused',
        DB_USER: 'unused', DB_PASSWORD: randomBytes(24).toString('hex'),
    })
    const logs = []
    context.mock.method(console, 'error', (...args) => logs.push(args.join(' ')))
    const app = require('../server')
    const pool = require('../config/database')
    const server = app.listen(0, '127.0.0.1')
    await once(server, 'listening')
    try {
        const base = `http://127.0.0.1:${server.address().port}/api`
        const health = await fetch(base + '/health')
        assert.equal(health.status, 503)
        assert.deepEqual(await health.json(), { status: 'error', error: 'Database connection failed' })
        const login = await fetch(base + '/auth/login', { method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'WorkTracker' },
            body: JSON.stringify({ email: 'outage@example.invalid', password: 'test-only-password' }) })
        assert.equal(login.status, 500)
        assert.deepEqual(await login.json(), { error: 'An unexpected server error occurred' })
        assert.equal(login.headers.get('set-cookie'), null)
        assert.equal((await fetch(base + '/tasks')).status, 401)
        const output = logs.join('\n')
        for (const secret of [process.env.DB_PASSWORD, process.env.SESSION_SECRET, 'SELECT ', 'outage@example.invalid']) {
            assert.ok(!output.includes(secret))
        }
    } finally {
        await new Promise(resolve => server.close(resolve))
        await pool.end()
    }
})
