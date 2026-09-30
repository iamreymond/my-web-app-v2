const { test } = require('node:test')
const assert = require('node:assert/strict')
const net = require('node:net')
const { spawn } = require('node:child_process')
const { once } = require('node:events')
const { randomBytes } = require('node:crypto')
const { join } = require('node:path')

test('an occupied port fails startup without reporting a running server', async () => {
    const occupied = net.createServer().listen(0)
    await once(occupied, 'listening')
    try {
        const child = spawn(process.execPath, ['server.js'], {
            cwd: join(__dirname, '..'), windowsHide: true,
            env: { ...process.env, NODE_ENV: 'test', PORT: String(occupied.address().port),
                SESSION_SECRET: randomBytes(48).toString('hex'), DB_HOST: 'localhost',
                DB_PORT: '5432', DB_NAME: 'unused', DB_USER: 'unused', DB_PASSWORD: 'test-only-unused' },
            timeout: 10000,
        })
        let output = ''
        child.stdout.on('data', chunk => { output += chunk })
        child.stderr.on('data', chunk => { output += chunk })
        const [code] = await once(child, 'close')
        assert.equal(code, 1)
        assert.doesNotMatch(output, /Server is running/)
        assert.match(output, /EADDRINUSE/)
    } finally { await new Promise(resolve => occupied.close(resolve)) }
})
