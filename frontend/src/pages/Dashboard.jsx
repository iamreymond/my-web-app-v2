import DataState from '../components/DataState.jsx'
function Dashboard({ users, tasks, isLoading = false, error = '' }) {
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
                        <h2>Dashboard</h2>
                        <p>
                            Application overview and current workload.
                        </p>
                    </div>
                </div>

                <div className="stats-grid">
                    <div className="card">
                        <h3>Total Users</h3>
                        <strong>{users.length}</strong>
                    </div>

                    <div className="card">
                        <h3>Open</h3>
                        <strong>{openTasks}</strong>
                    </div>

                    <div className="card">
                        <h3>In Progress</h3>
                        <strong>{inProgressTasks}</strong>
                    </div>

                    <div className="card">
                        <h3>Completed</h3>
                        <strong>{completedTasks}</strong>
                    </div>
                </div>
            </div>
        </DataState>
    )
}

export default Dashboard