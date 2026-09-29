const { test, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const { randomBytes } = require('node:crypto')
const bcrypt = require('bcryptjs')
const session = require('express-session')
process.env.NODE_ENV = 'test'
process.env.SESSION_SECRET = randomBytes(48).toString('hex')
const app = require('../server')
const pool = require('../config/database')
const oldPassword = randomBytes(24).toString('hex')
const newPassword = randomBytes(24).toString('hex')
let server, base, account, cookie, store, statements, sequence = 100
const memorySet = session.MemoryStore.prototype.set
before(async () => {
    server = app.listen(0, '127.0.0.1')
    await new Promise(resolve => server.once('listening', resolve))
    base = `http://127.0.0.1:${server.address().port}/api`
})
after(async () => { await new Promise(resolve => server.close(resolve)); await pool.end() })
beforeEach(async context => {
    account = { id: ++sequence, name: 'Personal Test', email: 'personal@example.invalid', role: 'user', active: true,
        password_hash: await bcrypt.hash(oldPassword, 4), createdAt: '2026-09-29', updatedAt: '2026-09-29' }
    statements = []
    context.mock.method(session.MemoryStore.prototype, 'set', function (...args) { store = this; return memorySet.apply(this, args) })
    const query = async (sql, values) => {
        statements.push({ sql, values })
        if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql) || sql.startsWith('SET LOCAL') || sql.startsWith('LOCK TABLE')) return { rows: [] }
        if (sql.includes('WHERE lower(email) = $1')) return { rows: values[0] === account.email ? [{ ...account }] : [] }
        if (sql.includes('WHERE id = $1 AND password_hash IS NOT NULL')) {
            const { password_hash, ...safe } = account
            return { rows: account.active && values[0] === account.id ? [safe] : [] }
        }
        if (sql.startsWith('SELECT password_hash')) return { rows: account.active ? [{ password_hash: account.password_hash }] : [] }
        if (sql.startsWith('UPDATE users SET name')) {
            assert.equal(values[2], account.id)
            if (values[1] === 'duplicate@example.invalid') throw { code: '23505' }
            account.name = values[0]; account.email = values[1]
            const { password_hash, ...safe } = account
            return { rows: [safe] }
        }
        if (sql.startsWith('UPDATE users SET password_hash')) {
            assert.equal(values[1], account.id); account.password_hash = values[0]; return { rows: [] }
        }
        if (sql.startsWith('DELETE FROM sessions')) {
            assert.deepEqual(values, [String(account.id)])
            // Adapt the SQL-backed deletion to the isolated in-memory test store.
            const all = await new Promise((resolve, reject) => store.all((error, rows) => error ? reject(error) : resolve(rows)))
            for (const [sid, value] of Object.entries(all)) if (value.userId === account.id) {
                await new Promise((resolve, reject) => store.destroy(sid, error => error ? reject(error) : resolve()))
            }
            return { rows: [] }
        }
        throw Error('Unexpected SQL')
    }
    context.mock.method(pool, 'query', query)
    context.mock.method(pool, 'connect', async () => ({ query, release() {} }))
    cookie = await login(oldPassword)
})
async function request(path, method = 'GET', body, authCookie = cookie) {
    const r = await fetch(base + path, { method, headers: { Cookie: authCookie || '', 'Content-Type': 'application/json', 'X-Requested-With': 'WorkTracker' }, body: body === undefined ? undefined : JSON.stringify(body) })
    const data = await r.json()
    const output = JSON.stringify(data)
    for (const secret of ['password_hash', oldPassword, newPassword, account.password_hash]) assert.ok(!output.includes(secret))
    return { status: r.status, data, cookie: r.headers.get('set-cookie')?.split(';')[0] }
}
async function login(password) {
    const r = await request('/auth/login', 'POST', { email: account.email, password }, '')
    assert.equal(r.status, 200)
    return r.cookie
}
const passwordBody = () => ({ currentPassword: oldPassword, newPassword, confirmPassword: newPassword })

