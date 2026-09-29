export function filterUsers(users, { search = '', role = '', active = '', sort = 'name' }) {
    const text = search.trim().toLowerCase()
    return users.filter(user => `${user.name} ${user.email}`.toLowerCase().includes(text) &&
        (!role || user.role === role) && (!active || String(user.active) === active))
        .sort((a, b) => sort === 'newest' ? b.id - a.id : a.name.localeCompare(b.name) || a.id - b.id)
}

export function filterTasks(tasks, { search = '', status = '', priority = '', userId = '', sort = 'newest' }) {
    const rank = { High: 0, Medium: 1, Low: 2 }
    return tasks.filter(task => task.title.toLowerCase().includes(search.trim().toLowerCase()) &&
        (!status || task.status === status) && (!priority || task.priority === priority) &&
        (!userId || (userId === 'unassigned' ? task.userId === null : String(task.userId) === userId)))
        .sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) || a.id - b.id :
            sort === 'priority' ? rank[a.priority] - rank[b.priority] || b.id - a.id : b.id - a.id)
}

export function formatDate(value) { return value ? new Date(value).toLocaleString() : 'Unavailable' }
