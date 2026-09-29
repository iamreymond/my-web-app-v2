import { useState } from 'react'
import TaskForm from '../components/TaskForm.jsx'
import ConfirmDelete from '../components/ConfirmDelete.jsx'
import PriorityBadge from '../components/PriorityBadge.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { taskPriorities, taskStatuses } from '../data/taskOptions.js'
import { filterTasks, formatDate } from '../services/management.js'
import * as api from '../services/api.js'

function AdminTasks({ tasks, users, onCreateTask, onUpdateTask, onDeleteTask }) {
    const [filters, setFilters] = useState({ search: '', status: '', priority: '', userId: '', sort: 'newest' })
    const [panel, setPanel] = useState(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const visible = filterTasks(tasks, filters)
    const filter = (key, value) => setFilters(current => ({ ...current, [key]: value }))
    const assignee = id => users.find(user => user.id === id)?.name || 'Unassigned'
    async function perform(work, success) {
        setBusy(true); setError(''); setMessage('')
        try { await work(); setMessage(success) }
        catch (error) { setError(error.message) }
        finally { setBusy(false) }
    }
    return <div className="management">
        <div className="page-header"><h2>Task Management</h2><p>Plan, assign, and maintain application work.</p></div>
        {error && <p role="alert" className="message message-error">{error}</p>}
        <p role="status">{busy ? 'Working…' : message}</p>
        <TaskForm key={panel?.mode === 'edit' ? panel.task.id : 'create'} users={users}
            task={panel?.mode === 'edit' ? panel.task : undefined}
            onCancel={panel?.mode === 'edit' ? () => setPanel(null) : undefined}
            onCreateTask={async fields => {
                if (panel?.mode === 'edit') { await onUpdateTask(panel.task.id, fields); setPanel(null); setMessage('Task updated.') }
                else await onCreateTask(fields)
            }} />
        {panel?.mode === 'view' && <section className="card detail-panel" aria-label="Task details">
            <h3>{panel.task.title}</h3><p className="description">{panel.task.description || 'No description'}</p>
            <p>{panel.task.status} · {panel.task.priority} priority · Assigned: {assignee(panel.task.userId)}</p>
            <p>Created: {formatDate(panel.task.createdAt)}<br />Updated: {formatDate(panel.task.updatedAt)}</p>
            <button onClick={() => setPanel(null)}>Close Details</button>
        </section>}
        <div className="filters">
            <label>Search tasks<input value={filters.search} onChange={e => filter('search', e.target.value)} placeholder="Task title" /></label>
            <label>Filter status<select value={filters.status} onChange={e => filter('status', e.target.value)}><option value="">All statuses</option>{taskStatuses.map(value => <option key={value}>{value}</option>)}</select></label>
            <label>Filter priority<select value={filters.priority} onChange={e => filter('priority', e.target.value)}><option value="">All priorities</option>{taskPriorities.map(value => <option key={value}>{value}</option>)}</select></label>
            <label>Filter assignee<select value={filters.userId} onChange={e => filter('userId', e.target.value)}><option value="">All assignees</option><option value="unassigned">Unassigned</option>{users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
            <label>Sort tasks<select value={filters.sort} onChange={e => filter('sort', e.target.value)}><option value="newest">Newest first</option><option value="title">Title A–Z</option><option value="priority">Highest priority</option></select></label>
        </div>
        <p>{visible.length} of {tasks.length} tasks</p>
        {!visible.length && <p className="card empty-state">No tasks match these filters.</p>}
        <div className="management-list">{visible.map(task => <article key={task.id} className="card" aria-label={`Task ${task.title}`}>
            <div className="task-header"><h3>{task.title}</h3><StatusBadge status={task.status} /></div>
            <p className="description">{task.description || 'No description'}</p>
            <div className="task-meta"><PriorityBadge priority={task.priority} /><span>Assigned: {assignee(task.userId)}</span></div>
            <div className="actions">
                {['view', 'edit'].map(mode => <button key={mode} disabled={busy} onClick={() => perform(async () => setPanel({ mode, task: await api.getTask(task.id) }), '')}>{mode === 'view' ? 'View' : 'Edit'}</button>)}
                <button className="danger" disabled={busy} onClick={() => { setPanel({ mode: 'delete', task }); setError('') }}>Delete</button>
            </div>
            {panel?.mode === 'delete' && panel.task.id === task.id && <ConfirmDelete name={task.title} busy={busy} onCancel={() => setPanel(null)}
                onConfirm={() => perform(async () => { await onDeleteTask(task.id); setPanel(null) }, 'Task deleted.')} />}
        </article>)}</div>
    </div>
}
export default AdminTasks
