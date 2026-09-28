// Express forwards parser and route failures here so clients always receive JSON.
function errorHandler(error, req, res, next) {
    if (res.headersSent) return next(error)
    if (error.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Request body must be valid JSON' })
    }
    if (error.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Request body exceeds the 100 KB limit' })
    }
    if (error.status === 415) {
        return res.status(415).json({ error: 'Unsupported request encoding or charset' })
    }
    // Log a code rather than SQL details or submitted personal information.
    console.error('API request failed:', req.method, req.path, error.code || 'INTERNAL_ERROR')
    res.status(500).json({ error: 'An unexpected server error occurred' })
}

module.exports = errorHandler
