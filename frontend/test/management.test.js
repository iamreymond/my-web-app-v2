import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filterUsers, filterTasks } from '../src/services/management.js'
import * as api from '../src/services/api.js'

test('user search, role/status filtering and sorting do not mutate source state', () => {
    const users = [{ id: 1, name: 'Zoe', email: 'z@example.invalid', role: 'admin', active: true }, { id: 2, name: 'Amy', email: 'a@example.invalid', role: 'user', active: false }]
    assert.deepEqual(filterUsers(users, {}).map(u => u.id), [2, 1])
    assert.deepEqual(filterUsers(users, { search: ' Z@ ', role: 'admin', active: 'true' }).map(u => u.id), [1])
    assert.equal(filterUsers(users, { active: 'false' }).length, 1)
    assert.equal(filterUsers(users, { search: 'absent' }).length, 0)
    assert.deepEqual(users.map(u => u.id), [1, 2])
})
test('task filters combine assignment, status, priority and title with stable sorting', () => {
    const tasks = [{ id: 1, title: 'Z task', status: 'Open', priority: 'High', userId: null }, { id: 2, title: 'A task', status: 'Completed', priority: 'Low', userId: 3 }]
    assert.deepEqual(filterTasks(tasks, { sort: 'priority' }).map(t => t.id), [1, 2])
    assert.deepEqual(filterTasks(tasks, { userId: '3', status: 'Completed', priority: 'Low', search: 'A TASK' }).map(t => t.id), [2])
    assert.deepEqual(filterTasks(tasks, { userId: 'unassigned' }).map(t => t.id), [1])
    assert.deepEqual(filterTasks(tasks, { sort: 'title' }).map(t => t.id), [2, 1])
    assert.deepEqual(tasks.map(t => t.id), [1, 2])
})
test('management API methods send correct paths, methods and JSON payloads', async context => {
    const user = { id: 2, name: 'User', email: 'u@example.invalid', role: 'user', active: true }
    const task = { id: 7, title: 'Work', description: '', status: 'Open', priority: 'High', userId: 2 }
    const calls = []
    context.mock.method(globalThis, 'fetch', async (url, options) => {
        calls.push([url, options.method || 'GET', options.body ? JSON.parse(options.body) : undefined])
        assert.equal(options.credentials, 'same-origin')
        assert.equal(options.headers['X-Requested-With'], 'WorkTracker')
        return Response.json(options.method === 'DELETE' ? { message: 'Deleted' } : url.includes('users') ? user : task)
    })
    await api.getUser(2); await api.updateUser(2, user); await api.updateUserStatus(2, false); await api.deleteUser(2)
    await api.getTask(7); await api.updateTask(7, task); await api.deleteTask(7)
    assert.deepEqual(calls, [['/api/users/2', 'GET', undefined], ['/api/users/2', 'PUT', user], ['/api/users/2/status', 'PATCH', { active: false }], ['/api/users/2', 'DELETE', undefined], ['/api/tasks/7', 'GET', undefined], ['/api/tasks/7', 'PUT', task], ['/api/tasks/7', 'DELETE', undefined]])
})
test('blocked deletion preserves the backend business-rule message', async context => {
    context.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'This user cannot be deleted while tasks are assigned.' }, { status: 409 }))
    await assert.rejects(api.deleteUser(2), /tasks are assigned/)
})
