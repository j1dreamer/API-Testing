import { useState, useEffect } from 'react'
import LogTable from './components/LogTable'
import LogDetail from './components/LogDetail'
import ApiInventory from './components/ApiInventory'
import './App.css'

const API_BASE = 'http://localhost:8000'

function App() {
  const [activeTab, setActiveTab] = useState('logs')
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [selectedLog, setSelectedLog] = useState(null)
  const [loading, setLoading] = useState(false)

  // Filters
  const [methodFilter, setMethodFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [searchFilter, setSearchFilter] = useState('')

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (methodFilter) params.append('method', methodFilter)
      if (statusFilter) params.append('status_group', statusFilter)
      if (searchFilter) params.append('search', searchFilter)

      const response = await fetch(`${API_BASE}/logs/?${params}`)
      const data = await response.json()
      setLogs(data.logs)
      setTotal(data.total)
    } catch (error) {
      console.error('Failed to fetch logs:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs()
      const interval = setInterval(fetchLogs, 3000)
      return () => clearInterval(interval)
    }
  }, [methodFilter, statusFilter, searchFilter, activeTab])

  const handleClearLogs = async () => {
    if (!window.confirm('Are you sure you want to clear all logs?')) return
    try {
      await fetch(`${API_BASE}/logs/`, { method: 'DELETE' })
      fetchLogs()
      setSelectedLog(null)
    } catch (error) {
      console.error('Failed to clear logs:', error)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🔍 API Capture Tool</h1>
        <nav className="main-nav">
          <button
            className={activeTab === 'logs' ? 'active' : ''}
            onClick={() => setActiveTab('logs')}
          >
            📋 Request Logs
          </button>
          <button
            className={activeTab === 'inventory' ? 'active' : ''}
            onClick={() => setActiveTab('inventory')}
          >
            📚 API Inventory
          </button>
        </nav>
      </header>

      {activeTab === 'logs' && (
        <>
          <div className="filters">
            <div className="filter-group">
              <label>Method</label>
              <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
                <option value="">All</option>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All</option>
                <option value="2xx">Success (2xx)</option>
                <option value="4xx">Client Error (4xx)</option>
                <option value="5xx">Server Error (5xx)</option>
              </select>
            </div>

            <div className="filter-group search">
              <label>Search URL</label>
              <input
                type="text"
                placeholder="Filter by URL..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
            </div>

            <button className="btn-clear" onClick={handleClearLogs}>
              Clear All
            </button>
          </div>

          <div className="content">
            <div className="log-list">
              {loading && logs.length === 0 ? (
                <div className="loading">Loading...</div>
              ) : (
                <LogTable
                  logs={logs}
                  selectedId={selectedLog?._id}
                  onSelect={setSelectedLog}
                />
              )}
            </div>

            <div className="log-detail">
              {selectedLog ? (
                <LogDetail log={selectedLog} apiBase={API_BASE} />
              ) : (
                <div className="no-selection">
                  <p>Select a request to view details</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'inventory' && (
        <div className="inventory-wrapper">
          <ApiInventory />
        </div>
      )}
    </div>
  )
}

export default App
