import { useState } from 'react'

function TaskForm({ users, onCreateTask }) {
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [priority, setPriority] = useState('Medium')
    const [userId, setUserId] = useState('')

    function handleSubmit(event) {
        event.preventDefault()

        onCreateTask({
            title: title.trim(),
            description: description.trim(),
            priority,
            userId: userId ? Number(userId) : null,
        })

        setTitle('')
        setDescription('')
        setPriority('Medium')
        setUserId('')
    }

    return (
        <form className="form" onSubmit={handleSubmit}>
            <h3>Create Task</h3>

            <div className="form-group">
                <label htmlFor="task-title">Title</label>
                <input
                    id="task-title"
                    type="text"
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
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                </select>
            </div>

            <div className="form-group">
                <label htmlFor="task-user">
                    Assigned User
                </label>

                <select
                    id="task-user"
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

            <button type="submit">
                Create Task
            </button>
        </form>
    )
}

export default TaskForm