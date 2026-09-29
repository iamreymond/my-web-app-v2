const bcrypt = require('bcryptjs')

function validPassword(password) {
    // bcrypt only considers 72 UTF-8 bytes; reject longer input rather than silently truncate it.
    return typeof password === 'string' && password.length >= 12 && !bcrypt.truncates(password)
}

async function hashPassword(password) {
    // bcrypt generates a random salt and stores it with the adaptive password hash.
    return bcrypt.hash(password, 12)
}

module.exports = { validPassword, hashPassword }
