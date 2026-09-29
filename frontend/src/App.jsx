import { useEffect, useRef, useState } from 'react'
import * as api from './services/api.js'
import DataState from './components/DataState.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Users from './pages/Users.jsx'
import Tasks from './pages/Tasks.jsx'
import Login from './pages/Login.jsx'
import Profile from './pages/Profile.jsx'

function App() {
    const [account, setAccount] = useState(null)
    const [checkingSession, setCheckingSession] = useState(true)
    const [sessionError, setSessionError] = useState('')
    const [sessionAttempt, setSessionAttempt] = useState(0)
    const [currentPage, setCurrentPage] = useState('dashboard')
    const [users, setUsers] = useState([])
    const [tasks, setTasks] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [loadError, setLoadError] = useState('')
    const [loadAttempt, setLoadAttempt] = useState(0)
    const [logoutError, setLogoutError] = useState('')
    const [loggingOut, setLoggingOut] = useState(false)
    const accountId = useRef(null)
    accountId.current = account?.id

    // Restore the HttpOnly-cookie session without storing credentials in the browser.
    useEffect(() => {
        const controller = new AbortController()
        setCheckingSession(true)
        setSessionError('')
        api.getSession(controller.signal).then(user => {
            if (!controller.signal.aborted) setAccount(user)
        }).catch(error => {
            if (!controller.signal.aborted) setSessionError(error.message)
        }).finally(() => {
            if (!controller.signal.aborted) setCheckingSession(false)
        })
        return () => controller.abort()
    }, [sessionAttempt])

    useEffect(() => {
        function sessionExpired() {
            setAccount(null)
            setUsers([])
            setTasks([])
            setCurrentPage('dashboard')
        }
        window.addEventListener('session-expired', sessionExpired)
        return () => window.removeEventListener('session-expired', sessionExpired)
    }, [])

    // The API filters regular users' tasks. Never request the Admin user list for them.
    useEffect(() => {
        if (!account) return
        const controller = new AbortController()
        setIsLoading(true)
        setLoadError('')
        Promise.all([
            account.role === 'admin' ? api.getUsers(controller.signal) : Promise.resolve([account]),
            api.getTasks(controller.signal),
        ]).then(([savedUsers, savedTasks]) => {
            if (!controller.signal.aborted) {
                setUsers(savedUsers)
                setTasks(savedTasks)
            }
        }).catch(error => {
            if (!controller.signal.aborted) setLoadError(error.message)
        }).finally(() => {
            if (!controller.signal.aborted) setIsLoading(false)
        })
        return () => controller.abort()
    }, [account, loadAttempt])

    async function signIn(credentials) {
        const user = await api.login(credentials)
        setUsers([])
        setTasks([])
        setIsLoading(true)
        setCurrentPage('dashboard')
        setAccount(user)
        setLogoutError('')
    }

    async function signOut() {
        if (loggingOut) return
        setLoggingOut(true)
        setLogoutError('')
        try {
            await api.logout()
            setAccount(null)
            setUsers([])
            setTasks([])
            setCurrentPage('dashboard')
        } catch (error) { setLogoutError(error.message) }
        finally { setLoggingOut(false) }
    }

    // Ignore late mutation responses after logout or switching to another account.
    async function createUser(user) {
        const owner = account.id
        const saved = await api.createUser(user)
        if (accountId.current === owner) setUsers(current => [...current, saved])
    }

    async function createTask(task) {
        const owner = account.id
        const saved = await api.createTask(task)
        if (accountId.current === owner) setTasks(current => [...current, saved])
    }

    async function changeTaskStatus(id, status) {
        const owner = account.id
        const saved = await api.updateTaskStatus(id, status)
        if (accountId.current === owner) setTasks(current => current.map(task => task.id === id ? saved : task))
    }

    const isAdmin = account?.role === 'admin'
    // Role-based rendering improves UX; Express authorization is the actual security boundary.
    function renderPage() {
        if (currentPage === 'users' && isAdmin) return <Users users={users} onCreateUser={createUser} />
        if (currentPage === 'profile') return <Profile account={account} />
        if (currentPage === 'tasks') return <Tasks isAdmin={isAdmin} tasks={tasks} users={users}
            onCreateTask={createTask} onChangeTaskStatus={changeTaskStatus} />
        return <Dashboard isAdmin={isAdmin} users={users} tasks={tasks} />
    }

    const pages = isAdmin
        ? [['dashboard', 'Dashboard'], ['users', 'Users'], ['tasks', 'Tasks']]
        : [['dashboard', 'Dashboard'], ['tasks', 'My Tasks'], ['profile', 'Profile']]

    return (
        <div className="app">
            <header className="app-header">
                <div><h1>My Web App V2</h1><span>Work Tracker{account ? ` · ${account.name} (${account.role})` : ''}</span></div>
                {account && <nav aria-label="Main navigation">
                    {pages.map(([page, label]) => <button key={page}
                        aria-current={currentPage === page ? 'page' : undefined}
                        className={currentPage === page ? 'nav-active' : ''}
                        onClick={() => setCurrentPage(page)}>{label}</button>)}
                    <button onClick={signOut} disabled={loggingOut}>{loggingOut ? 'Signing out…' : 'Logout'}</button>
                </nav>}
            </header>
            <main className="container">
                {logoutError && <p role="alert" className="message message-error">{logoutError}</p>}
                <DataState isLoading={checkingSession} error={sessionError}
                    onRetry={() => setSessionAttempt(value => value + 1)}>
                    {!account ? <Login onLogin={signIn} /> :
                        <DataState isLoading={isLoading} error={loadError}
                            onRetry={() => setLoadAttempt(value => value + 1)}>{renderPage()}</DataState>}
                </DataState>
            </main>
            <footer className="app-footer"><p>&copy; 2026 My Web App V2</p></footer>
        </div>
    )
}

export default App
