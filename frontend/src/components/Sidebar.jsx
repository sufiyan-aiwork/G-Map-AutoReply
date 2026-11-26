import React from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  History,
  Settings,
  X
} from 'lucide-react';
import BrandLogo from './BrandLogo';

export default function Sidebar({
  currentTab,
  onSelectTab,
  isOpen,
  onClose,
  autoReplyEnabled = false,
  pollingInterval = 15,
}) {
  const menuItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'reviews', label: 'Customer Reviews', icon: MessageSquare },
    { id: 'templates', label: 'Reply Templates', icon: FileText },
    { id: 'logs', label: 'Activity Logs', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-[#00142b]/65 backdrop-blur-sm lg:hidden transition-opacity duration-200"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        aria-label="Primary Navigation"
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#001f3f] text-slate-200 flex flex-col shrink-0 min-h-screen border-r border-[#012b55] transition-transform duration-200 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top TechZone Accent Line */}
        <div className="h-1 w-full tz-top-accent shrink-0" />

        {/* Brand Header with Official TechZone Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-[#012b55]">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo size="md" surface="dark" />
            <div className="min-w-0">
              <h1 className="font-heading text-sm font-bold text-white tracking-tight truncate">
                TechZone Academy
              </h1>
              <p className="text-[10px] text-[#00d2ff]/90 font-semibold tracking-wider uppercase truncate">
                Review Automation
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="lg:hidden text-slate-300 hover:text-white hover:bg-[#012b55] p-1.5 rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d2ff]/60"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          <div className="px-3 mb-2.5 text-[10px] font-bold text-sky-200/60 uppercase tracking-widest">
            Workspace
          </div>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  if (onClose) onClose();
                }}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d2ff]/60 ${
                  isActive
                    ? 'bg-[#025091] text-white font-semibold shadow-md shadow-[#00142b]/50'
                    : 'text-slate-300 hover:text-white hover:bg-[#012b55]'
                }`}
              >
                <span
                  className={`w-1 h-4 rounded-full shrink-0 transition-colors duration-150 ${
                    isActive ? 'bg-[#00d2ff]' : 'bg-transparent'
                  }`}
                  aria-hidden="true"
                />
                <Icon
                  size={17}
                  className={`shrink-0 transition-colors duration-150 ${
                    isActive ? 'text-white' : 'text-sky-200/75'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Live Automation Status Footer */}
        <div className="p-3.5 border border-[#025091]/40 m-3 rounded-xl bg-[#012b55]/90">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                  autoReplyEnabled ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span className="text-xs font-semibold text-white truncate">
                {autoReplyEnabled ? 'Auto-Reply Active' : 'Auto-Reply Paused'}
              </span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#001f3f] text-[#00d2ff] font-semibold border border-[#025091]/60 shrink-0 tabular-nums">
              {pollingInterval}m
            </span>
          </div>
          <p className="text-[11px] text-slate-300/80 leading-snug">
            Rule: 3–5★ Positive · 1–2★ Negative
          </p>
        </div>
      </aside>
    </>
  );
}
