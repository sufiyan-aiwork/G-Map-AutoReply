import React, { useState } from 'react';
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
  const [hoveredTier, setHoveredTier] = useState(null);

  if (isLoading && !summary) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-72 rounded-xl skeleton-shimmer" />
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
  const negPct = total > 0 ? Math.max(0, 100 - posPct) : 0;
  const attempts = published + failed;
  const successRateDisplay = attempts > 0 ? `${Math.round((published / attempts) * 100)}%` : '—';

  // SVG Donut Geometry (r=52 -> C ~= 326.726)
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const posArc = total > 0 ? (posCount / total) * circumference : 0;
  const negArc = total > 0 ? (negCount / total) * circumference : 0;

  return (
    <div className="space-y-6 page-enter">
      {/* Title */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-[#1a1a2e] tracking-tight">
          Review &amp; Automation Analytics
        </h1>
        <p className="text-sm text-[#64748b] mt-1">
          Quantitative customer satisfaction, star distribution, and automated response metrics for TechZone Academy.
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
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-10 text-center shadow-tz-card">
          <div className="w-12 h-12 rounded-2xl bg-[#e8f1f8] text-[#025091] flex items-center justify-center mx-auto mb-3 border border-[#b9d7ef]">
            <BarChart3 size={22} />
          </div>
          <h2 className="font-heading text-base font-bold text-[#1a1a2e]">No Review Analytics Yet</h2>
          <p className="text-sm text-[#64748b] mt-1 max-w-md mx-auto">
            Synchronize Google Business Profile reviews or run a test review from Overview to populate rating distributions and response metrics.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Interactive SVG Rating Distribution Chart */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-tz-card overflow-hidden flex flex-col justify-between">
            <div>
              <div className="h-1 w-full tz-top-accent" />
              <div className="p-6 sm:p-7">
                <div className="flex items-center justify-between mb-1.5">
                  <h2 className="font-heading text-xs font-bold text-[#1a1a2e] uppercase tracking-wider">
                    Star Rating Distribution (1–5★)
                  </h2>
                  <span className="text-xs font-semibold text-[#64748b] tabular-nums">
                    Total: {total}
                  </span>
                </div>
                <p className="text-xs text-[#64748b] mb-6">
                  Hover any rating tier to inspect exact customer volume and template assignment.
                </p>

                <div className="space-y-4">
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const count = dist[stars] || 0;
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    const isPos = stars >= 3;
                    const isHovered = hoveredTier === stars;
                    return (
                      <div
                        key={stars}
                        onMouseEnter={() => setHoveredTier(stars)}
                        onMouseLeave={() => setHoveredTier(null)}
                        className={`p-2 -mx-2 rounded-xl transition-colors duration-150 ${
                          isHovered ? 'bg-[#eff6fb]/75' : ''
                        }`}
                      >
                        <div className="flex justify-between text-xs font-bold mb-1.5">
                          <span className="flex items-center gap-1.5">
                            <span className="text-[#1a1a2e] tabular-nums">{stars} Stars</span>
                            <Star size={13} className="text-amber-400 fill-amber-400" />
                            <span className="text-[11px] text-[#64748b] font-normal">
                              ({isPos ? 'Positive Template' : 'Negative Template'})
                            </span>
                          </span>
                          <span className="text-[#1a1a2e] tabular-nums">
                            {count} <span className="text-[#64748b] font-medium">({pct}%)</span>
                          </span>
                        </div>
                        <svg
                          className="w-full h-3 block overflow-hidden rounded-full"
                          role="progressbar"
                          aria-valuenow={pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${stars} star reviews share`}
                        >
                          <defs>
                            <linearGradient id={`tz-bar-grad-${stars}`} x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor={isPos ? '#025091' : '#e11d48'} />
                              <stop offset="100%" stopColor={isPos ? '#00a8cc' : '#fb7185'} />
                            </linearGradient>
                          </defs>
                          <rect width="100%" height="12" rx="6" fill="#f1f5f9" />
                          <rect
                            width={`${pct}%`}
                            height="12"
                            rx="6"
                            fill={`url(#tz-bar-grad-${stars})`}
                            className="transition-all duration-500 ease-out"
                          />
                        </svg>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-[#f8fafc] border-t border-[#e2e8f0] flex items-center justify-between text-xs text-[#64748b]">
              <span>
                Average Rating:{' '}
                <strong className="font-heading text-[#1a1a2e] tabular-nums">
                  {summary?.average_star_rating ?? 0.0} / 5.0
                </strong>
              </span>
              <span>Deterministic Categorization</span>
            </div>
          </div>

          {/* Brand Donut Visualization & Live Automation Queue */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-tz-card overflow-hidden flex flex-col justify-between">
            <div>
              <div className="h-1 w-full tz-top-accent" />
              <div className="p-6 sm:p-7">
                <h2 className="font-heading text-xs font-bold text-[#1a1a2e] uppercase tracking-wider mb-1.5">
                  Category Split &amp; Automation Queue
                </h2>
                <p className="text-xs text-[#64748b] mb-6">
                  Positive (3–5★) vs. Negative (1–2★) share and live pipeline cadence.
                </p>

                {/* SVG Donut Chart + Legend */}
                <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-2xl bg-[#f8fafc] border border-[#e2e8f0] mb-6">
                  <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
                    <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90" aria-label="Review Sentiment Donut Chart">
                      <circle
                        cx="64"
                        cy="64"
                        r={radius}
                        fill="transparent"
                        stroke="#e2e8f0"
                        strokeWidth="14"
                      />
                      {posCount > 0 && (
                        <circle
                          cx="64"
                          cy="64"
                          r={radius}
                          fill="transparent"
                          stroke="#025091"
                          strokeWidth="14"
                          strokeDasharray={`${posArc} ${circumference}`}
                          strokeLinecap="butt"
                        />
                      )}
                      {negCount > 0 && (
                        <circle
                          cx="64"
                          cy="64"
                          r={radius}
                          fill="transparent"
                          stroke="#e11d48"
                          strokeWidth="14"
                          strokeDasharray={`${negArc} ${circumference}`}
                          strokeDashoffset={-posArc}
                          strokeLinecap="butt"
                        />
                      )}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="font-heading text-xl font-bold text-[#1a1a2e] tabular-nums leading-none">
                        {posPct}%
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b] mt-1">
                        Positive
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 w-full space-y-3 text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#e2e8f0]">
                      <span className="flex items-center gap-2 font-semibold text-[#1a1a2e]">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#025091]" />
                        <Smile size={14} className="text-[#025091]" />
                        <span>Positive (3–5★)</span>
                      </span>
                      <span className="font-bold text-[#1a1a2e] tabular-nums">
                        {posCount} ({posPct}%)
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#e2e8f0]">
                      <span className="flex items-center gap-2 font-semibold text-[#1a1a2e]">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                        <Frown size={14} className="text-rose-600" />
                        <span>Negative (1–2★)</span>
                      </span>
                      <span className="font-bold text-[#1a1a2e] tabular-nums">
                        {negCount} ({negPct}%)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Live Operational Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-[#eff6fb] border border-[#b9d7ef]">
                    <div className="flex items-center gap-1.5 text-[#025091] text-xs font-bold uppercase mb-1">
                      <Clock size={14} />
                      <span>Polling Cadence</span>
                    </div>
                    <div className="font-heading text-xl font-bold text-[#001f3f] tabular-nums">
                      Every {pollingInterval} min
                    </div>
                    <p className="text-[11px] text-[#023e73] mt-1">
                      Background review detection interval
                    </p>
                  </div>

                  <div
                    className={`p-4 rounded-2xl border ${
                      failed > 0
                        ? 'bg-rose-50/75 border-rose-200'
                        : pendingCount > 0
                        ? 'bg-amber-50/75 border-amber-200'
                        : 'bg-emerald-50/75 border-emerald-200'
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
                    <div className="font-heading text-xl font-bold text-[#1a1a2e] tabular-nums">
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
            </div>

            <div className="px-6 py-4 bg-[#f8fafc] border-t border-[#e2e8f0] flex items-center justify-between text-xs text-[#64748b]">
              <span>
                Customer CSAT (4–5★):{' '}
                <strong className="font-heading text-[#1a1a2e] tabular-nums">{csat}%</strong>
              </span>
              <span>Fixed Template Routing</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
