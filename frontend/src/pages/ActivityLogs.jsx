import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
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
import SelectMenu from '../components/SelectMenu';
import { TableSkeleton } from '../components/SkeletonLoader';
import { formatSafeDateTime, formatSafeIsoString } from '../utils/dateUtils';

const PAGE_SIZE = 25;

const CORE_EVENT_TYPES = [
  'admin_login_success',
  'admin_login_failed',
  'admin_logout',
  'reply_published',
  'reply_verified',
  'reply_verification_pending',
  'review_stored',
  'sync_completed',
  'automation_paused',
  'automation_resumed',
];

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
  const copyTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const intervalId = setInterval(() => {
      if (onRefresh && !isRefreshing) {
        onRefresh(true);
      }
    }, 10000);
    return () => clearInterval(intervalId);
  }, [autoRefresh, onRefresh, isRefreshing]);

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

  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, search]);

  const filterGroups = useMemo(() => {
    const discovered = (logs || []).map((l) => l.event_type).filter(Boolean);
    const mergedEvents = Array.from(new Set([...CORE_EVENT_TYPES, ...discovered])).sort();
    return [
      {
        label: 'Overview',
        options: [{ value: 'all', label: `All Events & Statuses (${logs?.length || 0})` }],
      },
      {
        label: 'By Status',
        options: [
          { value: 'success', label: 'Success' },
          { value: 'info', label: 'Info' },
          { value: 'warning', label: 'Warning' },
          { value: 'error', label: 'Error' },
        ],
      },
      {
        label: 'By Event Type',
        options: mergedEvents.map((evt) => ({ value: evt, label: formatEventLabel(evt) })),
      },
    ];
  }, [logs]);

  const handleResetFilters = () => {
    setFilterType('all');
    setSearch('');
  };

  const handleCopyDescription = async (log) => {
    if (!log) return;
    const text = `[${formatSafeIsoString(log.created_at)}] (${log.status?.toUpperCase() || 'INFO'}) ${log.event_type}: ${log.description || ''}`;
    try {
      await navigator.clipboard?.writeText(text);
      setCopiedId(log.id);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedId(null), 2000);
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
        return <Info size={15} className="text-[#025091] shrink-0" />;
    }
  };

  return (
    <div className="space-y-6 page-enter">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#1a1a2e] tracking-tight">
            Activity Logs &amp; Audit Trail
          </h1>
          <p className="text-sm text-[#64748b] mt-1">
            Real-time audit trail of review ingestion, verification states, admin sign-ins, and reply publishing.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setAutoRefresh((prev) => !prev)}
            aria-pressed={autoRefresh}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40 ${
              autoRefresh
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-2 ring-emerald-500/15'
                : 'bg-white border-[#e2e8f0] text-[#64748b] hover:text-[#1a1a2e] hover:bg-[#eff6fb]'
            }`}
            title="Auto-refresh logs every 10 seconds"
          >
            <Clock size={13} className={autoRefresh ? 'text-emerald-600 animate-spin' : ''} />
            <span>{autoRefresh ? 'Auto (10s)' : 'Auto-Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={() => onRefresh?.(false)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#025091] hover:bg-[#023e73] text-white rounded-xl text-xs font-bold transition-all duration-150 active:scale-[0.98] shadow-sm disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#e2e8f0] shadow-tz-card flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search log descriptions, statuses, or event types..."
            aria-label="Search activity logs"
            className="w-full pl-9 pr-9 py-2 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-sm text-[#1a1a2e] placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#025091]/30 focus:border-[#025091] transition-all duration-150"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search query"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-[#1a1a2e] rounded-md transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <SelectMenu
            ariaLabel="Filter logs by status or event type"
            value={filterType}
            onChange={(val) => setFilterType(val)}
            groups={filterGroups}
            align="right"
            className="flex-1 md:flex-initial min-w-[210px]"
          />

          {isFiltered && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-[#64748b] hover:text-[#1a1a2e] hover:bg-[#eff6fb] rounded-xl transition-colors"
              title="Reset Filters"
            >
              <RotateCcw size={14} />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Logs Table or Shimmer Skeleton */}
      {isLoading && (!logs || logs.length === 0) ? (
        <TableSkeleton rows={8} cols={4} />
      ) : (
        <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-tz-card overflow-hidden">
          <div className="px-4 py-2.5 bg-[#f8fafc] border-b border-[#e2e8f0] flex items-center justify-between text-xs text-[#64748b]">
            <span className="tabular-nums">
              Showing{' '}
              <strong className="text-[#1a1a2e]">
                {filteredLogs.length === 0 ? 0 : startIdx + 1}–{Math.min(startIdx + PAGE_SIZE, filteredLogs.length)}
              </strong>{' '}
              of <strong className="text-[#1a1a2e]">{filteredLogs.length}</strong> log entries
            </span>
            <span className="hidden sm:inline text-[#64748b]">Click any row for full entry details</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[11px] font-bold text-[#64748b] uppercase tracking-wider">
                  <th className="py-3 px-4 w-44">Timestamp</th>
                  <th className="py-3 px-4 w-48">Event Type</th>
                  <th className="py-3 px-4 w-28">Status</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-3 w-8" aria-label="View details" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 px-4 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-[#64748b]">
                        <History size={28} className="text-slate-300" />
                        <p className="font-heading font-bold text-[#1a1a2e] text-sm">No matching activity logs</p>
                        <p className="text-xs text-[#64748b] max-w-sm">
                          {isFiltered
                            ? 'Try adjusting your search keywords or selecting a different event filter.'
                            : 'System activity events will appear here automatically as reviews are synchronized.'}
                        </p>
                        {isFiltered && (
                          <button
                            type="button"
                            onClick={handleResetFilters}
                            className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#e8f1f8] hover:bg-[#d7e5f3] text-[#025091] rounded-xl text-xs font-semibold transition-colors"
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
                      className="hover:bg-[#eff6fb]/65 focus-visible:bg-[#eff6fb] focus-visible:outline-none transition-colors duration-150 cursor-pointer group"
                    >
                      <td className="py-3 px-4 text-[#64748b] font-mono whitespace-nowrap tabular-nums">
                        {formatSafeDateTime(log.created_at)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#1a1a2e] font-mono whitespace-nowrap">
                        <span className="bg-[#f1f5f9] text-[#1a1a2e] px-2 py-0.5 rounded-md border border-[#e2e8f0]">
                          {log.event_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {getEventIcon(log.status)}
                          <span className="font-bold text-[#1a1a2e] uppercase text-[11px]">
                            {log.status}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[#1a1a2e]/90 leading-relaxed min-w-[200px] max-w-md">
                        <p className="line-clamp-2 break-words" title={log.description}>
                          {log.description}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-slate-300 group-hover:text-[#025091] transition-colors">
                        <RowArrow size={15} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-4 py-3 bg-[#f8fafc] border-t border-[#e2e8f0] flex items-center justify-between text-xs">
              <span className="text-[#64748b] tabular-nums">
                Page <strong className="text-[#1a1a2e]">{safePage}</strong> of{' '}
                <strong className="text-[#1a1a2e]">{totalPages}</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-[#e2e8f0] hover:border-[#b9d7ef] rounded-lg font-semibold text-[#1a1a2e] hover:bg-[#eff6fb] transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-[#e2e8f0] hover:border-[#b9d7ef] rounded-lg font-semibold text-[#1a1a2e] hover:bg-[#eff6fb] transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Log Entry Detail Modal (portaled to document.body so viewport centering is unaffected by page transforms or scroll containers) */}
      {selectedLog && (() => {
        const logModal = (
          <div
            className="fixed inset-0 z-50 bg-[#00142b]/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="log-modal-title"
            onClick={() => setSelectedLog(null)}
          >
            <div
              className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-[#e2e8f0] overflow-hidden modal-enter max-h-[88vh] sm:max-h-[90vh] flex flex-col my-auto min-w-0"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-1 w-full tz-top-accent shrink-0" />

              {/* Pinned Modal Header */}
              <div className="px-5 pt-4 pb-3.5 sm:px-6 sm:pt-5 sm:pb-4 border-b border-[#e2e8f0] flex items-center justify-between gap-3 shrink-0 bg-white">
                <div className="flex items-center gap-2.5 min-w-0">
                  {getEventIcon(selectedLog.status)}
                  <div className="min-w-0">
                    <h2 id="log-modal-title" className="font-heading text-base font-bold text-[#1a1a2e] truncate">
                      Audit Log Details
                    </h2>
                    <p className="text-xs text-[#64748b] tabular-nums mt-0.5 truncate">
                      {formatSafeDateTime(selectedLog.created_at)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  aria-label="Close log details"
                  className="p-1.5 text-slate-400 hover:text-[#1a1a2e] hover:bg-slate-100 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40 shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable Modal Body */}
              <div className="px-5 py-4 sm:px-6 sm:py-5 space-y-4 overflow-y-auto flex-1 min-h-0 overscroll-contain">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] min-w-0">
                    <span className="text-[11px] font-semibold uppercase text-[#64748b] block mb-1">
                      Event Type
                    </span>
                    <code className="font-mono font-bold text-[#1a1a2e] break-all">{selectedLog.event_type}</code>
                  </div>
                  <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] min-w-0">
                    <span className="text-[11px] font-semibold uppercase text-[#64748b] block mb-1">
                      Status
                    </span>
                    <StatusBadge status={selectedLog.status || 'info'} />
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold uppercase text-[#64748b] block mb-1.5">
                    Event Message
                  </span>
                  <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-xs text-[#1a1a2e] leading-relaxed whitespace-pre-wrap break-words">
                    {selectedLog.description}
                  </div>
                </div>
              </div>

              {/* Pinned Modal Footer */}
              <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-t border-[#e2e8f0] bg-[#f8fafc] flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
                <span className="text-[#64748b] font-mono truncate max-w-[190px] sm:max-w-[240px]" title={String(selectedLog.id)}>
                  ID: {selectedLog.id}
                </span>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => handleCopyDescription(selectedLog)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#e2e8f0] hover:bg-[#e2e8f0]/60 text-[#1a1a2e] rounded-lg font-semibold transition-all duration-150 active:scale-[0.98]"
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
                    className="px-4 py-1.5 bg-[#001f3f] hover:bg-[#025091] text-white rounded-lg font-semibold transition-all duration-150 active:scale-[0.98]"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

        return typeof document !== 'undefined'
          ? createPortal(logModal, document.body)
          : logModal;
      })()}
    </div>
  );
}
