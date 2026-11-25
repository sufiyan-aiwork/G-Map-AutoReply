import React from 'react';

export function KpiGridSkeleton({ count = 6, colsClass = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6' }) {
  return (
    <div className={`grid ${colsClass} gap-4`} aria-hidden="true">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm animate-pulse">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 space-y-2.5">
              <div className="h-3 w-20 bg-slate-200 rounded" />
              <div className="h-7 w-14 bg-slate-200 rounded" />
              <div className="h-2.5 w-24 bg-slate-100 rounded" />
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-50" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ height = 'h-64' }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm animate-pulse ${height}`} aria-hidden="true">
      <div className="h-4 w-40 bg-slate-200 rounded mb-3" />
      <div className="h-3 w-64 bg-slate-100 rounded mb-6" />
      <div className="space-y-3">
        <div className="h-3 w-full bg-slate-100 rounded" />
        <div className="h-3 w-5/6 bg-slate-100 rounded" />
        <div className="h-3 w-4/6 bg-slate-100 rounded" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 6 }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden animate-pulse" aria-hidden="true">
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3.5 flex gap-4">
        {Array.from({ length: cols }).map((_, idx) => (
          <div key={idx} className="h-3 flex-1 bg-slate-200 rounded" />
        ))}
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="px-4 py-4 flex items-center gap-4">
            {Array.from({ length: cols }).map((_, cIdx) => (
              <div key={cIdx} className="h-3.5 flex-1 bg-slate-100 rounded" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
