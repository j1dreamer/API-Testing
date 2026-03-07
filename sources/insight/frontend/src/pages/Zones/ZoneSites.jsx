import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layers, Server, MapPin, ChevronRight, ChevronLeft, RefreshCw, Wifi, Search, Filter, ArrowUp, ArrowDown } from 'lucide-react';
import apiClient from '../../api/apiClient';
import { useSite } from '../../context/SiteContext';

const STATUS_BADGE = {
  up: { label: 'Online', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  down: { label: 'Offline', cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
};

const ZoneSites = () => {
  const { zoneId } = useParams();
  const navigate = useNavigate();
  const { sites, fetchSites, loadingSites } = useSite();

  const [zone, setZone] = useState(null);
  const [loadingZone, setLoadingZone] = useState(true);
  const [siteSearch, setSiteSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  const fetchZone = useCallback(async () => {
    setLoadingZone(true);
    try {
      const res = await apiClient.get(`/zones/${zoneId}`);
      setZone(res.data);
    } catch (err) {
      console.error('Failed to fetch zone:', err);
    } finally {
      setLoadingZone(false);
    }
  }, [zoneId]);

  useEffect(() => {
    fetchZone();
    if (sites.length === 0) fetchSites();
  }, [fetchZone]);

  const handleRefresh = () => {
    fetchZone();
    fetchSites();
  };

  // Filter and sort sites belonging to this zone
  const zoneSiteIds = new Set(zone?.site_ids || []);
  const zoneSites = sites.filter(s => {
    const id = s.siteId || s.id || s._id;
    if (!zoneSiteIds.has(id)) return false;

    // Status filter
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;

    // Text search
    if (!siteSearch) return true;
    const name = s.siteName || s.name || id;
    return name.toLowerCase().includes(siteSearch.toLowerCase());
  }).sort((a, b) => {
    if (sortConfig.key === 'name') {
      const nameA = (a.siteName || a.name || a.siteId || '').toLowerCase();
      const nameB = (b.siteName || b.name || b.siteId || '').toLowerCase();
      return sortConfig.direction === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    } else if (sortConfig.key === 'status') {
      const statusA = a.status || '';
      const statusB = b.status || '';
      return sortConfig.direction === 'asc' ? statusA.localeCompare(statusB) : statusB.localeCompare(statusA);
    }
    return 0;
  });

  const loading = loadingZone || loadingSites;

  if (loading && !zone) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/zones')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: zone?.color || '#3B82F6' }}
          />
          <div>
            <h1 className="text-lg font-semibold text-white">{zone?.name || 'Zone'}</h1>
            {zone?.description && (
              <p className="text-xs text-slate-500 mt-0.5">{zone.description}</p>
            )}
          </div>
          <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full ml-1">
            {zoneSites.length} sites
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/zones/${zoneId}/logs`)}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg transition-colors"
          >
            Xem logs
          </button>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Filter / Search / Sort */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm kiếm site..."
            value={siteSearch}
            onChange={(e) => setSiteSearch(e.target.value)}
            className="w-full bg-[#0F172A] border border-slate-700 rounded-lg text-sm text-slate-200 pl-9 pr-4 py-2 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-sm text-slate-200 focus:outline-none appearance-none pr-4 cursor-pointer"
            >
              <option value="all" className="bg-slate-800">Tất cả trạng thái</option>
              <option value="up" className="bg-slate-800">Online</option>
              <option value="down" className="bg-slate-800">Offline</option>
            </select>
          </div>

          {/* Sort Selection */}
          <div className="flex items-center gap-2 bg-[#0F172A] border border-slate-700 rounded-lg px-2 py-1">
            <select
              value={sortConfig.key}
              onChange={(e) => setSortConfig({ ...sortConfig, key: e.target.value })}
              className="bg-transparent text-sm text-slate-200 focus:outline-none appearance-none pl-2 pr-4 py-1 cursor-pointer"
            >
              <option value="name" className="bg-slate-800">Tên site</option>
              <option value="status" className="bg-slate-800">Trạng thái</option>
            </select>
            <button
              onClick={() => setSortConfig({
                ...sortConfig,
                direction: sortConfig.direction === 'asc' ? 'desc' : 'asc'
              })}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
              title="Đảo chiều sắp xếp"
            >
              {sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Sites list */}
      {zoneSites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Server className="w-12 h-12 mb-3 opacity-20" />
          <p className="text-sm">Zone này chưa có site nào.</p>
          <p className="text-xs text-slate-600 mt-1">Admin có thể thêm sites vào zone trong Zone Management.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {zoneSites.map(site => {
            const id = site.siteId || site.id || site._id;
            const name = site.siteName || site.name || id;
            const role = site.internal_app_role || site.aruba_role_raw || '';
            return (
              <div
                key={id}
                onClick={() => navigate(`/site/${id}`)}
                className="bg-[#0F172A] border border-slate-800 rounded-lg p-3 cursor-pointer hover:border-blue-500/50 hover:bg-slate-800/50 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-800 rounded-md border border-slate-700">
                    <MapPin size={16} className="text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white mb-0.5">{name}</h3>
                    <div className="flex items-center gap-2">
                      <Wifi size={12} className="text-slate-500" />
                      <span className="text-xs text-slate-500 uppercase tracking-wider">{role || 'Site'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {site.status && STATUS_BADGE[site.status] && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_BADGE[site.status].cls}`}>
                      {STATUS_BADGE[site.status].label}
                    </span>
                  )}
                  <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ZoneSites;
