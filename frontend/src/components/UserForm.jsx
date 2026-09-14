import { useState } from 'react'

function UserForm({ onCreateUser }) {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')

    function handleSubmit(event) {
        event.preventDefault()

        onCreateUser({
            name: name.trim(),
            email: email.trim(),
        })

        setName('')
        setEmail('')
    }

    return (
        <form className="form" onSubmit={handleSubmit}>
            <h3>Add User</h3>

            <div className="form-group">
                <label htmlFor="user-name">Name</label>
                <input
                    id="user-name"
                    type="text"
                    value={name}
                    onChange={event => setName(event.target.value)}
                    required
                />
            </div>

            <div className="form-group">
                <label htmlFor="user-email">Email</label>
                <input
                    id="user-email"
                    type="email"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    required
                />
            </div>

            <button type="submit">
                Add User
            </button>
        </form>
    )
}

export default UserForm