import { useState } from 'react'
import PriorityBadge from '../components/PriorityBadge.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { taskPriorities, taskStatuses } from '../data/taskOptions.js'
import { formatDate } from '../services/management.js'
import { filterMyTasks } from '../services/personal.js'
import { getTask } from '../services/api.js'

function Tasks({ tasks, onChangeTaskStatus }) {
    const [filters, setFilters] = useState({ search: '', status: '', priority: '', sort: 'newest' })
    const [busy, setBusy] = useState(null)
    const [detail, setDetail] = useState(null)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const visible = filterMyTasks(tasks, filters)
    const filter = (key, value) => setFilters(current => ({ ...current, [key]: value }))

    async function changeStatus(id, status) {
        if (busy !== null) return
        setBusy(id); setError(''); setMessage('')
        try {
            // Shared state changes only after the ownership-checked API confirms the saved record.
            const saved = await onChangeTaskStatus(id, status)
            if (detail?.id === id) setDetail(saved)
            setMessage('Task status updated. If it no longer matches your filters, it is hidden from this list.')
        } catch (error) { setError(error.message) }
        finally { setBusy(null) }
    }
    async function view(id) {
        if (busy !== null) return
        setBusy(id); setError(''); setDetail(null)
        try { setDetail(await getTask(id)) }
        catch (error) { setError(error.message) }
        finally { setBusy(null) }
    }
    return <div className="personal management">
        <div className="page-header"><h2>My Tasks</h2><p>Only work assigned to you. You can update status; other task changes are managed by an Admin.</p></div>
        {error && <p role="alert" className="message message-error">{error}</p>}
        <p role="status">{busy !== null ? 'Working…' : message}</p>
        {detail && <section className="card detail-panel" aria-label="Task details">
            <h3>{detail.title}</h3><p className="description">{detail.description || 'No description'}</p>
            <div className="task-meta"><StatusBadge status={detail.status} /><PriorityBadge priority={detail.priority} /></div>
            <p>Created: {formatDate(detail.createdAt)}<br />Updated: {formatDate(detail.updatedAt)}</p>
            <button onClick={() => setDetail(null)}>Close Details</button>
        </section>}
        <div className="filters">
            <label>Search my tasks<input value={filters.search} onChange={e => filter('search', e.target.value)} placeholder="Title or description" /></label>
            <label>Filter status<select value={filters.status} onChange={e => filter('status', e.target.value)}><option value="">All statuses</option>{taskStatuses.map(value => <option key={value}>{value}</option>)}</select></label>
            <label>Filter priority<select value={filters.priority} onChange={e => filter('priority', e.target.value)}><option value="">All priorities</option>{taskPriorities.map(value => <option key={value}>{value}</option>)}</select></label>
            <label>Sort my tasks<select value={filters.sort} onChange={e => filter('sort', e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="priority">Highest priority</option><option value="status">Status: Open first</option></select></label>
        </div>
        <p>{visible.length} of {tasks.length} assigned tasks</p>
        {!visible.length && <p className="card empty-state">{tasks.length ? 'No tasks match these filters.' : 'No tasks are assigned to you yet.'}</p>}
        <div className="task-list">{visible.map(task => <article className="card task-card" key={task.id} aria-label={`Task ${task.title}`}>
            <div className="task-header"><h3>{task.title}</h3><StatusBadge status={task.status} /></div>
            <p className="description">{task.description || 'No description'}</p>
            <div className="task-meta"><PriorityBadge priority={task.priority} /><span>Created: {formatDate(task.createdAt)}<br />Updated: {formatDate(task.updatedAt)}</span></div>
            <div className="actions personal-task-actions">
                <button disabled={busy !== null} onClick={() => view(task.id)}>View Details</button>
                <label>Status<select aria-label={`Status for ${task.title}`} disabled={busy !== null} value={task.status} onChange={e => changeStatus(task.id, e.target.value)}>
                    {taskStatuses.map(value => <option key={value}>{value}</option>)}
                </select></label>
            </div>
        </article>)}</div>
    </div>
}
export default Tasks
