import React from 'react';

export default function StatCard({ title, value, subtitle, icon: Icon, color = 'blue', onClick = null }) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    navy: 'bg-navy-50 text-navy-800 border-navy-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  };

  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick || undefined}
      className={`w-full text-left bg-white rounded-xl border border-slate-200/90 p-5 shadow-sm transition-all ${
        onClick
          ? 'hover:shadow-md hover:border-blue-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
          : 'hover:shadow-md'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">{title}</p>
          <h3 className="text-2xl font-bold text-navy-900 mt-1.5 tabular-nums">{value}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-1 truncate">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-xl border shrink-0 ${colorMap[color] || colorMap.blue}`}>
            <Icon size={22} />
          </div>
        )}
      </div>
    </Component>
  );
}
