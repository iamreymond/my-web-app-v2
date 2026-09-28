function PriorityBadge({ priority }) {
    return <span className={`priority priority-${priority.toLowerCase()}`}>Priority: {priority}</span>
}

export default PriorityBadge
