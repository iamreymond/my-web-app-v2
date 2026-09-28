const { test } = require('node:test')
const assert = require('node:assert/strict')
const validate = require('../config/environment')

// Use temporary process values only; tests neither read nor change the real .env file.
function withEnvironment(overrides, run) {
    const values = {
        DB_HOST: 'localhost', DB_PORT: '5432', DB_NAME: 'my_web_app_v2',
        DB_USER: 'postgres', DB_PASSWORD: 'test-only-not-a-real-password', ...overrides,
    }
    const previous = {}
    for (const name of Object.keys(values)) {
        previous[name] = process.env[name]
        process.env[name] = values[name]
    }
    try { run() } finally {
        for (const name of Object.keys(values)) {
            if (previous[name] === undefined) delete process.env[name]
            else process.env[name] = previous[name]
        }
    }
}

test('valid database environment is accepted', () => {
    withEnvironment({}, () => assert.doesNotThrow(validate))
})

test('missing settings fail without revealing credential values', () => {
    for (const name of ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']) {
        withEnvironment({ [name]: '' }, () => assert.throws(validate, {
            message: `Missing required environment variable: ${name}`,
        }))
    }
})

test('invalid ports and the example password are rejected', () => {
    for (const port of ['0', '65536', '1.5', 'abc', '1e3']) {
        withEnvironment({ DB_PORT: port }, () => assert.throws(validate, /DB_PORT/))
    }
    withEnvironment({ DB_PASSWORD: 'your_local_postgres_password' }, () => {
        assert.throws(validate, /placeholder/)
    })
})
