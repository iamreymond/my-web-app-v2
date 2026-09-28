import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as api from '../src/services/api.js'

const user = { id: 1, name: 'Test User', email: 'test@example.invalid' }
const task = { id: 2, title: 'Test Task', description: '', status: 'Open', priority: 'Medium', userId: 1 }

test('loads valid records and rejects incompatible responses', async context => {
    const fetchMock = context.mock.method(globalThis, 'fetch', async () => Response.json([user]))
    assert.deepEqual(await api.getUsers(), [user])
    fetchMock.mock.mockImplementation(async () => Response.json([task]))
    assert.deepEqual(await api.getTasks(), [task])
    for (const data of [{}, [null], [{ ...task, status: 'Unknown' }]]) {
        fetchMock.mock.mockImplementation(async () => Response.json(data))
        await assert.rejects(api.getTasks(), /unexpected data/)
    }
})

test('writes use JSON and the correct REST methods and return saved records', async context => {
    const calls = []
    context.mock.method(globalThis, 'fetch', async (url, options) => {
        calls.push({ url, method: options.method, body: JSON.parse(options.body) })
        assert.equal(options.headers['Content-Type'], 'application/json')
        return Response.json(url === '/api/users' ? user : task)
    })
    assert.deepEqual(await api.createUser({ name: user.name, email: user.email }), user)
    assert.deepEqual(await api.createTask({ title: task.title, userId: 1 }), task)
    await api.updateTaskStatus(2, 'Completed')
    assert.deepEqual(calls, [
        { url: '/api/users', method: 'POST', body: { name: user.name, email: user.email } },
        { url: '/api/tasks', method: 'POST', body: { title: task.title, userId: 1 } },
        { url: '/api/tasks/2/status', method: 'PATCH', body: { status: 'Completed' } },
    ])
})

test('validation messages are preserved while server details are hidden', async context => {
    const fetchMock = context.mock.method(globalThis, 'fetch', async () =>
        Response.json({ error: 'Email already exists' }, { status: 409 }))
    await assert.rejects(api.createUser(user), /Email already exists/)
    fetchMock.mock.mockImplementation(async () => Response.json({ error: 'internal details' }, { status: 500 }))
    await assert.rejects(api.getUsers(), { message: 'The service is unavailable. Please try again shortly.' })
    fetchMock.mock.mockImplementation(async () => new Response('', { status: 502 }))
    await assert.rejects(api.getTasks(), /service is unavailable/)
})

test('HTML and malformed JSON produce readable errors', async context => {
    const fetchMock = context.mock.method(globalThis, 'fetch', async () => new Response('<html>Error</html>'))
    await assert.rejects(api.getUsers(), /unexpected response/)
    fetchMock.mock.mockImplementation(async () => new Response('{', { headers: { 'Content-Type': 'application/json' } }))
    await assert.rejects(api.getUsers(), /unexpected response/)
})

test('connection failures produce a useful message without retrying writes', async context => {
    const fetchMock = context.mock.method(globalThis, 'fetch', async () => { throw new TypeError('fetch failed') })
    await assert.rejects(api.createTask(task), /Unable to reach the service/)
    assert.equal(fetchMock.mock.callCount(), 1)
})

test('canceling a page load cancels the fetch signal', async context => {
    const controller = new AbortController()
    context.mock.method(globalThis, 'fetch', async (url, options) => {
        controller.abort()
        assert.equal(options.signal.aborted, true)
        throw new DOMException('Aborted', 'AbortError')
    })
    await assert.rejects(api.getUsers(controller.signal), { name: 'AbortError' })
})
