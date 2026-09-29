import DataState from '../components/DataState.jsx'
import UserForm from '../components/UserForm.jsx'

function Users({ users, onCreateUser, isLoading = false, error = '' }) {
    return (
        <DataState isLoading={isLoading} error={error}>
            <div>
                <div className="page-header">
                    <div>
                        <h2>Users</h2>
                        <p>
                            Manage users available for task assignment.
                        </p>
                    </div>
                </div>

                <div className="content-grid">
                    <UserForm
                        onCreateUser={onCreateUser}
                    />

                    <div className="card">
                        <h3>User List</h3>

                        {users.length === 0 ? (
                            <p className="empty-state">
                                No users yet. Add a user to make them available for task assignment.
                            </p>
                        ) : (
                            <div className="list">
                                {users.map(user => (
                                    <div
                                        className="list-item"
                                        key={user.id}
                                    >
                                        <strong>
                                            {user.name}
                                        </strong>

                                        <span>
                                            {user.email} — {user.role}
                                            {user.canLogin === false && ' (login not enabled)'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DataState>
    )
}

export default Users