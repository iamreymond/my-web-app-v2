import { taskPriorities, taskStatuses } from '../data/taskOptions.js'

// Keep HTTP details here so components only deal with records and readable errors.
async function request(endpoint, options = {}) {
    const timeout = AbortSignal.timeout(15000)
    const signal = options.signal
        ? AbortSignal.any([options.signal, timeout])
        : timeout

    try {
        const response = await fetch(`/api${endpoint}`, {
            ...options,
            signal,
            headers: { Accept: 'application/json', ...options.headers },
        })
        // A proxy error can be HTML or empty, so never display raw server content.
        const isJson = response.headers.get('content-type')?.includes('application/json')
        const data = isJson ? await response.json() : null
        if (!response.ok) {
            if (response.status >= 500) {
                throw new Error('The service is unavailable. Please try again shortly.')
            }
            throw new Error(typeof data?.error === 'string'
                ? data.error
                : 'The request could not be completed. Please try again.')
        }
        if (!isJson || data === null) throw new Error('The service returned an unexpected response. Please reload and try again.')
        return data
    } catch (error) {
        // Canceled page loads are handled silently by App's effect cleanup.
        if (options.signal?.aborted) throw error
        if (timeout.aborted) {
            throw new Error('The request timed out. Reload to check whether changes were saved before trying again.')
        }
        if (error instanceof TypeError) {
            throw new Error('Unable to reach the service. Check your connection and try again.')
        }
        if (error instanceof SyntaxError) {
            throw new Error('The service returned an unexpected response. Please reload and try again.')
        }
        throw error
    }
}

function isUser(user) {
    return user && Number.isInteger(user.id) && user.id > 0 &&
        typeof user.name === 'string' && typeof user.email === 'string'
}

function isTask(task) {
    return task && Number.isInteger(task.id) && task.id > 0 &&
        typeof task.title === 'string' &&
        (task.description === null || typeof task.description === 'string') &&
        taskStatuses.includes(task.status) && taskPriorities.includes(task.priority) &&
        (task.userId === null || (Number.isInteger(task.userId) && task.userId > 0))
}

// Reject incompatible records before they reach components that expect these fields.
function validate(data, isRecord, isList = false) {
    const valid = isList ? Array.isArray(data) && data.every(isRecord) : isRecord(data)
    if (!valid) throw new Error('The service returned unexpected data. Please reload and try again.')
    return data
}

function jsonOptions(method, body) {
    return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

export async function getUsers(signal) {
    return validate(await request('/users', { signal }), isUser, true)
}

export async function getTasks(signal) {
    return validate(await request('/tasks', { signal }), isTask, true)
}

export async function createUser(user) {
    return validate(await request('/users', jsonOptions('POST', user)), isUser)
}

export async function createTask(task) {
    return validate(await request('/tasks', jsonOptions('POST', task)), isTask)
}

export async function updateTaskStatus(id, status) {
    return validate(await request(`/tasks/${id}/status`, jsonOptions('PATCH', { status })), isTask)
}
