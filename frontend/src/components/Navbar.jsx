import React from 'react';
import { Play, Pause, RefreshCw, Menu, Globe2, LogOut, User } from 'lucide-react';
import StatusBadge from './StatusBadge';

const TAB_TITLES = {
  overview: 'Dashboard Overview',
  reviews: 'Customer Reviews',
  templates: 'Reply Templates',
  analytics: 'Analytics & Insights',
  automation: 'Automation Settings',
  logs: 'Activity Logs',
  google: 'Google Business Settings',
};

export default function Navbar({
  currentTab = 'overview',
  autoReplyEnabled,
  onToggleAutomation,
  onRefresh,
  onSyncReviews,
  isRefreshing,
  isSyncing,
  businessName = 'Techzone Academy',
  onToggleMobileMenu,
  adminUser,
  onLogout
}) {
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 text-navy-800 hover:bg-navy-50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <Menu size={20} />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-bold text-navy-900 tracking-tight truncate">
              {TAB_TITLES[currentTab] || businessName}
            </h2>
            <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              <Globe2 size={11} />
              <span>{businessName}</span>
            </span>
          </div>
          <p className="hidden sm:block text-[11px] text-slate-500 font-medium">
            Google Business Profile Review Automation
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Sync Google Reviews Button */}
        {onSyncReviews && (
          <button
            type="button"
            onClick={onSyncReviews}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60"
            title="Synchronize reviews from Google Business Profile"
          >
            <RefreshCw size={13} className={isSyncing ? 'animate-spin text-blue-600' : ''} />
            <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync Reviews'}</span>
            <span className="sm:hidden">{isSyncing ? '...' : 'Sync'}</span>
          </button>
        )}

        {/* Auto Reply Control Pill */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-2 sm:px-3 py-1 rounded-xl">
          <span className="hidden xl:inline text-xs text-slate-600 font-medium">Auto-Reply:</span>
          <StatusBadge status={autoReplyEnabled ? 'active' : 'paused'} />
          <button
            type="button"
            onClick={onToggleAutomation}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              autoReplyEnabled
                ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
            title={autoReplyEnabled ? 'Pause Automatic Replies' : 'Resume Automatic Replies'}
          >
            {autoReplyEnabled ? (
              <>
                <Pause size={12} />
                <span className="hidden sm:inline">Pause</span>
              </>
            ) : (
              <>
                <Play size={12} />
                <span className="hidden sm:inline">Resume</span>
              </>
            )}
          </button>
        </div>

        {/* Global Refresh Button */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label="Refresh all dashboard data"
          className="p-2 text-slate-500 hover:text-navy-900 hover:bg-navy-50 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60"
          title="Refresh All Dashboard Data"
        >
          <RefreshCw size={16} className={isRefreshing ? 'animate-spin text-blue-600' : ''} />
        </button>

        {/* Admin User & Logout */}
        {adminUser && (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <span className="hidden lg:inline-flex items-center gap-1.5 text-xs font-semibold text-navy-900 bg-navy-50 border border-navy-100 px-2.5 py-1 rounded-lg">
              <User size={13} className="text-blue-600" />
              <span className="max-w-[140px] truncate">{adminUser.username}</span>
            </span>
            <button
              type="button"
              onClick={onLogout}
              aria-label="Sign out"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              title="Sign Out"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
