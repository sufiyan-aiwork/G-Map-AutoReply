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
  businessName = 'TechZone Academy',
  onToggleMobileMenu,
  adminUser,
  onLogout
}) {
  return (
    <header className="h-16 bg-white border-b border-[#e2e8f0] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-[0_1px_3px_rgba(2,80,145,0.04)]">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 text-[#001f3f] hover:bg-[#e8f1f8] rounded-xl transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40"
        >
          <Menu size={20} />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-sm sm:text-base font-bold text-[#1a1a2e] tracking-tight truncate">
              {TAB_TITLES[currentTab] || businessName}
            </h2>
            <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-semibold text-[#025091] bg-[#e8f1f8] px-2.5 py-0.5 rounded-full border border-[#b9d7ef]">
              <Globe2 size={11} />
              <span>{businessName}</span>
            </span>
          </div>
          <p className="hidden sm:block text-[11px] text-[#64748b] font-medium">
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#e8f1f8] border border-[#b9d7ef] hover:bg-[#d7e5f3] text-[#025091] rounded-xl text-xs font-semibold transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40 disabled:opacity-60 disabled:cursor-not-allowed"
            title="Synchronize reviews from Google Business Profile"
          >
            <RefreshCw size={13} className={isSyncing ? 'animate-spin text-[#025091]' : ''} />
            <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync Reviews'}</span>
            <span className="sm:hidden">{isSyncing ? '...' : 'Sync'}</span>
          </button>
        )}

        {/* Auto Reply Control Pill */}
        <div className="flex items-center gap-2 bg-[#f8fafc] border border-[#e2e8f0] px-2 sm:px-3 py-1 rounded-xl">
          <span className="hidden xl:inline text-xs text-[#64748b] font-medium">Auto-Reply:</span>
          <StatusBadge status={autoReplyEnabled ? 'active' : 'paused'} />
          <button
            type="button"
            onClick={onToggleAutomation}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40 ${
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
          className="p-2 text-[#64748b] hover:text-[#025091] hover:bg-[#e8f1f8] rounded-xl transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40 disabled:opacity-60 disabled:cursor-not-allowed"
          title="Refresh All Dashboard Data"
        >
          <RefreshCw size={16} className={isRefreshing ? 'animate-spin text-[#025091]' : ''} />
        </button>

        {/* Admin User & Logout */}
        {adminUser && (
          <div className="flex items-center gap-2 pl-2 border-l border-[#e2e8f0]">
            <span className="hidden lg:inline-flex items-center gap-1.5 text-xs font-semibold text-[#025091] bg-[#eff6fb] border border-[#d7e5f3] px-2.5 py-1 rounded-lg">
              <User size={13} className="text-[#025091]" />
              <span className="max-w-[140px] truncate">{adminUser.username}</span>
            </span>
            <button
              type="button"
              onClick={onLogout}
              aria-label="Sign out"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[#64748b] hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
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
