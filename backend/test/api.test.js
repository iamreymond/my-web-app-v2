const { test, before, after, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
process.env.NODE_ENV = 'test'
process.env.SESSION_SECRET = require('node:crypto').randomBytes(48).toString('hex')
const bcrypt = require('bcryptjs')
const testPassword = 'unit-test-password-only'
const app = require('../server')
const pool = require('../config/database')

let server
let baseUrl
let queryMock
let cookie

// Exercise real HTTP parsing and routing while keeping tests independent of PostgreSQL.
before(async () => {
    server = app.listen(0, '127.0.0.1')
    await new Promise(resolve => server.once('listening', resolve))
    baseUrl = `http://127.0.0.1:${server.address().port}`
    const original = pool.query
    const loginHash = await bcrypt.hash(testPassword, 4)
    pool.query = async () => ({ rows: [{ id: 900, name: 'Test Admin', email: 'admin@example.invalid', role: 'admin', password_hash: loginHash }] })
    const response = await fetch(baseUrl + '/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'WorkTracker' },
        body: JSON.stringify({ email: 'admin@example.invalid', password: testPassword }),
    })
    assert.equal(response.status, 200)
    cookie = response.headers.get('set-cookie').split(';')[0]
    pool.query = original
})

beforeEach(context => {
    queryMock = context.mock.fn(async () => {
        throw new Error('Unexpected database query')
    })
    context.mock.method(pool, 'query', (sql, values) => {
        if (sql.includes('WHERE id = $1 AND password_hash IS NOT NULL')) {
            return Promise.resolve({ rows: [{ id: 900, name: 'Test Admin', email: 'admin@example.invalid', role: 'admin' }] })
        }
        return queryMock(sql, values)
    })
    context.mock.method(pool, 'connect', async () => ({
        query: async (sql, values) => {
            if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql) || sql.startsWith('SET LOCAL') || sql.startsWith('LOCK TABLE')) return { rows: [] }
            if (sql.includes("active = true AND role = 'admin'")) return { rows: [{ id: 900 }] }
            return queryMock(sql, values)
        }, release() {},
    }))
    context.mock.method(console, 'error', () => {})
})

afterEach(() => queryMock.mock.restore())
after(async () => {
    await new Promise(resolve => server.close(resolve))
    await pool.end()
})

async function request(path, method = 'GET', body) {
    if (path === '/api/users' && method === 'POST' && body && !Array.isArray(body) && typeof body === 'object') {
        body = { password: testPassword, role: 'user', ...body }
    }
    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: { Cookie: cookie, 'X-Requested-With': 'WorkTracker', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
    })
    assert.match(response.headers.get('content-type'), /application\/json/)
    return { status: response.status, body: await response.json() }
}

test('user validation rejects invalid fields without querying PostgreSQL', async () => {
    for (const body of [
        {}, { name: 3, email: 'a@example.com' },
        { name: '   ', email: 'a@example.com' },
        { name: 'a'.repeat(101), email: 'a@example.com' },
        { name: 'A', email: null }, { name: 'A', email: 'invalid' },
        { name: 'A', email: `${'a'.repeat(250)}@example.com` },
    ]) {
        assert.equal((await request('/api/users', 'POST', body)).status, 400)
    }
    assert.equal(queryMock.mock.callCount(), 0)
})

test('user creation normalizes input and returns the created record', async () => {
    const user = { id: 1, name: 'Alice', email: 'alice@example.com', createdAt: '2026-09-28' }
    queryMock.mock.mockImplementation(async (sql, values) => {
        assert.match(sql, /created_at AS "createdAt"/)
        assert.deepEqual(values.slice(0, 2), ['Alice', 'alice@example.com'])
        assert.equal(await bcrypt.compare(testPassword, values[2]), true)
        assert.equal(values[3], 'user')
        return { rows: [user] }
    })
    assert.deepEqual(await request('/api/users', 'POST', {
        name: ' Alice ', email: ' ALICE@example.com ',
    }), { status: 201, body: user })
})

test('duplicate email returns 409', async () => {
    queryMock.mock.mockImplementation(async () => { throw { code: '23505' } })
    assert.equal((await request('/api/users', 'POST', { name: 'A', email: 'a@example.com' })).status, 409)
})

test('account creation rejects invalid passwords and roles before SQL', async () => {
    for (const fields of [
        { password: '' }, { password: null }, { password: 'short' },
        { password: 'a'.repeat(73) }, { password: '😀'.repeat(19) }, { role: 'superuser' },
    ]) {
        assert.equal((await request('/api/users', 'POST', { name: 'Account', email: 'account@example.invalid', ...fields })).status, 400)
    }
    assert.equal(queryMock.mock.callCount(), 0)
})

test('task validation rejects invalid fields before any query', async () => {
    for (const fields of [
        { title: null }, { title: 42 }, { title: ' ' }, { title: 'a'.repeat(201) },
        { description: null }, { description: {} }, { priority: 'Urgent' },
        { userId: '1' }, { userId: 0 }, { userId: -1 }, { userId: 1.5 },
        { userId: 2147483648 },
    ]) {
        assert.equal((await request('/api/tasks', 'POST', { title: 'Task', ...fields })).status, 400)
    }
    assert.equal(queryMock.mock.callCount(), 0)
})

