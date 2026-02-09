import { useState } from 'react'
import './LogDetail.css'

function LogDetail({ log, apiBase }) {
    const [activeTab, setActiveTab] = useState('request')
    const [copyStatus, setCopyStatus] = useState('')

    const formatJson = (data) => {
        if (!data) return 'null'
        if (typeof data === 'string') {
            try {
                return JSON.stringify(JSON.parse(data), null, 2)
            } catch {
                return data
            }
        }
        return JSON.stringify(data, null, 2)
    }

    const formatHeaders = (headers) => {
        if (!headers || Object.keys(headers).length === 0) {
            return 'No headers'
        }
        return Object.entries(headers)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n')
    }

    const handleCopyPostman = async () => {
        try {
            const response = await fetch(`${apiBase}/logs/${log._id}/export/postman`)
            const data = await response.json()
            await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
            setCopyStatus('Postman JSON copied!')
            setTimeout(() => setCopyStatus(''), 2000)
        } catch (error) {
            setCopyStatus('Failed to copy')
            setTimeout(() => setCopyStatus(''), 2000)
        }
    }

    const handleCopyCurl = async () => {
        try {
            const response = await fetch(`${apiBase}/logs/${log._id}/export/curl`)
            const data = await response.json()
            await navigator.clipboard.writeText(data.curl)
            setCopyStatus('cURL copied!')
            setTimeout(() => setCopyStatus(''), 2000)
        } catch (error) {
            setCopyStatus('Failed to copy')
            setTimeout(() => setCopyStatus(''), 2000)
        }
    }

    return (
        <div className="detail-container">
            <div className="detail-header">
                <div className="detail-method" data-method={log.method}>
                    {log.method}
                </div>
                <div className="detail-url">{log.url}</div>
            </div>

            <div className="detail-meta">
                <span className="meta-item">
                    Status: <strong className={`status-${Math.floor(log.status_code / 100)}xx`}>
                        {log.status_code}
                    </strong>
                </span>
                <span className="meta-item">
                    Duration: <strong>{log.duration_ms}ms</strong>
                </span>
                <span className="meta-item">
                    Type: <strong>{log.initiator_type}</strong>
                </span>
            </div>

            <div className="export-buttons">
                <button onClick={handleCopyPostman}>📋 Copy as Postman</button>
                <button onClick={handleCopyCurl}>💻 Copy as cURL</button>
                {copyStatus && <span className="copy-status">{copyStatus}</span>}
            </div>

            <div className="tabs">
                <button
                    className={activeTab === 'request' ? 'active' : ''}
                    onClick={() => setActiveTab('request')}
                >
                    Request
                </button>
                <button
                    className={activeTab === 'response' ? 'active' : ''}
                    onClick={() => setActiveTab('response')}
                >
                    Response
                </button>
            </div>

            <div className="tab-content">
                {activeTab === 'request' && (
                    <>
                        <section>
                            <h4>Headers</h4>
                            <pre>{formatHeaders(log.request_headers)}</pre>
                        </section>
                        <section>
                            <h4>Body</h4>
                            <pre>{formatJson(log.request_body) || 'No body'}</pre>
                        </section>
                    </>
                )}

                {activeTab === 'response' && (
                    <>
                        <section>
                            <h4>Headers</h4>
                            <pre>{formatHeaders(log.response_headers)}</pre>
                        </section>
                        <section>
                            <h4>Body</h4>
                            <pre>{formatJson(log.response_body) || 'No body'}</pre>
                        </section>
                    </>
                )}
            </div>
        </div>
    )
}

export default LogDetail
