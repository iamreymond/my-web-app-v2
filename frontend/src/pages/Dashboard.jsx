import DataState from '../components/DataState.jsx'
function Dashboard({ users, tasks, isAdmin = true, isLoading = false, error = '' }) {
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
            </div>
        </DataState>
    )
}

export default Dashboard