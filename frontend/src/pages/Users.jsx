import { useState } from 'react'
import UserForm from '../components/UserForm.jsx'
import ConfirmDelete from '../components/ConfirmDelete.jsx'
import * as api from '../services/api.js'
import { filterUsers, formatDate } from '../services/management.js'

function Users({ users, account, onCreateUser, onUpdateUser, onStatusUser, onDeleteUser }) {
    const [filters, setFilters] = useState({ search: '', role: '', active: '', sort: 'name' })
    const [panel, setPanel] = useState(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const visible = filterUsers(users, filters)
    const filter = (key, value) => setFilters(current => ({ ...current, [key]: value }))

    async function perform(work, success) {
        setBusy(true); setError(''); setMessage('')
        try { await work(); setMessage(success) }
        catch (error) { setError(error.message) }
        finally { setBusy(false) }
    }
    async function open(user, mode) {
        // Load current details before editing so a stale list is not the source of truth.
        await perform(async () => setPanel({ mode, user: await api.getUser(user.id) }), '')
    }
    return <div className="management">
        <div className="page-header"><h2>User Management</h2><p>Manage accounts, access, and assigned workload.</p></div>
        {error && <p role="alert" className="message message-error">{error}</p>}
        <p role="status">{busy ? 'Working…' : message}</p>
        {panel?.mode === 'edit' ? <UserForm key={panel.user.id} user={panel.user}
            onCancel={() => setPanel(null)} onCreateUser={async fields => {
                await onUpdateUser(panel.user.id, fields); setPanel(null); setMessage('User updated.')
            }} /> : <UserForm onCreateUser={onCreateUser} />}
        {panel?.mode === 'view' && <section className="card detail-panel" aria-label="User details">
            <h3>{panel.user.name}</h3><p>{panel.user.email} · {panel.user.role} · {panel.user.active ? 'Active' : 'Inactive'}</p>
            <p>Created: {formatDate(panel.user.createdAt)}<br />Updated: {formatDate(panel.user.updatedAt)}</p>
            <p>Assigned tasks: {panel.user.taskSummary.total} · Open: {panel.user.taskSummary.open} · In progress: {panel.user.taskSummary.inProgress} · Completed: {panel.user.taskSummary.completed}</p>
            {panel.user.canLogin === false && <p>Login not enabled for this legacy account.</p>}
            <button onClick={() => setPanel(null)}>Close Details</button>
        </section>}
        <div className="filters">
            <label>Search users<input value={filters.search} onChange={e => filter('search', e.target.value)} placeholder="Name or email" /></label>
            <label>Filter role<select value={filters.role} onChange={e => filter('role', e.target.value)}><option value="">All roles</option><option value="admin">Admin</option><option value="user">User</option></select></label>
            <label>Filter account status<select value={filters.active} onChange={e => filter('active', e.target.value)}><option value="">All statuses</option><option value="true">Active</option><option value="false">Inactive</option></select></label>
            <label>Sort users<select value={filters.sort} onChange={e => filter('sort', e.target.value)}><option value="name">Name A–Z</option><option value="newest">Newest first</option></select></label>
        </div>
        <p>{visible.length} of {users.length} users</p>
        {!visible.length && <p className="card empty-state">No users match these filters.</p>}
        <div className="management-list">{visible.map(user => <article className="card" key={user.id} aria-label={`User ${user.name}`}>
            <div className="task-header"><div><h3>{user.name}</h3><p>{user.email}</p></div><span className={`status ${user.active ? 'status-completed' : ''}`}>{user.active ? 'Active' : 'Inactive'}</span></div>
            <p>{user.role} · Created: {formatDate(user.createdAt)}{user.canLogin === false && ' · Login not enabled'}</p>
            <div className="actions">
                <button disabled={busy} onClick={() => open(user, 'view')}>View</button>
                <button disabled={busy} onClick={() => open(user, 'edit')}>Edit</button>
                <button disabled={busy || user.id === account.id} onClick={() => perform(async () => {
                    await onStatusUser(user.id, !user.active); setPanel(null)
                }, user.active ? 'User deactivated. Existing sessions revoked.' : 'User reactivated.')}>{user.active ? 'Deactivate' : 'Activate'}</button>
                <button className="danger" disabled={busy || user.id === account.id} onClick={() => { setPanel({ mode: 'delete', user }); setError('') }}>Delete</button>
            </div>
            {user.id === account.id && <p className="form-hint">Your current Admin account cannot be deleted, deactivated, or demoted.</p>}
            {panel?.mode === 'delete' && panel.user.id === user.id && <ConfirmDelete name={user.name} busy={busy} onCancel={() => setPanel(null)}
                onConfirm={() => perform(async () => { await onDeleteUser(user.id); setPanel(null) }, 'User deleted.')} />}
        </article>)}</div>
    </div>
}
export default Users
