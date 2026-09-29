import { useState } from 'react'
import { formatDate } from '../services/management.js'
import { passwordError } from '../services/personal.js'

function Profile({ account, onSave, onPasswordChange }) {
    const [name, setName] = useState(account.name)
    const [email, setEmail] = useState(account.email)
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [busy, setBusy] = useState('')
    const [error, setError] = useState('')
    const [passwordMessage, setPasswordMessage] = useState('')
    const [success, setSuccess] = useState('')

    async function save(event) {
        event.preventDefault()
        if (busy) return
        setError(''); setSuccess('')
        if (!name.trim()) { setError('Enter a name containing more than spaces.'); return }
        setBusy('profile')
        try {
            const fields = { name: name.trim(), email: email.trim().toLowerCase() }
            await onSave(fields)
            setName(fields.name); setEmail(fields.email)
            setSuccess('Profile updated.')
        } catch (error) { setError(error.message) }
        finally { setBusy('') }
    }
    async function changePassword(event) {
        event.preventDefault()
        if (busy) return
        const fields = { currentPassword, newPassword, confirmPassword }
        const invalid = passwordError(fields)
        setPasswordMessage(invalid)
        if (invalid) return
        setBusy('password')
        try { await onPasswordChange(fields) }
        catch (error) { setPasswordMessage(error.message) }
        finally {
            // Passwords live only in form state; clear them after every submitted request.
            setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setBusy('')
        }
    }
    return <div className="personal">
        <div className="page-header"><h2>Profile</h2><p>Manage your own account information and password.</p></div>
        <section className="card profile-details"><h3>Account Details</h3>
            <dl>
                <dt>Name</dt><dd>{account.name}</dd>
                <dt>Email</dt><dd>{account.email}</dd>
                <dt>Role</dt><dd>{account.role}</dd>
                <dt>Account status</dt><dd>{account.active ? 'Active' : 'Inactive'}</dd>
                <dt>Created</dt><dd>{formatDate(account.createdAt)}</dd>
                <dt>Updated</dt><dd>{formatDate(account.updatedAt)}</dd>
            </dl>
        </section>
        <div className="profile-forms">
            <form className="form" onSubmit={save}>
                <h3>Edit My Profile</h3><p className="form-hint">Your role and account status are managed by an Admin.</p>
                {error && <p className="message message-error" role="alert">{error}</p>}
                {success && <p className="message message-success" role="status">{success}</p>}
                <fieldset disabled={!!busy}>
                    <div className="form-group"><label htmlFor="profile-name">Name</label>
                        <input id="profile-name" autoComplete="name" required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></div>
                    <div className="form-group"><label htmlFor="profile-email">Email</label>
                        <input id="profile-email" type="email" autoComplete="email" required maxLength={255} value={email} onChange={e => setEmail(e.target.value)} /></div>
                    <button type="submit">{busy === 'profile' ? 'Saving…' : 'Save Profile'}</button>
                </fieldset>
            </form>
            <form className="form" onSubmit={changePassword}>
                <h3>Change Password</h3><p className="form-hint">Use 12 or more characters, up to 72 UTF-8 bytes. A successful change signs you out on every device.</p>
                {passwordMessage && <p className="message message-error" role="alert">{passwordMessage}</p>}
                <fieldset disabled={!!busy}>
                    <div className="form-group"><label htmlFor="current-password">Current Password</label>
                        <input id="current-password" type="password" autoComplete="current-password" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} /></div>
                    <div className="form-group"><label htmlFor="new-password">New Password</label>
                        <input id="new-password" type="password" autoComplete="new-password" required minLength={12} value={newPassword} onChange={e => setNewPassword(e.target.value)} /></div>
                    <div className="form-group"><label htmlFor="confirm-password">Confirm New Password</label>
                        <input id="confirm-password" type="password" autoComplete="new-password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></div>
                    <button type="submit">{busy === 'password' ? 'Changing password…' : 'Change Password'}</button>
                </fieldset>
            </form>
        </div>
    </div>
}
export default Profile
