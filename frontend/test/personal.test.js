import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filterMyTasks, personalSummary, passwordError } from '../src/services/personal.js'
import * as api from '../src/services/api.js'
const tasks = [
    { id: 1, title: 'First', description: 'Documentation', status: 'Open', priority: 'Low', userId: 2, createdAt: '2026-09-01' },
    { id: 2, title: 'Second', description: null, status: 'Completed', priority: 'High', userId: 2, createdAt: '2026-09-02' },
    { id: 3, title: 'Third', description: 'Review', status: 'In Progress', priority: 'Medium', userId: 2, createdAt: '2026-09-03' },
]
test('personal task search includes description and combines status/priority filters', () => {
    assert.deepEqual(filterMyTasks(tasks, { search: ' DOCUMENT ', status: 'Open', priority: 'Low' }).map(t => t.id), [1])
    assert.deepEqual(filterMyTasks(tasks, { search: 'second', priority: 'Low' }), [])
    assert.deepEqual(filterMyTasks([], {}), [])
})
test('personal task sorting is stable and leaves shared state unchanged', () => {
    for (const [sort, expected] of [['newest', [3, 2, 1]], ['oldest', [1, 2, 3]], ['priority', [2, 3, 1]], ['status', [1, 3, 2]]]) {
        assert.deepEqual(filterMyTasks(tasks, { sort }).map(t => t.id), expected)
    }
    assert.deepEqual(tasks.map(t => t.id), [1, 2, 3])
})
test('personal dashboard summarizes only supplied own tasks and excludes completed attention items', () => {
    assert.deepEqual(personalSummary(tasks), { total: 3, priorities: { High: 1, Medium: 1, Low: 1 }, attention: [tasks[2], tasks[0]] })
    assert.equal(personalSummary([]).attention.length, 0)
})
test('profile update uses the self-service endpoint and returns saved account data', async context => {
    const user = { id: 2, name: 'Changed', email: 'changed@example.invalid', role: 'user', active: true }
    context.mock.method(globalThis, 'fetch', async (url, options) => {
        assert.equal(url, '/api/profile'); assert.equal(options.method, 'PUT')
        assert.deepEqual(JSON.parse(options.body), { name: user.name, email: user.email })
        return Response.json(user)
    })
    assert.deepEqual(await api.updateProfile({ name: user.name, email: user.email }), user)
})
test('successful password change triggers authentication clearing but failures preserve the session', async context => {
    const events = []
    globalThis.window = { dispatchEvent: event => events.push(event.type) }
    context.after(() => { delete globalThis.window })
    const fields = { currentPassword: 'test-only-current', newPassword: 'test-only-replacement', confirmPassword: 'test-only-replacement' }
    const mocked = context.mock.method(globalThis, 'fetch', async (url, options) => {
        assert.equal(url, '/api/profile/password'); assert.equal(options.method, 'PUT')
        assert.deepEqual(JSON.parse(options.body), fields)
        return Response.json({ message: 'Your password has been changed. Please sign in again.' })
    })
    await api.changePassword(fields)
    assert.deepEqual(events, ['password-changed'])
    mocked.mock.mockImplementation(async () => Response.json({ error: 'Current password is incorrect' }, { status: 400 }))
    await assert.rejects(api.changePassword(fields), /Current password is incorrect/)
    assert.deepEqual(events, ['password-changed'])
})
test('password form validation checks UTF-8 byte limits and confirmation', () => {
    const valid = { currentPassword: 'test-only-current', newPassword: 'test-only-new-secret', confirmPassword: 'test-only-new-secret' }
    assert.equal(passwordError(valid), '')
    for (const change of [{ currentPassword: '' }, { newPassword: 'short' }, { newPassword: '😀'.repeat(19) }, { confirmPassword: 'mismatch' }, { newPassword: valid.currentPassword, confirmPassword: valid.currentPassword }]) assert.notEqual(passwordError({ ...valid, ...change }), '')
})
