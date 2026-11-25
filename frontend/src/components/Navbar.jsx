import React from 'react';
import { Play, Pause, RefreshCw, Menu, Globe2, LogOut, User } from 'lucide-react';
import StatusBadge from './StatusBadge';

export default function Navbar({
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
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Menu Button */}
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          title="Toggle Navigation Menu"
        >
          <Menu size={20} />
        </button>

        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">{businessName}</h2>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              <Globe2 size={11} />
              <span>Google Profile</span>
            </span>
          </div>
          <p className="hidden md:block text-[11px] text-slate-500 font-medium">Customer Review Reply Automation</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Sync Google Reviews Button */}
        {onSyncReviews && (
          <button
            onClick={onSyncReviews}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-semibold shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
            title="Fetch and publish new reviews from Google Business Profile"
          >
            <RefreshCw size={13} className={isSyncing ? 'animate-spin text-blue-600' : ''} />
            <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync Reviews'}</span>
            <span className="sm:hidden">{isSyncing ? '...' : 'Sync'}</span>
          </button>
        )}

        {/* Auto Reply Control Button */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-2 sm:px-3 py-1.5 rounded-xl">
          <span className="hidden md:inline text-xs text-slate-600 font-medium">Auto-Reply:</span>
          <StatusBadge status={autoReplyEnabled ? 'active' : 'paused'} />
          <button
            onClick={onToggleAutomation}
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-xs hover:scale-[1.02] active:scale-[0.98] ${
              autoReplyEnabled
                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
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
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all hover:rotate-180"
          title="Refresh All Dashboard Data"
        >
          <RefreshCw size={16} className={isRefreshing ? 'animate-spin text-blue-600' : ''} />
        </button>

        {/* Admin User & Logout */}
        {adminUser && (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <span className="hidden lg:inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
              <User size={13} className="text-slate-500" />
              <span>{adminUser.username}</span>
            </span>
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors"
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
