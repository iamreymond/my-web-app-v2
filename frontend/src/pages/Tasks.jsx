import DataState from '../components/DataState.jsx'
import { useState } from 'react'
import PriorityBadge from '../components/PriorityBadge.jsx'
import { taskStatuses } from '../data/taskOptions.js'
import TaskForm from '../components/TaskForm.jsx'
import StatusBadge from '../components/StatusBadge.jsx'

function Tasks({
    isAdmin = true,
    tasks,
    users,
    onCreateTask,
    onChangeTaskStatus,
    isLoading = false,
    error = '',
}) {
    const [savingTaskId, setSavingTaskId] = useState(null)
    const [statusError, setStatusError] = useState('')
    const [statusMessage, setStatusMessage] = useState('')

    // Keep the displayed status unchanged if the API request fails.
    async function handleStatusChange(taskId, status) {
        if (savingTaskId !== null) return
        setSavingTaskId(taskId)
        setStatusError('')
        setStatusMessage('')
        try {
            await onChangeTaskStatus(taskId, status)
            setStatusMessage('Task status updated.')
        } catch (error) {
            setStatusError(error.message || 'Unable to update status. Please try again.')
        } finally {
            setSavingTaskId(null)
        }
    }

    function getUserName(userId) {
        const user = users.find(
            item => item.id === userId
        )

        return user ? user.name : 'Unassigned'
    }

    return (
        <DataState isLoading={isLoading} error={error}>
            <div>
                <div className="page-header">
                    <div>
                        <h2>{isAdmin ? 'Tasks' : 'My Tasks'}</h2>
                        <p>
                            {isAdmin ? 'Create and manage application work items.' : 'View your assigned work and update its status.'}
                        </p>
                    </div>
                </div>

                {isAdmin && <TaskForm
                    users={users}
                    onCreateTask={onCreateTask}
                />}

                {statusError && <p className="message message-error" role="alert">{statusError}</p>}
                <p className="status-feedback" role="status">{savingTaskId !== null ? 'Saving status…' : statusMessage}</p>
                <div className="task-list">
                    {tasks.length === 0 ? (
                        <div className="card empty-state">
                            {isAdmin ? 'No tasks yet. Create your first task above.' : 'No tasks are assigned to you yet.'}
                        </div>
                    ) : (
                        tasks.map(task => (
                            <article
                                className="card task-card"
                                key={task.id}
                            >
                                <div className="task-header">
                                    <div>
                                        <h3>{task.title}</h3>

                                        <p>
                                            {task.description ||
                                                'No description'}
                                        </p>
                                    </div>

                                    <StatusBadge
                                        status={task.status}
                                    />
                                </div>

                                <div className="task-meta">
                                    <PriorityBadge priority={task.priority} />

                                    <span>
                                        Assigned: {
                                            getUserName(task.userId)
                                        }
                                    </span>
                                </div>

                                <div className="task-actions">
                                    <label>
                                        Status
                                        <select
                                            value={task.status}
                                            disabled={savingTaskId !== null}
                                            aria-label={`Status for ${task.title}`}
                                            onChange={event =>
                                                handleStatusChange(
                                                    task.id,
                                                    event.target.value
                                                )
                                            }
                                        >
                                            {taskStatuses.map(value => <option key={value}>{value}</option>)}
                                        </select>
                                    </label>
                                </div>
                            </article>
                        ))
                    )}
                </div>
            </div>
        </DataState>
    )
}

export default Tasks
