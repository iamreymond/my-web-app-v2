import { useState } from 'react'

function Login({ onLogin }) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    async function handleSubmit(event) {
        event.preventDefault()
        if (isSubmitting) return
        setIsSubmitting(true)
        setError('')
        try {
            // Passwords exist only in this form while signing in, never localStorage or URLs.
            await onLogin({ email: email.trim(), password })
            setPassword('')
        } catch (error) {
            setError(error.message)
        } finally { setIsSubmitting(false) }
    }

    return (
        <form className="form login-form" onSubmit={handleSubmit}>
            <h2>Sign In</h2>
            <p>Use the account provided by your Admin.</p>
            {error && <p className="message message-error" role="alert">{error}</p>}
            <fieldset disabled={isSubmitting}>
                <div className="form-group">
                    <label htmlFor="login-email">Email</label>
                    <input id="login-email" type="email" autoComplete="username" required
                        value={email} onChange={event => setEmail(event.target.value)} />
                </div>
                <div className="form-group">
                    <label htmlFor="login-password">Password</label>
                    <input id="login-password" type="password" autoComplete="current-password" required
                        value={password} onChange={event => setPassword(event.target.value)} />
                </div>
                <button type="submit">{isSubmitting ? 'Signing in…' : 'Sign In'}</button>
            </fieldset>
        </form>
    )
}

export default Login
