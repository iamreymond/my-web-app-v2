import { useState } from 'react'
import { taskPriorities } from '../data/taskOptions.js'

function TaskForm({ users, onCreateTask }) {
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [priority, setPriority] = useState('Medium')
    const [userId, setUserId] = useState('')

    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Select values are strings; resolve the record to send its numeric database ID.
    async function handleSubmit(event) {
        event.preventDefault()

        if (isSubmitting) return
        setError('')
        setSuccess('')
        if (!title.trim()) {
            setError('Enter a task title containing more than spaces.')
            return
        }
        const assignedUser = users.find(user => String(user.id) === userId)
        if (userId && !assignedUser) {
            setError('Choose an available user or leave the task unassigned.')
            return
        }
        if (!taskPriorities.includes(priority)) {
            setError('Choose a valid priority.')
            return
        }
        setIsSubmitting(true)
        try {
            await onCreateTask({
                title: title.trim(),
                description: description.trim(),
                priority,
                userId: assignedUser ? assignedUser.id : null,
            })

            setTitle('')
            setDescription('')
            setPriority('Medium')
            setUserId('')
            setSuccess('Task created.')
        } catch (error) {
            setError(error.message || 'Unable to create task. Please try again.')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <form className="form" onSubmit={handleSubmit}>
            <h3>Create Task</h3>
            <p className="form-hint">Title is required. New tasks start as Open.</p>
            {error && <p className="message message-error" role="alert">{error}</p>}
            {success && <p className="message message-success" role="status">{success}</p>}
            <fieldset disabled={isSubmitting}>

                <div className="form-group">
                    <label htmlFor="task-title">Title</label>
                    <input
                        id="task-title"
                        type="text"
                        maxLength={200}
                        value={title}
                        onChange={event => setTitle(event.target.value)}
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="task-description">
                        Description
                    </label>

                    <textarea
                        id="task-description"
                        value={description}
                        onChange={event =>
                            setDescription(event.target.value)
                        }
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="task-priority">
                        Priority
                    </label>

                    <select
                        id="task-priority"
                        value={priority}
                        onChange={event =>
                            setPriority(event.target.value)
                        }
                    >
                        {taskPriorities.map(value => <option key={value}>{value}</option>)}
                    </select>
                </div>

                <div className="form-group">
                    <label htmlFor="task-user">
                        Assigned User
                    </label>

                    <select
                        id="task-user"
                        aria-describedby="assignment-hint"
                        value={userId}
                        onChange={event =>
                            setUserId(event.target.value)
                        }
                    >
                        <option value="">
                            Unassigned
                        </option>

                        {users.map(user => (
                            <option
                                key={user.id}
                                value={user.id}
                            >
                                {user.name}
                            </option>
                        ))}
                    </select>
                </div>

                <p id="assignment-hint" className="form-hint">{users.length === 0 ? 'Add a user on the Users page to assign tasks.' : 'Assignment is optional.'}</p>
                <button type="submit">
                    {isSubmitting ? 'Creating task…' : 'Create Task'}
                </button>
            </fieldset>
        </form>
    )
}

export default TaskForm
