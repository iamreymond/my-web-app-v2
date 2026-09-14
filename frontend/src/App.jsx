import { useState } from 'react'
import Dashboard from './pages/Dashboard.jsx'
import Users from './pages/Users.jsx'
import Tasks from './pages/Tasks.jsx'
import {
    initialUsers,
    initialTasks,
} from './data/mockData.js'

function App() {
    const [currentPage, setCurrentPage] =
        useState('dashboard')

    const [users, setUsers] =
        useState(initialUsers)

    const [tasks, setTasks] =
        useState(initialTasks)

    function createUser(user) {
        const newUser = {
            id: Date.now(),
            ...user,
        }

        setUsers(currentUsers => [
            ...currentUsers,
            newUser,
        ])
    }

    function createTask(task) {
        const newTask = {
            id: Date.now(),
            status: 'Open',
            ...task,
        }

        setTasks(currentTasks => [
            ...currentTasks,
            newTask,
        ])
    }

    function changeTaskStatus(taskId, status) {
        setTasks(currentTasks =>
            currentTasks.map(task =>
                task.id === taskId
                    ? { ...task, status }
                    : task
            )
        )
    }

    function renderPage() {
        if (currentPage === 'users') {
            return (
                <Users
                    users={users}
                    onCreateUser={createUser}
                />
            )
        }

        if (currentPage === 'tasks') {
            return (
                <Tasks
                    tasks={tasks}
                    users={users}
                    onCreateTask={createTask}
                    onChangeTaskStatus={
                        changeTaskStatus
                    }
                />
            )
        }

        return (
            <Dashboard
                users={users}
                tasks={tasks}
            />
        )
    }

    return (
        <div className="app">
            <header className="app-header">
                <div>
                    <h1>My Web App V2</h1>
                    <span>Work Tracker</span>
                </div>

                <nav>
                    <button
                        className={
                            currentPage === 'dashboard'
                                ? 'nav-active'
                                : ''
                        }
                        onClick={() =>
                            setCurrentPage('dashboard')
                        }
                    >
                        Dashboard
                    </button>

                    <button
                        className={
                            currentPage === 'users'
                                ? 'nav-active'
                                : ''
                        }
                        onClick={() =>
                            setCurrentPage('users')
                        }
                    >
                        Users
                    </button>

                    <button
                        className={
                            currentPage === 'tasks'
                                ? 'nav-active'
                                : ''
                        }
                        onClick={() =>
                            setCurrentPage('tasks')
                        }
                    >
                        Tasks
                    </button>
                </nav>
            </header>

            <main className="container">
                {renderPage()}
            </main>

            <footer className="app-footer">
                <p>
                    &copy; 2026 My Web App V2
                </p>
            </footer>
        </div>
    )
}

export default App