test('task creation applies defaults and uses SQL parameters', async () => {
    const task = { id: 1, title: "Task ' title", description: '', priority: 'Medium', status: 'Open', userId: null }
    queryMock.mock.mockImplementation(async (sql, values) => {
        assert.match(sql, /VALUES \(\$1, \$2, \$3, \$4, \$5\)/)
        assert.deepEqual(values, ["Task ' title", '', 'Medium', null, 'Open'])
        return { rows: [task] }
    })
    assert.deepEqual(await request('/api/tasks', 'POST', { title: " Task ' title " }), { status: 201, body: task })
})

test('assigned task checks the user and preserves their numeric ID', async () => {
    queryMock.mock.mockImplementation(async (sql, values) => {
        if (sql.startsWith('SELECT id, active FROM users')) {
            assert.deepEqual(values, [2])
            return { rows: [{ id: 2 }] }
        }
        assert.deepEqual(values, ['Task', 'Details', 'High', 2, 'Open'])
        return { rows: [{ id: 1, userId: 2 }] }
    })
    assert.equal((await request('/api/tasks', 'POST', {
        title: 'Task', description: ' Details ', priority: 'High', userId: 2,
    })).status, 201)
    assert.equal(queryMock.mock.callCount(), 2)
})

test('missing assigned user and assignment race both return 400', async () => {
    queryMock.mock.mockImplementation(async () => ({ rows: [] }))
    assert.equal((await request('/api/tasks', 'POST', { title: 'Task', userId: 5 })).status, 400)
    queryMock.mock.mockImplementation(async sql => {
        if (sql.startsWith('SELECT')) return { rows: [{ id: 5 }] }
        throw { code: '23503' }
    })
    assert.equal((await request('/api/tasks', 'POST', { title: 'Task', userId: 5 })).status, 400)
})

test('status update rejects malformed IDs and unsupported statuses', async () => {
    for (const id of ['abc', '0', '-1', '1.5', '2147483648']) {
        assert.equal((await request(`/api/tasks/${id}/status`, 'PATCH', { status: 'Open' })).status, 400)
    }
    assert.equal((await request('/api/tasks/1/status', 'PATCH', { status: 'Done' })).status, 400)
    assert.equal(queryMock.mock.callCount(), 0)
})

test('status update handles every supported status and missing tasks', async () => {
    for (const status of ['Open', 'In Progress', 'Completed']) {
        queryMock.mock.mockImplementation(async (sql, values) => {
            assert.match(sql, /updated_at = CURRENT_TIMESTAMP/)
            assert.deepEqual(values, [status, 1, true, 900])
            return { rows: [{ id: 1, status }] }
        })
        assert.deepEqual(await request('/api/tasks/1/status', 'PATCH', { status }), {
            status: 200, body: { id: 1, status },
        })
    }
    queryMock.mock.mockImplementation(async () => ({ rows: [] }))
    assert.equal((await request('/api/tasks/99/status', 'PATCH', { status: 'Open' })).status, 404)
})

test('list routes return populated and empty arrays', async () => {
    for (const path of ['/api/users', '/api/tasks']) {
        for (const rows of [[], [{ id: 1 }]]) {
            queryMock.mock.mockImplementation(async () => ({ rows }))
            assert.deepEqual(await request(path), { status: 200, body: rows })
        }
    }
})

test('request parser failures and unknown routes remain JSON', async () => {
    for (const path of ['/api/users', '/api/tasks', '/api/tasks/1/status']) {
        const method = path.endsWith('/status') ? 'PATCH' : 'POST'
        for (const body of [[], null, 'text', 1]) {
            assert.equal((await request(path, method, body)).status, 400)
        }
        assert.equal((await request(path, method)).status, 415)
    }
    for (const [body, status] of [['{', 400], [JSON.stringify({ title: 'a'.repeat(110000) }), 413]]) {
        const response = await fetch(`${baseUrl}/api/tasks`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
        })
        assert.equal(response.status, status)
        assert.equal(typeof (await response.json()).error, 'string')
    }
    assert.equal((await request('/api/missing')).status, 404)
    assert.equal(queryMock.mock.callCount(), 0)
})

test('database failures do not expose internal error details', async () => {
    queryMock.mock.mockImplementation(async () => { throw new Error('private database details') })
    for (const [path, method, body] of [
        ['/api/users', 'GET'], ['/api/tasks', 'GET'],
        ['/api/users', 'POST', { name: 'A', email: 'a@example.com' }],
        ['/api/tasks', 'POST', { title: 'Task' }],
        ['/api/tasks/1/status', 'PATCH', { status: 'Open' }],
    ]) {
        assert.deepEqual(await request(path, method, body), {
            status: 500, body: { error: 'An unexpected server error occurred' },
        })
    }
})

test('health returns 200 when available and 503 on database failure', async () => {
    queryMock.mock.mockImplementation(async () => ({ rows: [{ now: '2026-09-28' }] }))
    const healthy = await request('/api/health')
    assert.equal(healthy.status, 200)
    assert.equal(healthy.body.database, 'connected')
    queryMock.mock.mockImplementation(async () => { throw { code: '28P01' } })
    assert.deepEqual(await request('/api/health'), {
        status: 503, body: { status: 'error', error: 'Database connection failed' },
    })
})
