const { test, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const bcrypt = require('bcryptjs')
process.env.NODE_ENV = 'test'
process.env.SESSION_SECRET = require('node:crypto').randomBytes(48).toString('hex')
const app = require('../server')
const pool = require('../config/database')
let server, base, adminCookie, userCookie, query, statements
const password = 'management-test-only-password'
const user = { id: 2, name: 'Member', email: 'member@example.invalid', role: 'user', active: true, canLogin: true }
const task = { id: 7, title: 'Work', description: '', status: 'Open', priority: 'Medium', userId: 2 }

before(async () => {
    const hash = await bcrypt.hash(password, 4)
    const original = pool.query
    pool.query = async (sql, values) => ({ rows: [{ id: values[0] === 'admin@example.invalid' ? 1 : 2,
        name: 'Test', email: values[0], role: values[0] === 'admin@example.invalid' ? 'admin' : 'user', active: true, password_hash: hash }] })
    server = app.listen(0, '127.0.0.1')
    await new Promise(resolve => server.once('listening', resolve))
    base = `http://127.0.0.1:${server.address().port}`
    for (const email of ['admin@example.invalid', 'member@example.invalid']) {
        const r = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'WorkTracker' }, body: JSON.stringify({ email, password }) })
        assert.equal(r.status, 200)
        const cookie = r.headers.get('set-cookie').split(';')[0]
        if (email.startsWith('admin')) adminCookie = cookie
        else userCookie = cookie
    }
    pool.query = original
})
after(async () => { await new Promise(resolve => server.close(resolve)); await pool.end() })
beforeEach(context => {
    statements = []
    query = async () => { throw Error('Unexpected SQL') }
    const run = async (sql, values) => {
        statements.push(sql)
        if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql) || sql.startsWith('SET LOCAL') || sql.startsWith('LOCK TABLE')) return { rows: [] }
        if (sql.includes('WHERE id = $1 AND password_hash IS NOT NULL')) return { rows: [{ id: values[0], role: values[0] === 1 ? 'admin' : 'user' }] }
        if (sql.includes("active = true AND role = 'admin'")) return { rows: [{ id: 1 }] }
        return query(sql, values)
    }
    context.mock.method(pool, 'query', run)
    context.mock.method(pool, 'connect', async () => ({ query: run, release() {} }))
})
async function request(path, method = 'GET', body, cookie = adminCookie) {
    const r = await fetch(base + '/api' + path, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-Requested-With': 'WorkTracker' }, body: body === undefined ? undefined : JSON.stringify(body) })
    const data = await r.json()
    assert.ok(!JSON.stringify(data).includes('password_hash'))
    return { status: r.status, data }
}

test('user details include a safe workload summary and missing IDs return 404', async () => {
    query = async sql => ({ rows: sql.includes('FROM tasks') ? [{ total: 2, open: 1, inProgress: 0, completed: 1 }] : [user] })
    const result = await request('/users/2')
    assert.equal(result.status, 200); assert.equal(result.data.taskSummary.total, 2)
    query = async () => ({ rows: [] })
    assert.equal((await request('/users/99')).status, 404)
})
test('editing normalizes profile fields without changing passwords', async () => {
    query = async (sql, values) => {
        if (sql.startsWith('UPDATE users')) assert.deepEqual(values, ['Member', 'member@example.invalid', 'user', 2])
        return { rows: [user] }
    }
    assert.equal((await request('/users/2', 'PUT', { name: ' Member ', email: ' MEMBER@example.invalid ', role: 'user' })).status, 200)
    assert.ok(statements.includes('COMMIT'))
    assert.ok(!statements.some(sql => sql.startsWith('UPDATE') && sql.includes('password')))
})
test('deactivation revokes stored sessions; reactivation preserves task relationships', async () => {
    for (const active of [false, true]) {
        query = async (sql, values) => {
            if (sql.startsWith('UPDATE users')) assert.deepEqual(values, [active, 2])
            if (sql.startsWith('DELETE FROM sessions')) assert.deepEqual(values, ['2'])
            return { rows: [{ ...user, active }] }
        }
        assert.equal((await request('/users/2/status', 'PATCH', { active })).status, 200)
    }
    assert.ok(statements.some(sql => sql.startsWith('DELETE FROM sessions')))
    assert.ok(!statements.some(sql => /^(UPDATE|DELETE FROM) tasks/.test(sql)))
})
test('current Admin cannot delete, deactivate, or demote themselves', async () => {
    query = async () => ({ rows: [{ ...user, id: 1, role: 'admin' }] })
    for (const [path, method, body] of [['/users/1', 'DELETE'], ['/users/1/status', 'PATCH', { active: false }], ['/users/1', 'PUT', { name: user.name, email: user.email, role: 'user' }]]) {
        assert.equal((await request(path, method, body)).status, 409)
    }
    assert.ok(!statements.some(sql => sql.startsWith('UPDATE') || sql.startsWith('DELETE')))
})
test('last usable Admin and legacy privilege escalation are protected', async () => {
    query = async sql => ({ rows: sql.includes('id <>') ? [] : [{ ...user, role: 'admin' }] })
    assert.equal((await request('/users/2', 'DELETE')).status, 409)
    query = async () => ({ rows: [{ ...user, canLogin: false }] })
    assert.equal((await request('/users/2', 'PUT', { name: 'Member', email: user.email, role: 'admin' })).status, 409)
})
test('assigned users cannot be deleted; safe deletion also removes sessions', async () => {
    query = async () => ({ rows: [user] })
    assert.equal((await request('/users/2', 'DELETE')).status, 409)
    assert.ok(statements.includes('ROLLBACK'))
    query = async sql => ({ rows: sql.includes('FROM tasks') ? [] : [user] })
    assert.equal((await request('/users/2', 'DELETE')).status, 200)
    assert.ok(statements.includes('DELETE FROM users WHERE id = $1'))
})
test('user edits validate every field and keep duplicate emails safe', async () => {
    for (const change of [{ name: '' }, { name: '   ' }, { name: 'x'.repeat(101) }, { email: 'wrong' }, { email: 'x'.repeat(256) }, { role: 'owner' }, { password: 'forbidden' }]) {
        assert.equal((await request('/users/2', 'PUT', { name: user.name, email: user.email, role: user.role, ...change })).status, 400)
    }
    for (const active of ['false', null, 1]) assert.equal((await request('/users/2/status', 'PATCH', { active })).status, 400)
    query = async sql => { if (sql.startsWith('UPDATE')) throw { code: '23505' }; return { rows: [user] } }
    assert.equal((await request('/users/2', 'PUT', { name: user.name, email: user.email, role: user.role })).status, 409)
})
test('task details enforce ownership in SQL', async () => {
    query = async (sql, values) => { assert.match(sql, /id = \$1 AND \(\$2::boolean OR user_id = \$3\)/); assert.deepEqual(values, [7, false, 2]); return { rows: [task] } }
    assert.equal((await request('/tasks/7', 'GET', undefined, userCookie)).status, 200)
})
test('task edit changes assignment, priority, status and timestamp atomically', async () => {
    query = async (sql, values) => {
        if (sql.startsWith('UPDATE tasks')) {
            assert.deepEqual(values, ['Changed', 'Details', 'High', 3, 'Completed', 7])
            assert.match(sql, /updated_at = CURRENT_TIMESTAMP/)
            return { rows: [{ ...task, title: 'Changed', userId: 3, priority: 'High', status: 'Completed' }] }
        }
        return { rows: sql.includes('FROM users') ? [{ id: 3, active: true }] : [task] }
    }
    const r = await request('/tasks/7', 'PUT', { title: ' Changed ', description: 'Details', priority: 'High', userId: 3, status: 'Completed' })
    assert.equal(r.status, 200); assert.equal(r.data.userId, 3)
})
test('task assignment rejects missing/inactive accounts but preserves existing inactive assignment', async () => {
    for (const rows of [[], [{ id: 3, active: false }]]) {
        query = async sql => ({ rows: sql.includes('FROM users') ? rows : [task] })
        assert.equal((await request('/tasks/7', 'PUT', { ...task, userId: 3 })).status, 400)
    }
    query = async sql => ({ rows: sql.includes('FROM users') ? [{ id: 2, active: false }] : [task] })
    assert.equal((await request('/tasks/7', 'PUT', task)).status, 200)
    for (const fields of [{ title: ' ' }, { description: 'x'.repeat(10001) }, { priority: 'Urgent' }, { status: 'Done' }, { userId: '2' }]) {
        assert.equal((await request('/tasks/7', 'PUT', { ...task, ...fields })).status, 400)
    }
})
test('Admin can delete tasks and receives 404 for missing tasks', async () => {
    query = async (sql, values) => { assert.equal(sql, 'DELETE FROM tasks WHERE id = $1 RETURNING id'); assert.deepEqual(values, [7]); return { rows: [task] } }
    assert.equal((await request('/tasks/7', 'DELETE')).status, 200)
    query = async () => ({ rows: [] })
    assert.equal((await request('/tasks/7', 'DELETE')).status, 404)
})
test('all new management writes reject unauthenticated and regular User requests', async () => {
    for (const [path, method] of [['/users/2', 'GET'], ['/users/2', 'PUT'], ['/users/2', 'DELETE'], ['/users/2/status', 'PATCH'], ['/tasks/7', 'PUT'], ['/tasks/7', 'DELETE']]) {
        assert.equal((await request(path, method, method === 'GET' ? undefined : {}, '')).status, 401)
        assert.equal((await request(path, method, method === 'GET' ? undefined : {}, userCookie)).status, 403)
    }
})
