function ConfirmDelete({ name, busy, onConfirm, onCancel }) {
    return <div className="confirmation" role="group" aria-label={`Confirm deletion of ${name}`}>
        <p>Delete <strong>{name}</strong>? This cannot be undone.</p>
        <div className="actions">
            <button className="danger" disabled={busy} onClick={onConfirm}>{busy ? 'Deleting…' : 'Confirm Delete'}</button>
            <button disabled={busy} onClick={onCancel}>Cancel Delete</button>
        </div>
    </div>
}
export default ConfirmDelete
