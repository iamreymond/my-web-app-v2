import { useEffect, useRef, useState } from 'react'
import * as api from './services/api.js'
import DataState from './components/DataState.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Users from './pages/Users.jsx'
import Tasks from './pages/Tasks.jsx'
import AdminTasks from './pages/AdminTasks.jsx'
import Login from './pages/Login.jsx'
import Profile from './pages/Profile.jsx'

function App() {
    const [account, setAccount] = useState(null)
    const [checkingSession, setCheckingSession] = useState(true)
    const [sessionError, setSessionError] = useState('')
    const [signInMessage, setSignInMessage] = useState('')
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
            accountId.current = null
            setAccount(null)
            setUsers([])
            setTasks([])
            setCurrentPage('dashboard')
        }
        window.addEventListener('session-expired', sessionExpired)
        function passwordChanged() {
            sessionExpired()
            setSignInMessage('Your password has been changed. Please sign in again.')
        }
        window.addEventListener('password-changed', passwordChanged)
        return () => {
            window.removeEventListener('session-expired', sessionExpired)
            window.removeEventListener('password-changed', passwordChanged)
        }
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
    // A profile edit updates the header without unmounting the form and losing its success feedback.
    }, [account?.id, account?.role, loadAttempt])

    async function signIn(credentials) {
        const user = await api.login(credentials)
        setUsers([])
        setTasks([])
        setIsLoading(true)
        setCurrentPage('dashboard')
        setAccount(user)
        setLogoutError('')
        setSignInMessage('')
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
        return saved
    }

    async function saveProfile(fields) {
        const owner = account.id
        const saved = await api.updateProfile(fields)
        if (accountId.current !== owner) return
        setAccount(saved)
        setUsers(current => current.map(user => user.id === owner ? saved : user))
    }

    const isAdmin = account?.role === 'admin'
    async function updateUser(id, fields) {
        const owner = account.id
        const saved = await api.updateUser(id, fields)
        if (accountId.current !== owner) return
        setUsers(current => current.map(user => user.id === id ? saved : user))
        if (id === owner) setAccount(saved)
    }
    async function statusUser(id, active) {
        const owner = account.id
        const saved = await api.updateUserStatus(id, active)
        if (accountId.current === owner) setUsers(current => current.map(user => user.id === id ? saved : user))
    }
    async function deleteUser(id) {
        const owner = account.id
        await api.deleteUser(id)
        if (accountId.current === owner) setUsers(current => current.filter(user => user.id !== id))
    }
    async function updateTask(id, fields) {
        const owner = account.id
        const saved = await api.updateTask(id, fields)
        if (accountId.current === owner) setTasks(current => current.map(task => task.id === id ? saved : task))
    }
    async function deleteTask(id) {
        const owner = account.id
        await api.deleteTask(id)
        if (accountId.current === owner) setTasks(current => current.filter(task => task.id !== id))
    }
    // Role-based rendering improves UX; Express authorization is the actual security boundary.
    function renderPage() {
        if (currentPage === 'users' && isAdmin) return <Users users={users} account={account} onCreateUser={createUser}
            onUpdateUser={updateUser} onStatusUser={statusUser} onDeleteUser={deleteUser} />
        if (currentPage === 'profile') return <Profile account={account} onSave={saveProfile} onPasswordChange={api.changePassword} />
        if (currentPage === 'tasks' && isAdmin) return <AdminTasks tasks={tasks} users={users}
            onCreateTask={createTask} onUpdateTask={updateTask} onDeleteTask={deleteTask} />
        if (currentPage === 'tasks') return <Tasks tasks={tasks} onChangeTaskStatus={changeTaskStatus} />
        return <Dashboard isAdmin={isAdmin} users={users} tasks={tasks} />
    }

    const pages = isAdmin
        ? [['dashboard', 'Dashboard'], ['users', 'User Management'], ['tasks', 'Task Management']]
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
                    {!account ? <><p className="message-success" role="status">{signInMessage}</p><Login onLogin={signIn} /></> :
                        <DataState isLoading={isLoading} error={loadError}
                            onRetry={() => setLoadAttempt(value => value + 1)}>{renderPage()}</DataState>}
                </DataState>
            </main>
            <footer className="app-footer"><p>&copy; 2026 My Web App V2</p></footer>
        </div>
    )
}

export default App
