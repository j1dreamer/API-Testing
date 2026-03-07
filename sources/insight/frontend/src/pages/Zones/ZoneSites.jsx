import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layers, Server, MapPin, ChevronRight, ChevronLeft, RefreshCw, Wifi } from 'lucide-react';
import apiClient from '../../api/apiClient';
import { useSite } from '../../context/SiteContext';

const STATUS_BADGE = {
  up:   { label: 'Online',  cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  down: { label: 'Offline', cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
};

const ZoneSites = () => {
  const { zoneId } = useParams();
  const navigate = useNavigate();
  const { sites, fetchSites, loadingSites } = useSite();

  const [zone, setZone] = useState(null);
  const [loadingZone, setLoadingZone] = useState(true);

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

  // Filter sites belonging to this zone
  const zoneSiteIds = new Set(zone?.site_ids || []);
  const zoneSites = sites.filter(s => {
    const id = s.siteId || s.id || s._id;
    return zoneSiteIds.has(id);
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

      {/* Sites grid */}
      {zoneSites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Server className="w-12 h-12 mb-3 opacity-20" />
          <p className="text-sm">Zone này chưa có site nào.</p>
          <p className="text-xs text-slate-600 mt-1">Admin có thể thêm sites vào zone trong Zone Management.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {zoneSites.map(site => {
            const id = site.siteId || site.id || site._id;
            const name = site.siteName || site.name || id;
            const role = site.internal_app_role || site.aruba_role_raw || '';
            return (
              <div
                key={id}
                onClick={() => navigate(`/site/${id}`)}
                className="bg-[#0F172A] border border-slate-800 rounded-lg p-5 cursor-pointer hover:border-blue-500/50 hover:bg-slate-800/50 transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 bg-slate-800 rounded-md border border-slate-700">
                    <MapPin size={16} className="text-blue-400" />
                  </div>
                  <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1 truncate">{name}</h3>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Wifi size={12} className="text-slate-500" />
                    <span className="text-xs text-slate-500 uppercase tracking-wider">{role || 'Site'}</span>
                  </div>
                  {site.status && STATUS_BADGE[site.status] && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_BADGE[site.status].cls}`}>
                      {STATUS_BADGE[site.status].label}
                    </span>
                  )}
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
