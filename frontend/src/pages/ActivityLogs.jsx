import React, { useState, useEffect, useMemo } from 'react';
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
  X,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronRight as RowArrow
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { TableSkeleton } from '../components/SkeletonLoader';

const PAGE_SIZE = 25;

const formatEventLabel = (eventType) =>
  (eventType || '')
    .split('_')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ');

export default function ActivityLogs({ logs, isLoading, onRefresh, isRefreshing }) {
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Auto refresh timer (background tick)
  useEffect(() => {
    if (!autoRefresh) return undefined;
    const intervalId = setInterval(() => {
      if (onRefresh && !isRefreshing) {
        onRefresh(true);
      }
    }, 10000);
    return () => clearInterval(intervalId);
  }, [autoRefresh, onRefresh, isRefreshing]);

  // Escape closes detail modal
  useEffect(() => {
    if (!selectedLog) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedLog(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLog]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, search]);

  const uniqueEventTypes = useMemo(
    () => Array.from(new Set((logs || []).map((l) => l.event_type).filter(Boolean))).sort(),
    [logs]
  );

  const handleResetFilters = () => {
    setFilterType('all');
    setSearch('');
  };

  const handleCopyDescription = async (log) => {
    if (!log) return;
    const text = `[${new Date(log.created_at).toISOString()}] (${log.status?.toUpperCase() || 'INFO'}) ${log.event_type}: ${log.description || ''}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(log.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard write unavailable in non-secure context
    }
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
      const statusMatch = (log.status || '').toLowerCase().includes(q);
      if (!descMatch && !typeMatch && !statusMatch) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const paginatedLogs = filteredLogs.slice(startIdx, startIdx + PAGE_SIZE);

  const getEventIcon = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'success':
        return <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />;
      case 'warning':
        return <AlertTriangle size={15} className="text-amber-600 shrink-0" />;
      case 'error':
        return <AlertCircle size={15} className="text-rose-600 shrink-0" />;
      case 'info':
      default:
        return <Info size={15} className="text-blue-600 shrink-0" />;
    }
  };

  return (
    <div className="space-y-6 page-enter">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 tracking-tight">Activity Logs &amp; Audit Trail</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time audit trail of review ingestion, verification states, admin sign-ins, and reply publishing.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* Auto Refresh Toggle */}
          <button
            type="button"
            onClick={() => setAutoRefresh((prev) => !prev)}
            aria-pressed={autoRefresh}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              autoRefresh
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-2 ring-emerald-500/15'
                : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
            title="Auto-refresh logs every 10 seconds"
          >
            <Clock size={13} className={autoRefresh ? 'text-emerald-600 animate-spin' : ''} />
            <span>{autoRefresh ? 'Auto (10s)' : 'Auto-Refresh'}</span>
          </button>

          {/* Manual Refresh */}
          <button
            type="button"
            onClick={() => onRefresh?.(false)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search log descriptions, statuses, or event types..."
            aria-label="Search activity logs"
            className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-navy-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search query"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded-md"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            aria-label="Filter logs by status or event type"
            className="flex-1 md:flex-initial px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Events &amp; Statuses ({logs?.length || 0})</option>
            <optgroup label="By Status">
              <option value="success">Success</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </optgroup>
            {uniqueEventTypes.length > 0 && (
              <optgroup label="By Event Type">
                {uniqueEventTypes.map((evt) => (
                  <option key={evt} value={evt}>
                    {formatEventLabel(evt)}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          {isFiltered && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-slate-600 hover:text-navy-900 hover:bg-slate-100 rounded-xl transition-colors"
              title="Reset Filters"
            >
              <RotateCcw size={14} />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Logs Table or Loading Skeleton */}
      {isLoading && (!logs || logs.length === 0) ? (
        <TableSkeleton rows={8} cols={4} />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span className="tabular-nums">
              Showing <strong className="text-navy-900">{filteredLogs.length === 0 ? 0 : startIdx + 1}–{Math.min(startIdx + PAGE_SIZE, filteredLogs.length)}</strong> of{' '}
              <strong className="text-navy-900">{filteredLogs.length}</strong> log entries
            </span>
            <span className="hidden sm:inline text-slate-400">Click any row for full entry details</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4 w-44">Timestamp</th>
                  <th className="py-3 px-4 w-48">Event Type</th>
                  <th className="py-3 px-4 w-28">Status</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-3 w-8" aria-label="View details"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 px-4 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
                        <History size={28} className="text-slate-300" />
                        <p className="font-semibold text-navy-900 text-sm">No matching activity logs</p>
                        <p className="text-xs text-slate-400 max-w-sm">
                          {isFiltered
                            ? 'Try adjusting your search keywords or selecting a different event filter.'
                            : 'System activity events will appear here automatically as reviews are synchronized.'}
                        </p>
                        {isFiltered && (
                          <button
                            type="button"
                            onClick={handleResetFilters}
                            className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition-colors"
                          >
                            <RotateCcw size={13} />
                            <span>Reset Filters</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map((log) => (
                    <tr
                      key={log.id}
                      tabIndex={0}
                      onClick={() => setSelectedLog(log)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedLog(log);
                        }
                      }}
                      className="hover:bg-blue-50/40 focus-visible:bg-blue-50/50 focus-visible:outline-none transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 text-slate-500 font-mono whitespace-nowrap tabular-nums">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-semibold text-navy-900 font-mono whitespace-nowrap">
                        <span className="bg-slate-100 text-navy-900 px-2 py-0.5 rounded-md border border-slate-200">
                          {log.event_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {getEventIcon(log.status)}
                          <span className="font-bold text-slate-700 uppercase text-[11px]">
                            {log.status}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 leading-relaxed max-w-xl truncate">
                        {log.description}
                      </td>
                      <td className="py-3 px-3 text-slate-300 group-hover:text-blue-600 transition-colors">
                        <RowArrow size={15} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500 tabular-nums">
                Page <strong className="text-navy-900">{safePage}</strong> of{' '}
                <strong className="text-navy-900">{totalPages}</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={14} />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Log Entry Detail Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="log-modal-title"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 modal-enter space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                {getEventIcon(selectedLog.status)}
                <div>
                  <h2 id="log-modal-title" className="text-base font-bold text-navy-900">
                    Audit Log Details
                  </h2>
                  <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                    {new Date(selectedLog.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                aria-label="Close log details"
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] font-semibold uppercase text-slate-400 block mb-1">
                  Event Type
                </span>
                <code className="font-mono font-bold text-navy-900">{selectedLog.event_type}</code>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] font-semibold uppercase text-slate-400 block mb-1">
                  Status
                </span>
                <StatusBadge status={selectedLog.status || 'info'} />
              </div>
            </div>

            <div>
              <span className="text-[11px] font-semibold uppercase text-slate-400 block mb-1.5">
                Event Message
              </span>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap break-words max-h-56 overflow-y-auto">
                {selectedLog.description}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-400 font-mono truncate max-w-[220px]" title={String(selectedLog.id)}>
                ID: {selectedLog.id}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyDescription(selectedLog)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-navy-900 rounded-lg font-semibold transition-colors"
                >
                  {copiedId === selectedLog.id ? (
                    <>
                      <Check size={13} className="text-emerald-600" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>Copy Entry</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-1.5 bg-navy-900 hover:bg-navy-800 text-white rounded-lg font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