test('me exposes safe profile dates/status and profile edits use only the session identity', async () => {
    const me = await request('/auth/me')
    assert.equal(me.data.user.active, true); assert.equal(me.data.user.updatedAt, '2026-09-29')
    const r = await request('/profile', 'PUT', { name: ' New Name ', email: ' NEW@example.invalid ' })
    assert.equal(r.status, 200); assert.equal(r.data.name, 'New Name'); assert.equal(r.data.email, 'new@example.invalid')
    assert.equal((await request('/auth/me')).data.user.email, 'new@example.invalid')
})
test('profile validation rejects blank, malformed, overlong and privileged fields', async () => {
    for (const body of [{}, { name: '' }, { name: ' ' }, { name: 'x'.repeat(101) }, { email: 'bad' }, { email: 'x'.repeat(256) }, { name: null }, { email: [] }]) {
        assert.equal((await request('/profile', 'PUT', body)).status, 400)
    }
    for (const key of ['id', 'role', 'active', 'userId', 'password', 'password_hash', 'status']) {
        assert.equal((await request('/profile', 'PUT', { name: account.name, email: account.email, [key]: 'forged' })).status, 400)
    }
    assert.equal(statements.filter(({ sql }) => sql.startsWith('UPDATE')).length, 0)
})
test('duplicate profile email is safe and does not change account data', async () => {
    const r = await request('/profile', 'PUT', { name: account.name, email: 'duplicate@example.invalid' })
    assert.equal(r.status, 409); assert.match(r.data.error, /Email already exists/)
    assert.equal(account.email, 'personal@example.invalid')
})
test('password change verifies current password, changes hash, revokes both sessions and permits fresh login only', async () => {
    const otherCookie = await login(oldPassword)
    const previous = account.password_hash
    const r = await request('/profile/password', 'PUT', passwordBody())
    assert.equal(r.status, 200); assert.match(r.data.message, /sign in again/)
    assert.notEqual(account.password_hash, previous)
    assert.equal(await bcrypt.compare(newPassword, account.password_hash), true)
    assert.equal(await bcrypt.compare(oldPassword, account.password_hash), false)
    for (const old of [cookie, otherCookie]) assert.equal((await request('/profile', 'PUT', { name: 'No', email: account.email }, old)).status, 401)
    assert.equal((await request('/auth/login', 'POST', { email: account.email, password: oldPassword }, '')).status, 401)
    const fresh = await login(newPassword)
    assert.equal((await request('/auth/me', 'GET', undefined, fresh)).data.user.id, account.id)
    assert.ok(statements.some(({ sql }) => sql === 'COMMIT'))
})
test('wrong current password preserves hash and session', async () => {
    const previous = account.password_hash
    const r = await request('/profile/password', 'PUT', { ...passwordBody(), currentPassword: 'incorrect-current-password' })
    assert.equal(r.status, 400); assert.equal(r.data.error, 'Current password is incorrect')
    assert.equal(account.password_hash, previous)
    assert.equal((await request('/auth/me')).data.user.id, account.id)
})
test('password policy, confirmation and malformed values are authoritative', async () => {
    for (const fields of [{ currentPassword: null }, { currentPassword: {} }, { newPassword: 'short' }, { newPassword: 'x'.repeat(73) }, { newPassword: '😀'.repeat(19) }, { newPassword: null }, { confirmPassword: 'mismatch' }, { role: 'admin' }, { newPassword: oldPassword, confirmPassword: oldPassword }]) {
        assert.equal((await request('/profile/password', 'PUT', { ...passwordBody(), ...fields })).status, 400)
    }
    assert.equal(statements.filter(({ sql }) => sql.startsWith('UPDATE')).length, 0)
})
test('password attempts are limited per authenticated account', async () => {
    let r
    for (let i = 0; i < 11; i++) r = await request('/profile/password', 'PUT', {})
    assert.equal(r.status, 429)
})
test('profile mutations require authentication and inactive accounts remain blocked', async () => {
    for (const path of ['/profile', '/profile/password']) assert.equal((await request(path, 'PUT', {}, '')).status, 401)
    account.active = false
    assert.equal((await request('/profile', 'PUT', {})).status, 401)
})
test('regular Users cannot submit Admin fields through status updates', async () => {
    for (const key of ['title', 'description', 'priority', 'userId', 'role']) {
        assert.equal((await request('/tasks/7/status', 'PATCH', { status: 'Completed', [key]: 'forged' })).status, 403)
    }
    assert.equal(statements.filter(({ sql }) => sql.startsWith('UPDATE tasks')).length, 0)
})
test('login racing a password change destroys the newly saved stale session', async context => {
    const original = pool.query
    let reads = 0
    context.mock.method(pool, 'query', async (sql, values) => {
        const result = await original(sql, values)
        if (sql.includes('WHERE lower(email) = $1') && ++reads === 2) result.rows[0].password_hash = await bcrypt.hash(newPassword, 4)
        return result
    })
    assert.equal((await request('/auth/login', 'POST', { email: account.email, password: oldPassword }, '')).status, 401)
})
