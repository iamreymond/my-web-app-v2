const { test, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const { randomBytes } = require('node:crypto')
const bcrypt = require('bcryptjs')
process.env.NODE_ENV = 'test'
process.env.SESSION_SECRET = randomBytes(48).toString('hex')
const app = require('../server')
const pool = require('../config/database')
const password = 'unit-test-credentials-only'
let server, base, accounts, tasks

before(async () => {
    server = app.listen(0, '127.0.0.1')
    await new Promise(resolve => server.once('listening', resolve))
    base = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
    await new Promise(resolve => server.close(resolve))
    await pool.end()
})

beforeEach(async context => {
    const hash = await bcrypt.hash(password, 4)
    accounts = [
        { id: 1, name: 'Admin', email: 'admin@example.invalid', role: 'admin', password_hash: hash },
        { id: 2, name: 'User', email: 'user@example.invalid', role: 'user', password_hash: hash },
        { id: 3, name: 'Other', email: 'other@example.invalid', role: 'user', password_hash: hash },
        { id: 4, name: 'Legacy', email: 'legacy@example.invalid', role: 'user', password_hash: null },
    ]
    tasks = [{ id: 10, userId: 2, status: 'Open' }, { id: 11, userId: 3, status: 'Open' }]
    // Query stubs enforce the same filters as SQL; live verification separately exercises PostgreSQL.
    context.mock.method(pool, 'query', async (sql, values) => {
        if (sql.includes('WHERE lower(email) = $1')) return { rows: accounts.filter(user => user.email === values[0]) }
        if (sql.includes('WHERE id = $1 AND password_hash IS NOT NULL')) {
            return { rows: accounts.filter(user => user.id === values[0] && user.password_hash && user.active !== false).map(({ password_hash, ...safe }) => safe) }
        }
        if (sql.includes('FROM tasks')) {
            assert.match(sql, /WHERE \(\$1::boolean OR user_id = \$2\)/)
            return { rows: tasks.filter(task => values[0] || task.userId === values[1]) }
        }
        if (sql.includes('UPDATE tasks')) {
            assert.match(sql, /WHERE id = \$2 AND \(\$3::boolean OR user_id = \$4\)/)
            const task = tasks.find(task => task.id === values[1] && (values[2] || task.userId === values[3]))
            if (task) task.status = values[0]
            return { rows: task ? [task] : [] }
        }
        if (sql.includes('FROM users')) {
            assert.ok(!/SELECT\s+\*/.test(sql))
            return { rows: accounts.map(({ password_hash, ...safe }) => safe) }
        }
        throw new Error('Unexpected query')
    })
})

async function request(path, { cookie, method = 'GET', body, verified = true } = {}) {
    const response = await fetch(base + path, {
        method,
        headers: {
            ...(verified ? { 'X-Requested-With': 'WorkTracker' } : {}),
            ...(cookie ? { Cookie: cookie } : {}),
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    })
    const data = await response.json()
    assert.ok(!JSON.stringify(data).includes('password_hash'))
    assert.ok(!JSON.stringify(data).includes(password))
    return { status: response.status, data, cookie: response.headers.get('set-cookie') }
}

async function signIn(email = 'user@example.invalid') {
    const result = await request('/api/auth/login', { method: 'POST', body: { email, password } })
    assert.equal(result.status, 200)
    assert.match(result.cookie, /HttpOnly/)
    assert.match(result.cookie, /SameSite=Lax/)
    return result.cookie.split(';')[0]
}

test('unauthenticated protected requests are rejected', async () => {
    for (const path of ['/api/users', '/api/tasks']) assert.equal((await request(path)).status, 401)
    assert.equal((await request('/api/users', { method: 'POST', body: {} })).status, 401)
    assert.deepEqual((await request('/api/auth/me')).data, { user: null })
})

test('invalid and legacy logins fail with the same safe message', async () => {
    for (const email of ['user@example.invalid', 'missing@example.invalid', 'legacy@example.invalid']) {
        const result = await request('/api/auth/login', { method: 'POST', body: { email, password: 'incorrect-password' } })
        assert.equal(result.status, 401)
        assert.deepEqual(result.data, { error: 'Email or password is incorrect' })
        assert.equal(result.cookie, null)
    }
})

test('login restores account via cookie and logout invalidates copied cookie', async () => {
    const cookie = await signIn()
    assert.equal((await request('/api/auth/me', { cookie })).data.user.id, 2)
    assert.equal((await request('/api/auth/logout', { cookie, method: 'POST', body: {} })).status, 200)
    assert.equal((await request('/api/tasks', { cookie })).status, 401)
    assert.deepEqual((await request('/api/auth/me', { cookie })).data, { user: null })
})

test('regular user cannot use Admin management endpoints', async () => {
    const cookie = await signIn()
    assert.equal((await request('/api/users', { cookie })).status, 403)
    assert.equal((await request('/api/users', { cookie, method: 'POST', body: { role: 'admin' } })).status, 403)
    assert.equal((await request('/api/tasks', { cookie, method: 'POST', body: { title: 'Bypass' } })).status, 403)
})

test('users see only their tasks and cannot override filters with query parameters', async () => {
    const cookie = await signIn()
    const result = await request('/api/tasks?userId=3&role=admin', { cookie })
    assert.deepEqual(result.data.map(task => task.id), [10])
})

test('users can update their own task but not another user task', async () => {
    const cookie = await signIn()
    const own = await request('/api/tasks/10/status', { cookie, method: 'PATCH', body: { status: 'Completed' } })
    assert.equal(own.status, 200)
    assert.equal(own.data.status, 'Completed')
    const other = await request('/api/tasks/11/status', { cookie, method: 'PATCH', body: { status: 'Completed', role: 'admin', userId: 2 } })
    assert.equal(other.status, 403)
    assert.equal(tasks[1].status, 'Open')
})

test('Admin sees all records and can update any task', async () => {
    const cookie = await signIn('admin@example.invalid')
    assert.equal((await request('/api/users', { cookie })).status, 200)
    assert.equal((await request('/api/tasks', { cookie })).data.length, 2)
    assert.equal((await request('/api/tasks/11/status', { cookie, method: 'PATCH', body: { status: 'Completed' } })).status, 200)
})

test('write verification rejects cross-site style requests', async () => {
    assert.equal((await request('/api/auth/login', { method: 'POST', body: {}, verified: false })).status, 403)
    const cookie = await signIn()
    assert.equal((await request('/api/auth/logout', { cookie, method: 'POST', body: {}, verified: false })).status, 403)
})

test('login replaces session IDs and roles are re-read from the database', async () => {
    const cookie = await signIn('admin@example.invalid')
    const second = await request('/api/auth/login', { cookie, method: 'POST', body: { email: 'admin@example.invalid', password } })
    const newer = second.cookie.split(';')[0]
    assert.notEqual(newer, cookie)
    assert.equal((await request('/api/users', { cookie })).status, 401)
    accounts[0].role = 'user'
    assert.equal((await request('/api/users', { cookie: newer })).status, 403)
})

test('invalid cookie cannot forge authentication', async () => {
    assert.equal((await request('/api/users', { cookie: 'worktracker.sid=admin' })).status, 401)
})

test('inactive accounts cannot log in or retain authenticated access', async () => {
    const cookie = await signIn()
    accounts[1].active = false
    assert.equal((await request('/api/tasks', { cookie })).status, 401)
    const denied = await request('/api/auth/login', { method: 'POST', body: { email: 'user@example.invalid', password } })
    assert.equal(denied.status, 401)
    accounts[1].active = true
    assert.equal((await request('/api/tasks', { cookie })).status, 401)
})

test('reassignment immediately changes ownership on subsequent reads and updates', async () => {
    const cookie = await signIn()
    tasks[0].userId = 3
    assert.deepEqual((await request('/api/tasks', { cookie })).data, [])
    assert.equal((await request('/api/tasks/10/status', { cookie, method: 'PATCH', body: { status: 'Completed' } })).status, 403)
})

test('login rate limit returns safe JSON', async () => {
    let result
    for (let i = 0; i < 21; i++) result = await request('/api/auth/login', { method: 'POST', body: {} })
    assert.equal(result.status, 429)
    assert.match(result.data.error, /Too many sign-in attempts/)
})
