import React from 'react';

export default function StatCard({ title, value, subtitle, icon: Icon, color = 'blue', onClick = null }) {
  const colorMap = {
    blue: 'bg-[#e8f1f8] text-[#025091] border-[#b9d7ef]',
    navy: 'bg-[#eef4fa] text-[#001f3f] border-[#d7e5f3]',
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
  };

  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick || undefined}
      className={`w-full h-full flex flex-col justify-between text-left bg-white rounded-2xl border border-[#e2e8f0] p-4 sm:p-5 shadow-tz-card transition-all duration-200 ${
        onClick
          ? 'hover:shadow-tz-card-hover hover:-translate-y-0.5 hover:border-[#b9d7ef] active:translate-y-0 active:scale-[0.99] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40'
          : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2.5 w-full">
        <p className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider leading-snug break-words">
          {title}
        </p>
        {Icon && (
          <div className={`p-2 rounded-xl border shrink-0 ${colorMap[color] || colorMap.blue}`}>
            <Icon size={18} />
          </div>
        )}
      </div>

      <div className="mt-3">
        <h3 className="font-heading text-2xl font-bold text-[#1a1a2e] tabular-nums tracking-tight leading-tight">
          {value}
        </h3>
        {subtitle && (
          <p className="text-xs text-[#64748b] mt-1 leading-snug break-words">
            {subtitle}
          </p>
        )}
      </div>
    </Component>
  );
}
