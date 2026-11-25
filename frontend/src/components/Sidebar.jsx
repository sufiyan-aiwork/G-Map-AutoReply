import React from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  BarChart3,
  Sliders,
  History,
  Globe2,
  GraduationCap,
  X
} from 'lucide-react';

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
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'automation', label: 'Automation Settings', icon: Sliders },
    { id: 'logs', label: 'Activity Logs', icon: History },
    { id: 'google', label: 'Google Business Settings', icon: Globe2 },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-navy-950/60 backdrop-blur-sm lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        aria-label="Primary Navigation"
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-navy-900 text-slate-300 flex flex-col shrink-0 min-h-screen border-r border-navy-800 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-navy-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-blue-400 flex items-center justify-center text-white shadow-md shadow-blue-600/30 shrink-0">
              <GraduationCap size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white tracking-tight truncate">Techzone Academy</h1>
              <p className="text-[10px] text-blue-300 font-semibold tracking-wider uppercase">Review Automation</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="lg:hidden text-slate-400 hover:text-white p-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          <div className="px-3 mb-2 text-[10px] font-bold text-blue-300/70 uppercase tracking-widest">
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
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-950/40'
                    : 'text-slate-300 hover:text-white hover:bg-navy-800/80'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-white shrink-0' : 'text-blue-300/70 shrink-0'} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Live Automation Status Footer */}
        <div className="p-4 border border-navy-700/80 m-3 rounded-xl bg-navy-800/70">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                {autoReplyEnabled && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    autoReplyEnabled ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                ></span>
              </span>
              <span className="text-xs font-semibold text-white">
                {autoReplyEnabled ? 'Auto-Reply Active' : 'Auto-Reply Paused'}
              </span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-navy-900 text-blue-300 font-semibold border border-navy-700">
              {pollingInterval}m
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            Rule: 3–5★ Positive, 1–2★ Negative
          </p>
        </div>
      </aside>
    </>
  );
}
