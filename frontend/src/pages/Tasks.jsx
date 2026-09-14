import TaskForm from '../components/TaskForm.jsx'
import StatusBadge from '../components/StatusBadge.jsx'

function Tasks({
    tasks,
    users,
    onCreateTask,
    onChangeTaskStatus,
}) {
    function getUserName(userId) {
        const user = users.find(
            item => item.id === userId
        )

        return user ? user.name : 'Unassigned'
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Tasks</h2>
                    <p>
                        Create and manage application work items.
                    </p>
                </div>
            </div>

            <TaskForm
                users={users}
                onCreateTask={onCreateTask}
            />

            <div className="task-list">
                {tasks.length === 0 ? (
                    <div className="card empty-state">
                        No tasks found.
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
                                <span>
                                    Priority: {task.priority}
                                </span>

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
                                        onChange={event =>
                                            onChangeTaskStatus(
                                                task.id,
                                                event.target.value
                                            )
                                        }
                                    >
                                        <option>Open</option>
                                        <option>In Progress</option>
                                        <option>Completed</option>
                                    </select>
                                </label>
                            </div>
                        </article>
                    ))
                )}
            </div>
        </div>
    )
}

export default Tasks