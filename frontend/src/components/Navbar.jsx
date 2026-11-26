import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  RefreshCw,
  Menu,
  Globe2,
  LogOut,
  User,
  ChevronDown,
  Settings,
  ShieldCheck
} from 'lucide-react';
import StatusBadge from './StatusBadge';

const TAB_TITLES = {
  overview: 'Dashboard Overview',
  reviews: 'Customer Reviews',
  templates: 'Reply Templates',
  logs: 'Activity Logs',
  settings: 'Settings',
};

const getInitials = (nameOrEmail) => {
  const raw = (nameOrEmail || '').trim();
  if (!raw) return 'TA';
  const base = raw.includes('@') ? raw.split('@')[0] : raw;
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
};

export default function Navbar({
  currentTab = 'overview',
  onSelectTab,
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);
  const profileMenuRef = useRef(null);
  const triggerRef = useRef(null);
  const closeTimerRef = useRef(null);

  const accountIdentity = adminUser?.email || adminUser?.username || 'Administrator';
  const accountDisplayName = adminUser?.full_name || accountIdentity;
  const initials = getInitials(adminUser?.full_name || accountIdentity);

  const openProfileMenu = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setMenuClosing(false);
    setMenuOpen(true);
  };

  const closeProfileMenu = (restoreFocus = false) => {
    if (!menuOpen || menuClosing) return;
    setMenuClosing(true);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setMenuOpen(false);
      setMenuClosing(false);
      if (restoreFocus) {
        triggerRef.current?.focus();
      }
    }, 130);
  };

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const handlePointerDown = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        closeProfileMenu(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeProfileMenu(true);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen, menuClosing]);

  const handleAccountInfoClick = () => {
    closeProfileMenu(false);
    onSelectTab?.('settings');
  };

  const handleLogoutClick = () => {
    closeProfileMenu(false);
    onLogout?.();
  };

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

        {/* Primary Global Auto-Reply Control Pill */}
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

        {/* Consolidated Profile Dropdown */}
        {adminUser && (
          <div ref={profileMenuRef} className="relative pl-1.5 sm:pl-2 border-l border-[#e2e8f0]">
            <button
              ref={triggerRef}
              type="button"
              onClick={() => (menuOpen ? closeProfileMenu(false) : openProfileMenu())}
              aria-haspopup="menu"
              aria-expanded={menuOpen && !menuClosing}
              aria-label="Account profile and sign out menu"
              className={`inline-flex items-center gap-2 pl-1.5 pr-2 sm:pr-2.5 py-1 rounded-xl border transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40 ${
                menuOpen
                  ? 'bg-[#e8f1f8] border-[#025091] text-[#025091]'
                  : 'bg-[#f8fafc] border-[#e2e8f0] hover:bg-[#eff6fb] hover:border-[#b9d7ef] text-[#1a1a2e]'
              }`}
            >
              <span className="w-7 h-7 rounded-lg bg-[#025091] text-white font-heading font-bold text-[11px] flex items-center justify-center shrink-0 shadow-sm">
                {initials || <User size={13} />}
              </span>
              <span className="hidden lg:inline text-xs font-semibold text-[#1a1a2e] max-w-[155px] truncate">
                {accountIdentity}
              </span>
              <ChevronDown
                size={14}
                className={`text-[#64748b] shrink-0 transition-transform duration-150 ${
                  menuOpen && !menuClosing ? 'rotate-180 text-[#025091]' : ''
                }`}
              />
            </button>

            {menuOpen && (
              <div
                role="menu"
                aria-label="Administrator account options"
                className={`absolute right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] bg-white rounded-2xl border border-[#e2e8f0] shadow-xl overflow-hidden z-50 ${
                  menuClosing ? 'dropdown-exit' : 'dropdown-enter'
                }`}
              >
                <div className="h-1 w-full tz-top-accent" />

                {/* Account Identity Header */}
                <div className="px-4 py-3.5 bg-[#f8fafc] border-b border-[#e2e8f0]">
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-xl bg-[#025091] text-white font-heading font-bold text-xs flex items-center justify-center shrink-0">
                      {initials || <User size={15} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#1a1a2e] truncate">
                        {accountDisplayName}
                      </p>
                      <p className="text-[11px] text-[#64748b] truncate mt-0.5" title={accountIdentity}>
                        {accountIdentity}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-semibold text-emerald-700">
                    <ShieldCheck size={11} />
                    <span>Authenticated Session</span>
                  </div>
                </div>

                {/* Menu Actions */}
                <div className="p-1.5 space-y-0.5">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleAccountInfoClick}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#1a1a2e] hover:bg-[#eff6fb] hover:text-[#025091] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40"
                  >
                    <Settings size={15} className="text-[#025091] shrink-0" />
                    <span>Account Information</span>
                  </button>

                  <div className="my-1 border-t border-[#e2e8f0]" role="separator" />

                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogoutClick}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                  >
                    <LogOut size={15} className="text-rose-600 shrink-0" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
