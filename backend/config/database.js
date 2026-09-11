const { Pool } = require('pg')

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'my_web_app_v2',
    user: 'postgres',
    password: '11111111',
})

module.exports = pool