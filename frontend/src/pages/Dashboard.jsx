import DataState from '../components/DataState.jsx'
import { personalSummary } from '../services/personal.js'
function Dashboard({ users, tasks, isAdmin = true, isLoading = false, error = '' }) {
    const personal = !isAdmin ? personalSummary(tasks) : null
    // Counts derive from shared state, so creating tasks and changing status update the overview.
    const openTasks = tasks.filter(
        task => task.status === 'Open'
    ).length

    const inProgressTasks = tasks.filter(
        task => task.status === 'In Progress'
    ).length

    const completedTasks = tasks.filter(
        task => task.status === 'Completed'
    ).length

    return (
        <DataState isLoading={isLoading} error={error}>
            <div>
                <div className="page-header">
                    <div>
                        <h2>{isAdmin ? 'Admin Dashboard' : 'My Dashboard'}</h2>
                        <p>
                            {isAdmin ? 'Application overview and current workload.' : 'Your assigned workload.'}
                        </p>
                    </div>
                </div>

                <div className="stats-grid">
                    {isAdmin && <div className="card">
                        <h3>Total Users</h3>
                        <strong>{users.length}</strong>
                    </div>}

                    <div className="card">
                        <h3>{isAdmin ? 'Open' : 'My Open Tasks'}</h3>
                        <strong>{openTasks}</strong>
                    </div>

                    <div className="card">
                        <h3>{isAdmin ? 'In Progress' : 'My In-Progress Tasks'}</h3>
                        <strong>{inProgressTasks}</strong>
                    </div>

                    <div className="card">
                        <h3>{isAdmin ? 'Completed' : 'My Completed Tasks'}</h3>
                        <strong>{completedTasks}</strong>
                    </div>
                </div>
                {isAdmin && <>
                    <div className="stats-grid workload">
                        <div className="card"><h3>Active Users</h3><strong>{users.filter(user => user.active).length}</strong></div>
                        <div className="card"><h3>Inactive Users</h3><strong>{users.filter(user => !user.active).length}</strong></div>
                        <div className="card"><h3>Unassigned Tasks</h3><strong>{tasks.filter(task => task.userId === null).length}</strong></div>
                    </div>
                    <section className="card workload"><h3>Workload by Priority</h3>
                        <p>All tasks, including completed work.</p>
                        <div className="stats-grid">{['High', 'Medium', 'Low'].map(priority => <div key={priority}>
                            <span>{priority}</span><p><strong>{tasks.filter(task => task.priority === priority).length}</strong></p>
                        </div>)}</div>
                    </section>
                </>}
                {!isAdmin && <>
                    <div className="stats-grid workload">
                        <div className="card"><h3>Total Assigned Tasks</h3><strong>{personal.total}</strong></div>
                        {Object.entries(personal.priorities).map(([priority, count]) => <div className="card" key={priority}>
                            <h3>My {priority}-Priority Tasks</h3><strong>{count}</strong>
                        </div>)}
                    </div>
                    <section className="card"><h3>Needs My Attention</h3>
                        <p>Up to three unfinished tasks, highest priority first. Priority totals above include completed work.</p>
                        {personal.attention.length ? <ul>{personal.attention.map(task => <li key={task.id}>
                            <strong>{task.title}</strong> — {task.priority} priority · {task.status}
                        </li>)}</ul> : <p className="empty-state">No unfinished tasks are assigned to you.</p>}
                    </section>
                </>}
            </div>
        </DataState>
    )
}

export default Dashboard
