function Profile({ account }) {
    return (
        <section className="card">
            <h2>Profile</h2>
            <dl>
                <dt>Name</dt><dd>{account.name}</dd>
                <dt>Email</dt><dd>{account.email}</dd>
                <dt>Role</dt><dd>{account.role}</dd>
            </dl>
        </section>
    )
}

export default Profile
