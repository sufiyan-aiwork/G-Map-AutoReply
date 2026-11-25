import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  CheckCircle2,
  Star,
  Zap,
  Award,
  Sparkles,
  Smile,
  Frown
} from 'lucide-react';
import StatCard from '../components/StatCard';

export default function Analytics({ summary }) {
  const total = summary?.total_reviews || 0;
  const posCount = summary?.positive_reviews_count || 0;
  const negCount = summary?.negative_reviews_count || 0;
  const published = summary?.total_published_replies || 0;
  const failed = summary?.failed_publishing_attempts || 0;

  const dist = summary?.star_rating_distribution || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  const fourFiveStars = (dist[5] || 0) + (dist[4] || 0);
  const csat = total > 0 ? Math.round((fourFiveStars / total) * 100) : 0;

  const posPct = total > 0 ? Math.round((posCount / total) * 100) : 0;
  const negPct = total > 0 ? Math.round((negCount / total) * 100) : 0;
  const successRate = (published + failed) > 0 ? Math.round((published / (published + failed)) * 100) : 100;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Review & Automation Analytics</h1>
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
          title="Positive Ratio (3-5★)"
          value={`${posPct}%`}
          subtitle={`${posCount} of ${total} reviews`}
          icon={TrendingUp}
          color="emerald"
        />
        <StatCard
          title="Customer CSAT (4-5★)"
          value={`${csat}%`}
          subtitle="Satisfaction score"
          icon={Award}
          color="indigo"
        />
        <StatCard
          title="Publishing Success Rate"
          value={`${successRate}%`}
          subtitle={`${published} published to Google`}
          icon={CheckCircle2}
          color="emerald"
        />
      </div>

      {/* Main Charts & Visual Gauges */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Star Rating Breakdown Bar Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Star Rating Breakdown (1-5★)
            </h2>
            <span className="text-xs font-semibold text-slate-400">Total: {total}</span>
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
                      <span>{stars} Stars</span>
                      <Star size={13} className="text-amber-400 fill-amber-400" />
                      <span className="text-[11px] text-slate-400 font-normal">
                        ({isPos ? 'Positive Template' : 'Negative Template'})
                      </span>
                    </span>
                    <span className="text-slate-800">{count} reviews ({pct}%)</span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${
                        isPos ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Average Rating: <strong className="text-slate-900">{summary?.average_star_rating ?? 0.0} / 5.0</strong></span>
            <span>Deterministic Categorization</span>
          </div>
        </div>

        {/* Category Proportion & Operational Efficiency */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Review Category Ratio & Speed
            </h2>
            <p className="text-xs text-slate-500 mb-6">
              Positive (3-5★) vs. Negative (1-2★) deterministic volume.
            </p>

            {/* Split Bar */}
            <div className="space-y-2 mb-6">
              <div className="h-9 w-full bg-slate-100 rounded-xl overflow-hidden flex shadow-inner">
                <div
                  className="bg-emerald-500 h-full flex items-center justify-center text-white text-xs font-bold transition-all duration-700"
                  style={{ width: `${posPct}%` }}
                  title={`Positive: ${posPct}%`}
                >
                  {posPct > 15 ? `${posPct}% Positive` : ''}
                </div>
                <div
                  className="bg-rose-500 h-full flex items-center justify-center text-white text-xs font-bold transition-all duration-700"
                  style={{ width: `${negPct}%` }}
                  title={`Negative: ${negPct}%`}
                >
                  {negPct > 15 ? `${negPct}% Negative` : ''}
                </div>
              </div>
              <div className="flex justify-between text-xs text-slate-500 px-1">
                <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                  <Smile size={14} />
                  <span>{posCount} Positive (3-5★)</span>
                </span>
                <span className="flex items-center gap-1 text-rose-700 font-semibold">
                  <Frown size={14} />
                  <span>{negCount} Negative (1-2★)</span>
                </span>
              </div>
            </div>

            {/* Automation Velocity Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200">
                <div className="flex items-center gap-1.5 text-blue-700 text-xs font-bold uppercase mb-1">
                  <Zap size={14} />
                  <span>Response Speed</span>
                </div>
                <div className="text-xl font-bold text-blue-950">Under 1 min</div>
                <p className="text-[11px] text-blue-800 mt-1">Automatic background replies</p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200">
                <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-bold uppercase mb-1">
                  <Sparkles size={14} />
                  <span>Accuracy</span>
                </div>
                <div className="text-xl font-bold text-emerald-950">100%</div>
                <p className="text-[11px] text-emerald-800 mt-1">Zero LLM hallucinations</p>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Customer CSAT: <strong className="text-slate-900">{csat}%</strong></span>
            <span>Google Business Profile</span>
          </div>
        </div>
      </div>
    </div>
  );
}
