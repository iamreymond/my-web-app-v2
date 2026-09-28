// Reject absent bodies and arrays before handlers try to read object fields.
function jsonBody(req, res, next) {
    if (!req.is('application/json')) {
        return res.status(415).json({ error: 'Content-Type must be application/json' })
    }
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({ error: 'Request body must be a JSON object' })
    }
    next()
}

module.exports = jsonBody
