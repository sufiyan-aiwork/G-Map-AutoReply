import React from 'react';

export function KpiGridSkeleton({
  count = 6,
  colsClass = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6',
}) {
  return (
    <div className={`grid ${colsClass} gap-4`} aria-hidden="true">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="bg-white rounded-2xl border border-[#e2e8f0] p-5 shadow-tz-card"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 space-y-2.5">
              <div className="h-3 w-20 rounded skeleton-shimmer" />
              <div className="h-7 w-14 rounded skeleton-shimmer" />
              <div className="h-2.5 w-24 rounded skeleton-shimmer" />
            </div>
            <div className="w-11 h-11 rounded-xl skeleton-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ height = 'h-64' }) {
  return (
    <div
      className={`bg-white rounded-2xl border border-[#e2e8f0] p-6 shadow-tz-card ${height}`}
      aria-hidden="true"
    >
      <div className="h-4 w-44 rounded mb-3 skeleton-shimmer" />
      <div className="h-3 w-64 rounded mb-6 skeleton-shimmer" />
      <div className="space-y-3">
        <div className="h-3 w-full rounded skeleton-shimmer" />
        <div className="h-3 w-5/6 rounded skeleton-shimmer" />
        <div className="h-3 w-4/6 rounded skeleton-shimmer" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 6 }) {
  return (
    <div
      className="bg-white rounded-2xl border border-[#e2e8f0] shadow-tz-card overflow-hidden"
      aria-hidden="true"
    >
      <div className="bg-[#f8fafc] border-b border-[#e2e8f0] px-4 py-3.5 flex gap-4">
        {Array.from({ length: cols }).map((_, idx) => (
          <div key={idx} className="h-3 flex-1 rounded skeleton-shimmer" />
        ))}
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="px-4 py-4 flex items-center gap-4">
            {Array.from({ length: cols }).map((_, cIdx) => (
              <div key={cIdx} className="h-3.5 flex-1 rounded skeleton-shimmer" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
