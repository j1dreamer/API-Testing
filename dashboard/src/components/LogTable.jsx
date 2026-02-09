import './LogTable.css'

function LogTable({ logs, selectedId, onSelect }) {
    const getMethodClass = (method) => {
        const classes = {
            GET: 'method-get',
            POST: 'method-post',
            PUT: 'method-put',
            PATCH: 'method-patch',
            DELETE: 'method-delete'
        }
        return classes[method] || 'method-other'
    }

    const getStatusClass = (status) => {
        if (status >= 200 && status < 300) return 'status-success'
        if (status >= 400 && status < 500) return 'status-client-error'
        if (status >= 500) return 'status-server-error'
        return 'status-other'
    }

    const formatUrl = (url) => {
        try {
            const parsed = new URL(url)
            return parsed.pathname + (parsed.search || '')
        } catch {
            return url
        }
    }

    const formatTimestamp = (timestamp) => {
        const date = new Date(timestamp)
        return date.toLocaleTimeString()
    }

    if (logs.length === 0) {
        return (
            <div className="empty-state">
                <p>No captured requests yet.</p>
                <p className="hint">Load the extension and browse to capture API calls.</p>
            </div>
        )
    }

    return (
        <table className="log-table">
            <thead>
                <tr>
                    <th>Time</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>URL</th>
                    <th>Duration</th>
                    <th>Type</th>
                </tr>
            </thead>
            <tbody>
                {logs.map((log) => (
                    <tr
                        key={log._id}
                        className={selectedId === log._id ? 'selected' : ''}
                        onClick={() => onSelect(log)}
                    >
                        <td className="time">{formatTimestamp(log.timestamp)}</td>
                        <td>
                            <span className={`method ${getMethodClass(log.method)}`}>
                                {log.method}
                            </span>
                        </td>
                        <td>
                            <span className={`status ${getStatusClass(log.status_code)}`}>
                                {log.status_code}
                            </span>
                        </td>
                        <td className="url" title={log.url}>
                            {formatUrl(log.url)}
                        </td>
                        <td className="duration">{log.duration_ms}ms</td>
                        <td className="type">{log.initiator_type}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    )
}

export default LogTable
