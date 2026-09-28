// Keep failed loading separate from empty data, and let the user retry explicitly.
function DataState({ isLoading = false, error = '', onRetry, children }) {
    if (isLoading) return <p className="card" role="status">Loading work tracker data…</p>
    if (error) return (
        <div className="card">
            <p className="message message-error" role="alert">{error}</p>
            {onRetry && <button type="button" onClick={onRetry}>Retry loading</button>}
        </div>
    )
    return children
}

export default DataState
