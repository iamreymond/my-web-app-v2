import { useEffect, useState } from 'react'
import * as api from './services/api.js'
import DataState from './components/DataState.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Users from './pages/Users.jsx'
import Tasks from './pages/Tasks.jsx'

function App() {
    // All pages share the latest records returned by the API; PostgreSQL owns persistence.
    const [currentPage, setCurrentPage] =
        useState('dashboard')

    const [users, setUsers] =
        useState([])

    const [tasks, setTasks] =
        useState([])

    const [isLoading, setIsLoading] = useState(true)
    const [loadError, setLoadError] = useState('')
    const [loadAttempt, setLoadAttempt] = useState(0)

    // Load both collections together so assignment names and dashboard counts agree.
    useEffect(() => {
        const controller = new AbortController()
        async function loadApplicationData() {
            setIsLoading(true)
            setLoadError('')
            try {
                const [savedUsers, savedTasks] = await Promise.all([
                    api.getUsers(controller.signal),
                    api.getTasks(controller.signal),
                ])
                if (!controller.signal.aborted) {
                    setUsers(savedUsers)
                    setTasks(savedTasks)
                }
            } catch (error) {
                if (!controller.signal.aborted) setLoadError(error.message)
            } finally {
                if (!controller.signal.aborted) setIsLoading(false)
            }
        }
        loadApplicationData()
        // Prevent stale responses during unmount and React StrictMode's development checks.
        return () => controller.abort()
    }, [loadAttempt])

    // Only update shared state after the server confirms a save; forms handle failures.
    async function createUser(user) {
        const newUser = await api.createUser(user)

        setUsers(currentUsers => [
            ...currentUsers,
            newUser,
        ])
    }

    async function createTask(task) {
        const newTask = await api.createTask(task)

        setTasks(currentTasks => [
            ...currentTasks,
            newTask,
        ])
    }

    async function changeTaskStatus(taskId, status) {
        const updatedTask = await api.updateTaskStatus(taskId, status)
        setTasks(currentTasks =>
            currentTasks.map(task =>
                task.id === taskId
                    ? updatedTask
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

                <nav aria-label="Main navigation">
                    <button
                        aria-current={currentPage === 'dashboard' ? 'page' : undefined}
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
                        aria-current={currentPage === 'users' ? 'page' : undefined}
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
                        aria-current={currentPage === 'tasks' ? 'page' : undefined}
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
                <DataState
                    isLoading={isLoading}
                    error={loadError}
                    onRetry={() => setLoadAttempt(attempt => attempt + 1)}
                >
                    {renderPage()}
                </DataState>
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
