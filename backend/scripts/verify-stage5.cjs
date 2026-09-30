// Opt-in live verification: uses disposable records, never resets data or sequences.
const assert = require('node:assert/strict')
const { randomBytes, createHash } = require('node:crypto')
const bcrypt = require('bcryptjs')
const pool = require('../config/database')
const base = process.env.STAGE5_API_URL || 'http://127.0.0.1:3000/api'
const marker = `stage5-${randomBytes(6).toString('hex')}`
const password = randomBytes(24).toString('hex'), nextPassword = randomBytes(24).toString('hex')
const users = [], tasks = [], cookies = []
let admin, checks = 0
async function call(path, method = 'GET', body, cookie = admin, expected = 200, raw = false) {
    const r = await fetch(base + path, { method, headers: { Cookie: cookie || '',
        'Content-Type': 'application/json', 'X-Requested-With': 'WorkTracker' },
        body: body === undefined ? undefined : raw ? body : JSON.stringify(body) })
    const data = await r.json(), text = JSON.stringify(data)
    for (const secret of [password, nextPassword, process.env.DB_PASSWORD, process.env.SESSION_SECRET,
        process.env.BOOTSTRAP_ADMIN_PASSWORD, 'password_hash', 'stack', 'SELECT ']) {
        if (secret) assert.ok(!text.includes(secret), 'Response must not expose private data')
    }
    assert.equal(r.status, expected, `${method} ${path}: ${r.status}, expected ${expected}`)
    checks++
    return { data, cookie: r.headers.get('set-cookie')?.split(';')[0], headers: r.headers }
}
async function login(email, value = password) {
    const r = await call('/auth/login', 'POST', { email, password: value }, '', 200)
    assert.match(r.headers.get('set-cookie'), /HttpOnly/)
    assert.match(r.headers.get('set-cookie'), /SameSite=Lax/)
    cookies.push(r.cookie)
    return r.cookie
}
async function snapshot() {
    const records = await pool.query('SELECT to_jsonb(u) AS record FROM users u ORDER BY id')
    const work = await pool.query('SELECT to_jsonb(t) AS record FROM tasks t ORDER BY id')
    return { users: records.rowCount, tasks: work.rowCount,
        digest: createHash('sha256').update(JSON.stringify([records.rows, work.rows])).digest('hex') }
}
async function main() {
    const before = await snapshot()
    try {
        admin = await login(process.env.BOOTSTRAP_ADMIN_EMAIL, process.env.BOOTSTRAP_ADMIN_PASSWORD)
        const me = (await call('/auth/me')).data.user
        assert.equal(me.role, 'admin')
        await call('/health')
        for (const path of ['/users', '/tasks', '/users/1', '/tasks/1']) await call(path, 'GET', undefined, '', 401)
        await call('/tasks', 'GET', undefined, 'worktracker.sid=forged', 401)
        await call('/auth/login', 'POST', { email: me.email, password: 'incorrect-test-only' }, '', 401)
        await call('/auth/login', 'POST', { email: [], password: {} }, '', 401)
        for (const suffix of ['a', 'b']) {
            const data = (await call('/users', 'POST', { name: `${marker}-${suffix}`, email: `${marker}-${suffix}@example.invalid`, password }, admin, 201)).data
            users.push(data)
        }
        const [a, b] = users
        const userCookie = await login(a.email), secondCookie = await login(a.email)
        const hashed = (await pool.query('SELECT password_hash FROM users WHERE id=$1', [a.id])).rows[0].password_hash
        assert.notEqual(hashed, password); assert.equal(await bcrypt.compare(password, hashed), true)
        assert.equal((await call('/users')).data.some(u => u.id === a.id), true)
        await call(`/users/${a.id}`)
        await call('/users', 'POST', { ...a, password }, admin, 409)
        for (const change of [{ name: ' ' }, { name: 'x'.repeat(101) }, { email: [] }, { email: 'bad' }, { role: 'owner' }, { password: 'short' }, { password: '😀'.repeat(19) }]) {
            await call('/users', 'POST', { name: marker, email: `${marker}-invalid@example.invalid`, password, ...change }, admin, 400)
        }
        for (const [path, method, body] of [[`/users/${me.id}`, 'DELETE'], [`/users/${me.id}/status`, 'PATCH', { active: false }], [`/users/${me.id}`, 'PUT', { name: me.name, email: me.email, role: 'user' }]]) await call(path, method, body, admin, 409)
        const edited = (await call(`/users/${a.id}`, 'PUT', { name: `${marker} Edited`, email: a.email, role: 'user' })).data
        assert.ok(new Date(edited.updatedAt) >= new Date(a.updatedAt))
        for (const owner of [a.id, b.id]) {
            tasks.push((await call('/tasks', 'POST', { title: `${marker} Work`, description: "<script>alert('test')</script> ' OR 1=1 --", priority: 'High', userId: owner }, admin, 201)).data)
        }
        const [ta, tb] = tasks
        assert.equal((await call('/tasks?role=admin&userId=1', 'GET', undefined, userCookie)).data.length, 1)
        await call(`/tasks/${ta.id}`, 'GET', undefined, userCookie)
        await call(`/tasks/${tb.id}`, 'GET', undefined, userCookie, 404)
        await call(`/tasks/${tb.id}/status`, 'PATCH', { status: 'Completed' }, userCookie, 403)
        for (const [path, method] of [['/users', 'GET'], ['/users', 'POST'], [`/users/${b.id}`, 'GET'], [`/users/${b.id}`, 'PUT'], [`/users/${b.id}/status`, 'PATCH'], [`/users/${b.id}`, 'DELETE'], ['/tasks', 'POST'], [`/tasks/${ta.id}`, 'PUT'], [`/tasks/${ta.id}`, 'DELETE']]) await call(path, method, method === 'GET' ? undefined : {}, userCookie, 403)
        for (const key of ['title', 'description', 'priority', 'userId', 'role']) await call(`/tasks/${ta.id}/status`, 'PATCH', { status: 'Completed', [key]: b.id }, userCookie, 403)
        for (const key of ['role', 'active', 'id', 'password_hash']) await call('/profile', 'PUT', { name: a.name, email: a.email, [key]: 'forged' }, userCookie, 400)
        for (const change of [{ title: ' ' }, { title: 'x'.repeat(201) }, { description: {} }, { description: 'x'.repeat(10001) }, { status: 'Done' }, { priority: 'Urgent' }, { userId: '1' }, { userId: 2147483647 }]) await call('/tasks', 'POST', { title: marker, ...change }, admin, 400)
        for (const id of ['0', '-1', 'abc', '2147483648']) await call(`/tasks/${id}`, 'GET', undefined, admin, 400)
        await call('/tasks/2147483647', 'GET', undefined, admin, 404)
        await call('/tasks', 'POST', '{', admin, 400, true)
        await call('/tasks', 'POST', [], admin, 400)
        await call('/tasks', 'POST', { title: 'x'.repeat(110000) }, admin, 413)
        await call(`/tasks/${ta.id}/status`, 'PATCH', { status: 'Completed' }, userCookie)
        assert.equal((await pool.query('SELECT status FROM tasks WHERE id=$1', [ta.id])).rows[0].status, 'Completed')
        await call(`/users/${a.id}`, 'DELETE', undefined, admin, 409)
        await call(`/tasks/${ta.id}`, 'PUT', { ...ta, title: `${marker} Reassigned`, status: 'In Progress', priority: 'Low', userId: b.id })
        await call(`/tasks/${ta.id}`, 'GET', undefined, userCookie, 404)
        assert.equal((await pool.query('SELECT user_id FROM tasks WHERE id=$1', [ta.id])).rows[0].user_id, b.id)
        await call('/profile', 'PUT', { name: a.name, email: b.email }, userCookie, 409)
        a.email = `${marker}-updated@example.invalid`
        await call('/profile', 'PUT', { name: `${marker} Profile`, email: a.email }, userCookie)
        assert.equal((await pool.query('SELECT email FROM users WHERE id=$1', [a.id])).rows[0].email, a.email)
        const body = { currentPassword: password, newPassword: nextPassword, confirmPassword: nextPassword }
        await call('/profile/password', 'PUT', { ...body, currentPassword: 'incorrect-current' }, userCookie, 400)
        await call('/profile/password', 'PUT', body, userCookie)
        for (const cookie of [userCookie, secondCookie]) await call('/tasks', 'GET', undefined, cookie, 401)
        await call('/auth/login', 'POST', { email: a.email, password }, '', 401)
        const fresh = await login(a.email, nextPassword)
        await call(`/users/${a.id}/status`, 'PATCH', { active: false })
        assert.equal((await pool.query('SELECT active FROM users WHERE id=$1', [a.id])).rows[0].active, false)
        await call('/tasks', 'GET', undefined, fresh, 401)
        await call('/auth/login', 'POST', { email: a.email, password: nextPassword }, '', 401)
        await call('/tasks', 'POST', { title: marker, userId: a.id }, admin, 400)
        await call(`/users/${a.id}/status`, 'PATCH', { active: true })
        await call('/tasks', 'GET', undefined, fresh, 401)
        const active = await login(a.email, nextPassword)
        await call('/auth/logout', 'POST', {}, active)
        await call('/tasks', 'GET', undefined, active, 401)
        const orphans = await pool.query('SELECT count(*)::int AS n FROM tasks t LEFT JOIN users u ON u.id=t.user_id WHERE t.user_id IS NOT NULL AND u.id IS NULL')
        assert.equal(orphans.rows[0].n, 0)
        console.log(JSON.stringify({ liveApiChecks: checks, result: 'PASS' }))
    } finally {
        for (const task of tasks) await call(`/tasks/${task.id}`, 'DELETE')
        for (const user of users) await call(`/users/${user.id}`, 'DELETE')
        for (const cookie of cookies) await call('/auth/logout', 'POST', {}, cookie)
        const after = await snapshot()
        assert.deepEqual(after, before, 'Legitimate records must remain unchanged')
        console.log(JSON.stringify({ cleanup: 'PASS', remainingUsers: after.users, remainingTasks: after.tasks, legitimateDataUnchanged: true }))
        await pool.end()
    }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; pool.end().catch(() => {}) })
