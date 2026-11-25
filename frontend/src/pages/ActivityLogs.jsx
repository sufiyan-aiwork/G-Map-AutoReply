import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Info,
  AlertTriangle,
  RotateCcw,
  Clock,
  Filter
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

export default function ActivityLogs({ logs, onRefresh, isRefreshing }) {
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  // Auto refresh timer
  useEffect(() => {
    let intervalId = null;
    if (autoRefresh) {
      intervalId = setInterval(() => {
        if (onRefresh && !isRefreshing) {
          onRefresh();
        }
      }, 10000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoRefresh, onRefresh, isRefreshing]);

  const handleResetFilters = () => {
    setFilterType('all');
    setSearch('');
  };

  const isFiltered = filterType !== 'all' || search.trim() !== '';

  const filteredLogs = (logs || []).filter((log) => {
    if (filterType !== 'all') {
      if (log.status !== filterType && log.event_type !== filterType) return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const descMatch = (log.description || '').toLowerCase().includes(q);
      const typeMatch = (log.event_type || '').toLowerCase().includes(q);
      if (!descMatch && !typeMatch) return false;
    }
    return true;
  });

  const getEventIcon = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'success':
        return <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />;
      case 'warning':
        return <AlertTriangle size={16} className="text-amber-600 shrink-0" />;
      case 'error':
        return <AlertCircle size={16} className="text-rose-600 shrink-0" />;
      case 'info':
      default:
        return <Info size={16} className="text-blue-600 shrink-0" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Activity Logs & Audit Trail</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time audit log of review detection, star classifications, Google sync, and published replies.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
              autoRefresh
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-2 ring-emerald-500/10'
                : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
            title="Auto-refresh logs every 10 seconds"
          >
            <Clock size={13} className={autoRefresh ? 'text-emerald-600 animate-spin' : ''} />
            <span>{autoRefresh ? 'Auto (10s)' : 'Auto-Refresh'}</span>
          </button>

          {/* Manual Refresh */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-60"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search log descriptions or event types..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Events & Statuses</option>
            <option value="success">Success Status</option>
            <option value="info">Info Status</option>
            <option value="warning">Warning Status</option>
            <option value="error">Error Status</option>
            <option value="reply_published">Replies Published</option>
            <option value="review_stored">Reviews Ingested</option>
            <option value="sync_completed">Sync Runs</option>
          </select>

          {isFiltered && (
            <button
              onClick={handleResetFilters}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              title="Reset Filters"
            >
              <RotateCcw size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3.5 px-4 w-44">Timestamp</th>
                <th className="py-3.5 px-4 w-44">Event Type</th>
                <th className="py-3.5 px-4 w-28">Status</th>
                <th className="py-3.5 px-4">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-xs">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400 font-sans">
                    No activity logs match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md border border-slate-200">
                        {log.event_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {getEventIcon(log.status)}
                        <span className="font-sans font-bold text-slate-700 uppercase text-[11px]">
                          {log.status}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-800 leading-relaxed">
                      {log.description}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
