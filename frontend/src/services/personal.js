export function filterMyTasks(tasks, { search = '', status = '', priority = '', sort = 'newest' }) {
    const text = search.trim().toLowerCase()
    const priorities = { High: 0, Medium: 1, Low: 2 }
    const statuses = { Open: 0, 'In Progress': 1, Completed: 2 }
    // Sort a filtered copy so list controls never reorder shared dashboard state.
    return tasks.filter(task => `${task.title} ${task.description || ''}`.toLowerCase().includes(text) &&
        (!status || task.status === status) && (!priority || task.priority === priority))
        .sort((a, b) => {
            const age = new Date(a.createdAt || 0) - new Date(b.createdAt || 0) || a.id - b.id
            if (sort === 'oldest') return age
            if (sort === 'priority') return priorities[a.priority] - priorities[b.priority] || -age
            if (sort === 'status') return statuses[a.status] - statuses[b.status] || -age
            return -age
        })
}

export function personalSummary(tasks) {
    return {
        total: tasks.length,
        priorities: Object.fromEntries(['High', 'Medium', 'Low'].map(priority => [priority, tasks.filter(task => task.priority === priority).length])),
        attention: filterMyTasks(tasks.filter(task => task.status !== 'Completed'), { sort: 'priority' }).slice(0, 3),
    }
}

export function passwordError({ currentPassword, newPassword, confirmPassword }) {
    if (!currentPassword) return 'Enter your current password.'
    if (newPassword.length < 12 || new TextEncoder().encode(newPassword).length > 72) return 'New password must be at least 12 characters and at most 72 UTF-8 bytes.'
    if (newPassword !== confirmPassword) return 'New password confirmation does not match.'
    if (currentPassword === newPassword) return 'Choose a new password different from your current password.'
    return ''
}
