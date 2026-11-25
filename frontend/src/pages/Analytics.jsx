import React from 'react';
import {
  BarChart3,
  TrendingUp,
  CheckCircle2,
  Star,
  Clock,
  Award,
  Layers,
  Smile,
  Frown,
  AlertCircle
} from 'lucide-react';
import StatCard from '../components/StatCard';
import { KpiGridSkeleton, CardSkeleton } from '../components/SkeletonLoader';

export default function Analytics({ summary, reviews, isLoading }) {
  if (isLoading && !summary) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-72 bg-slate-200 rounded-xl animate-pulse" />
        <KpiGridSkeleton count={4} colsClass="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CardSkeleton height="h-80" />
          <CardSkeleton height="h-80" />
        </div>
      </div>
    );
  }

  const total = summary?.total_reviews || 0;
  const posCount = summary?.positive_reviews_count || 0;
  const negCount = summary?.negative_reviews_count || 0;
  const published = summary?.total_published_replies || 0;
  const failed = summary?.failed_publishing_attempts || 0;
  const pollingInterval = summary?.polling_interval ?? 15;

  const pendingCount = (reviews || []).filter((r) => {
    const st = (r.publishing_status || r.processing_status || '').toLowerCase();
    return st === 'pending' || st === 'verification_pending';
  }).length;

  const dist = summary?.star_rating_distribution || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  const fourFiveStars = (dist[5] || 0) + (dist[4] || 0);
  const csat = total > 0 ? Math.round((fourFiveStars / total) * 100) : 0;

  const posPct = total > 0 ? Math.round((posCount / total) * 100) : 0;
  const negPct = total > 0 ? Math.round((negCount / total) * 100) : 0;
  const attempts = published + failed;
  const successRateDisplay = attempts > 0 ? `${Math.round((published / attempts) * 100)}%` : '—';

  return (
    <div className="space-y-6 page-enter">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-navy-900 tracking-tight">Review &amp; Automation Analytics</h1>
        <p className="text-sm text-slate-500 mt-1">
          Quantitative customer satisfaction, star distribution, and automated response metrics for Techzone Academy.
        </p>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Overall Reviews"
          value={total}
          subtitle="Google Business Profile"
          icon={BarChart3}
          color="blue"
        />
        <StatCard
          title="Positive Ratio (3–5★)"
          value={`${posPct}%`}
          subtitle={`${posCount} of ${total} reviews`}
          icon={TrendingUp}
          color="emerald"
        />
        <StatCard
          title="Customer CSAT (4–5★)"
          value={`${csat}%`}
          subtitle="High satisfaction share"
          icon={Award}
          color="navy"
        />
        <StatCard
          title="Delivery Success Rate"
          value={successRateDisplay}
          subtitle={
            attempts > 0
              ? `${published} published${failed > 0 ? ` · ${failed} failed` : ''}`
              : 'No delivery attempts yet'
          }
          icon={CheckCircle2}
          color="emerald"
        />
      </div>

      {total === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
            <BarChart3 size={22} />
          </div>
          <h2 className="text-base font-bold text-navy-900">No Review Analytics Yet</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Synchronize Google Business Profile reviews or run a test review from Overview to populate rating distributions and response metrics.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Star Rating Breakdown Bar Chart */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-xs font-bold text-navy-900 uppercase tracking-wider">
                  Star Rating Breakdown (1–5★)
                </h2>
                <span className="text-xs font-semibold text-slate-500 tabular-nums">Total: {total}</span>
              </div>
              <p className="text-xs text-slate-500 mb-6">
                Detailed distribution of customer feedback collected from Google.
              </p>

              <div className="space-y-4">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = dist[stars] || 0;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  const isPos = stars >= 3;
                  return (
                    <div key={stars} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <span className="text-navy-900 tabular-nums">{stars} Stars</span>
                          <Star size={13} className="text-amber-400 fill-amber-400" />
                          <span className="text-[11px] text-slate-400 font-normal">
                            ({isPos ? 'Positive Template' : 'Negative Template'})
                          </span>
                        </span>
                        <span className="text-navy-900 tabular-nums">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div
                        className="h-3 bg-slate-100 rounded-full overflow-hidden"
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${stars} star reviews percentage`}
                      >
                        <div
                          className={`h-full rounded-full transition-all duration-700 ease-out ${
                            isPos ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>
                Average Rating:{' '}
                <strong className="text-navy-900 tabular-nums">
                  {summary?.average_star_rating ?? 0.0} / 5.0
                </strong>
              </span>
              <span className="text-slate-400">Deterministic Categorization</span>
            </div>
          </div>

          {/* Category Proportion & Live Operational Cadence */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-sm flex flex-col justify-between">
            <div>
              <h2 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-1.5">
                Category Split &amp; Automation Queue
              </h2>
              <p className="text-xs text-slate-500 mb-6">
                Positive (3–5★) vs. Negative (1–2★) distribution and live pipeline status.
              </p>

              {/* Split Bar */}
              <div className="space-y-2 mb-6">
                <div className="h-9 w-full bg-slate-100 rounded-xl overflow-hidden flex shadow-inner">
                  <div
                    className="bg-emerald-500 h-full flex items-center justify-center text-white text-xs font-bold transition-all duration-700 tabular-nums"
                    style={{ width: `${posPct}%` }}
                    title={`Positive: ${posPct}%`}
                  >
                    {posPct > 15 ? `${posPct}% Positive` : ''}
                  </div>
                  <div
                    className="bg-rose-500 h-full flex items-center justify-center text-white text-xs font-bold transition-all duration-700 tabular-nums"
                    style={{ width: `${negPct}%` }}
                    title={`Negative: ${negPct}%`}
                  >
                    {negPct > 15 ? `${negPct}% Negative` : ''}
                  </div>
                </div>
                <div className="flex justify-between text-xs text-slate-600 px-1">
                  <span className="flex items-center gap-1.5 text-emerald-700 font-semibold tabular-nums">
                    <Smile size={14} />
                    <span>{posCount} Positive (3–5★)</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-rose-700 font-semibold tabular-nums">
                    <Frown size={14} />
                    <span>{negCount} Negative (1–2★)</span>
                  </span>
                </div>
              </div>

              {/* Live Operational Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200">
                  <div className="flex items-center gap-1.5 text-blue-700 text-xs font-bold uppercase mb-1">
                    <Clock size={14} />
                    <span>Polling Cadence</span>
                  </div>
                  <div className="text-xl font-bold text-navy-900 tabular-nums">
                    Every {pollingInterval} min
                  </div>
                  <p className="text-[11px] text-blue-800 mt-1">
                    Background review detection interval
                  </p>
                </div>

                <div
                  className={`p-4 rounded-2xl border ${
                    failed > 0
                      ? 'bg-rose-50/70 border-rose-200'
                      : pendingCount > 0
                      ? 'bg-amber-50/70 border-amber-200'
                      : 'bg-emerald-50/70 border-emerald-200'
                  }`}
                >
                  <div
                    className={`flex items-center gap-1.5 text-xs font-bold uppercase mb-1 ${
                      failed > 0
                        ? 'text-rose-700'
                        : pendingCount > 0
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    {failed > 0 ? <AlertCircle size={14} /> : <Layers size={14} />}
                    <span>Reply Queue</span>
                  </div>
                  <div className="text-xl font-bold text-navy-900 tabular-nums">
                    {pendingCount} Pending
                  </div>
                  <p
                    className={`text-[11px] mt-1 tabular-nums ${
                      failed > 0
                        ? 'text-rose-800'
                        : pendingCount > 0
                        ? 'text-amber-800'
                        : 'text-emerald-800'
                    }`}
                  >
                    {failed > 0
                      ? `${failed} failed attempt${failed === 1 ? '' : 's'} needing review`
                      : `${published} replies verified on Google`}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>
                Customer CSAT (4–5★): <strong className="text-navy-900 tabular-nums">{csat}%</strong>
              </span>
              <span className="text-slate-400">Fixed Template Routing</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
