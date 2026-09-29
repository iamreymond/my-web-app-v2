import { useState } from 'react'

function UserForm({ onCreateUser, user, onCancel }) {
    const [name, setName] = useState(user?.name || '')
    const [email, setEmail] = useState(user?.email || '')
    const [password, setPassword] = useState('')
    const [role, setRole] = useState(user?.role || 'user')

    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Preserve entered values on failure and clear the form only after a successful save.
    async function handleSubmit(event) {
        event.preventDefault()

        if (isSubmitting) return
        setError('')
        setSuccess('')
        // HTML required fields still allow spaces; reject them before saving.
        if (!name.trim()) {
            setError('Enter a name containing more than spaces.')
            return
        }
        if (!user && (password.length < 12 || new TextEncoder().encode(password).length > 72)) {
            setError('Password must be at least 12 characters and at most 72 UTF-8 bytes.')
            return
        }
        setIsSubmitting(true)
        try {
            await onCreateUser({ name: name.trim(), email: email.trim().toLowerCase(), ...(user ? {} : { password }), role })
            if (user) return
            setName('')
            setEmail('')
            setPassword('')
            setRole('user')
            setSuccess('User added. They are now available for task assignment.')
        } catch (error) {
            setError(error.message || 'Unable to add user. Please try again.')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <form className="form" onSubmit={handleSubmit}>
            <h3>{user ? 'Edit User' : 'Add User'}</h3>
            <p className="form-hint">{user ? 'Update account information. Passwords are managed separately.' : 'All fields are required. Share the initial password privately with the account owner.'}</p>
            {error && <p className="message message-error" role="alert">{error}</p>}
            {success && <p className="message message-success" role="status">{success}</p>}
            <fieldset disabled={isSubmitting}>

                <div className="form-group">
                    <label htmlFor="user-name">Name</label>
                    <input
                        id="user-name"
                        type="text"
                        maxLength={100}
                        autoComplete="name"
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
                        maxLength={255}
                        autoComplete="email"
                        value={email}
                        onChange={event => setEmail(event.target.value)}
                        required
                    />
                </div>

                {!user && <div className="form-group">
                    <label htmlFor="user-password">Initial password</label>
                    <input id="user-password" type="password" autoComplete="new-password"
                        value={password} onChange={event => setPassword(event.target.value)} minLength={12} required />
                    <span className="form-hint">At least 12 characters; maximum 72 UTF-8 bytes.</span>
                </div>}
                <div className="form-group">
                    <label htmlFor="user-role">Role</label>
                    <select id="user-role" value={role} onChange={event => setRole(event.target.value)}>
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>
                <button type="submit">
                    {isSubmitting ? 'Saving…' : user ? 'Save User' : 'Add User'}
                </button>
            {onCancel && <button type="button" className="secondary" onClick={onCancel}>Cancel</button>}
            </fieldset>
        </form>
    )
}

export default UserForm
