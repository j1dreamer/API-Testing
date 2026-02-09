import { useState, useEffect } from 'react'
import './ApiInventory.css'

const API_BASE = 'http://localhost:8000'

function ApiInventory() {
    const [apis, setApis] = useState([])
    const [domains, setDomains] = useState([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(false)
    const [selectedApi, setSelectedApi] = useState(null)
    const [autoUpdate, setAutoUpdate] = useState(true)

    // Filters
    const [domainFilter, setDomainFilter] = useState('')
    const [incompleteOnly, setIncompleteOnly] = useState(false)
    const [searchFilter, setSearchFilter] = useState('')

    // Edit state
    const [editing, setEditing] = useState(false)
    const [editForm, setEditForm] = useState({
        api_name: '',
        description_vi: '',
        notes_vi: ''
    })

    const fetchDomains = async () => {
        try {
            const res = await fetch(`${API_BASE}/api-definitions/domains`)
            const data = await res.json()
            setDomains(data.domains || [])
        } catch (error) {
            console.error('Failed to fetch domains:', error)
        }
    }

    const fetchApis = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (domainFilter) params.append('domain', domainFilter)
            if (incompleteOnly) params.append('incomplete', 'true')
            if (searchFilter) params.append('search', searchFilter)

            const res = await fetch(`${API_BASE}/api-definitions/?${params}`)
            const data = await res.json()
            setApis(data.apis || [])
            setTotal(data.total || 0)
        } catch (error) {
            console.error('Failed to fetch APIs:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchDomains()
        fetchApis()
    }, [domainFilter, incompleteOnly, searchFilter])

    useEffect(() => {
        if (!autoUpdate) return
        const interval = setInterval(fetchApis, 5000)
        return () => clearInterval(interval)
    }, [autoUpdate, domainFilter, incompleteOnly, searchFilter])

    const handleRefresh = async () => {
        setLoading(true)
        try {
            await fetch(`${API_BASE}/api-definitions/refresh`, { method: 'POST' })
            await fetchApis()
            await fetchDomains()
        } catch (error) {
            console.error('Failed to refresh:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSelectApi = (api) => {
        setSelectedApi(api)
        setEditing(false)
        setEditForm({
            api_name: api.api_name || '',
            description_vi: api.description_vi || '',
            notes_vi: api.notes_vi || ''
        })
    }

    const handleSaveDoc = async () => {
        if (!selectedApi) return
        try {
            await fetch(`${API_BASE}/api-definitions/${selectedApi._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm)
            })
            setEditing(false)
            await fetchApis()
            // Update selected API with new data
            setSelectedApi(prev => ({ ...prev, ...editForm }))
        } catch (error) {
            console.error('Failed to save documentation:', error)
        }
    }

    const getMethodBadge = (coverage, method) => {
        const status = coverage?.[method] || 'Missing'
        return (
            <span className={`method-badge ${status.toLowerCase()}`}>
                {method}
            </span>
        )
    }

    // Group APIs by domain then path
    const groupedApis = apis.reduce((acc, api) => {
        const domain = api.domain || 'unknown'
        if (!acc[domain]) acc[domain] = {}
        const path = api.path || '/'
        if (!acc[domain][path]) acc[domain][path] = []
        acc[domain][path].push(api)
        return acc
    }, {})

    return (
        <div className="inventory-container">
            <div className="inventory-header">
                <h2>📚 API Inventory</h2>
                <span className="count">{total} endpoints</span>
            </div>

            <div className="inventory-controls">
                <div className="filter-group">
                    <label>Domain</label>
                    <select value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)}>
                        <option value="">All Domains</option>
                        {domains.map(d => (
                            <option key={d} value={d}>{d}</option>
                        ))}
                    </select>
                </div>

                <div className="filter-group">
                    <label>
                        <input
                            type="checkbox"
                            checked={incompleteOnly}
                            onChange={(e) => setIncompleteOnly(e.target.checked)}
                        />
                        Incomplete Only
                    </label>
                </div>

                <div className="filter-group search">
                    <input
                        type="text"
                        placeholder="Search path..."
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                    />
                </div>

                <div className="control-buttons">
                    <label className="toggle-label">
                        <input
                            type="checkbox"
                            checked={autoUpdate}
                            onChange={(e) => setAutoUpdate(e.target.checked)}
                        />
                        Auto-update
                    </label>
                    <button onClick={handleRefresh} disabled={loading}>
                        🔄 Rebuild
                    </button>
                </div>
            </div>

            <div className="inventory-content">
                <div className="api-tree">
                    {loading && apis.length === 0 ? (
                        <div className="loading">Loading...</div>
                    ) : Object.keys(groupedApis).length === 0 ? (
                        <div className="empty">
                            <p>No APIs captured yet.</p>
                            <p className="hint">Browse websites with the extension to capture APIs.</p>
                        </div>
                    ) : (
                        Object.entries(groupedApis).map(([domain, paths]) => (
                            <div key={domain} className="domain-group">
                                <div className="domain-header">📁 {domain}</div>
                                {Object.entries(paths).map(([path, methods]) => (
                                    <div key={path} className="path-group">
                                        <div className="path-header">{path}</div>
                                        <div className="methods-list">
                                            {methods.map(api => (
                                                <div
                                                    key={api._id}
                                                    className={`method-item ${selectedApi?._id === api._id ? 'selected' : ''}`}
                                                    onClick={() => handleSelectApi(api)}
                                                >
                                                    <span className={`method-tag ${api.method.toLowerCase()}`}>
                                                        {api.method}
                                                    </span>
                                                    {api.api_name && <span className="api-name">{api.api_name}</span>}
                                                    <span className="request-count">{api.request_count}x</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))
                    )}
                </div>

                <div className="api-detail">
                    {selectedApi ? (
                        <div className="detail-content">
                            <div className="detail-header">
                                <span className={`method-tag large ${selectedApi.method.toLowerCase()}`}>
                                    {selectedApi.method}
                                </span>
                                <span className="path">{selectedApi.path}</span>
                            </div>

                            <div className="coverage-section">
                                <h4>Method Coverage</h4>
                                <div className="coverage-badges">
                                    {getMethodBadge(selectedApi.method_coverage, 'GET')}
                                    {getMethodBadge(selectedApi.method_coverage, 'POST')}
                                    {getMethodBadge(selectedApi.method_coverage, 'PUT')}
                                    {getMethodBadge(selectedApi.method_coverage, 'DELETE')}
                                    {getMethodBadge(selectedApi.method_coverage, 'PATCH')}
                                </div>
                            </div>

                            <div className="doc-section">
                                <div className="doc-header">
                                    <h4>📝 Tài liệu tiếng Việt</h4>
                                    {!editing && (
                                        <button onClick={() => setEditing(true)}>Chỉnh sửa</button>
                                    )}
                                </div>

                                {editing ? (
                                    <div className="edit-form">
                                        <div className="form-group">
                                            <label>Tên API</label>
                                            <input
                                                type="text"
                                                value={editForm.api_name}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, api_name: e.target.value }))}
                                                placeholder="VD: Lấy thông tin người dùng"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Mô tả</label>
                                            <textarea
                                                value={editForm.description_vi}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, description_vi: e.target.value }))}
                                                placeholder="Mô tả chức năng của API..."
                                                rows={3}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Ghi chú</label>
                                            <textarea
                                                value={editForm.notes_vi}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, notes_vi: e.target.value }))}
                                                placeholder="Ghi chú thêm..."
                                                rows={2}
                                            />
                                        </div>
                                        <div className="form-actions">
                                            <button onClick={handleSaveDoc}>💾 Lưu</button>
                                            <button onClick={() => setEditing(false)} className="cancel">Hủy</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="doc-display">
                                        <p><strong>Tên:</strong> {selectedApi.api_name || <em className="empty-text">Chưa đặt tên</em>}</p>
                                        <p><strong>Mô tả:</strong> {selectedApi.description_vi || <em className="empty-text">Chưa có mô tả</em>}</p>
                                        <p><strong>Ghi chú:</strong> {selectedApi.notes_vi || <em className="empty-text">Không có ghi chú</em>}</p>
                                    </div>
                                )}
                            </div>

                            <div className="example-section">
                                <h4>Response Example</h4>
                                <pre>{JSON.stringify(selectedApi.response_example, null, 2) || 'No example captured'}</pre>
                            </div>

                            <div className="meta-section">
                                <p><strong>Status Codes:</strong> {selectedApi.status_codes?.join(', ') || 'N/A'}</p>
                                <p><strong>Request Count:</strong> {selectedApi.request_count}</p>
                                <p><strong>Last Seen:</strong> {new Date(selectedApi.last_seen_at).toLocaleString()}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="no-selection">
                            <p>Chọn một API để xem chi tiết</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default ApiInventory
