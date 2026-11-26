import React, { useState } from 'react';
import {
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  CheckCircle,
  AlertTriangle,
  Star,
  Send,
  ArrowRight,
  Zap,
  Sparkles,
  Loader2
} from 'lucide-react';
import StatCard from '../components/StatCard';
import StarRating from '../components/StarRating';
import StatusBadge from '../components/StatusBadge';
import { KpiGridSkeleton, CardSkeleton } from '../components/SkeletonLoader';

const DEFAULT_POSITIVE =
  'Thank you for sharing your valuable feedback with Techzone Academy! We are happy to have you as part of our learning community. We truly appreciate your support!';
const DEFAULT_NEGATIVE =
  'We sincerely apologise that your experience did not meet your expectations. Thank you for sharing your feedback with us. We value your suggestions and will continue working to improve our services.';

const SAMPLE_PRESETS = [
  { rating: 5, text: 'The Python and Full-Stack Web Dev training here helped me land my first IT role! Great mentors.' },
  { rating: 4, text: 'Very structured courses and hands-on lab assignments. Loved the practical exercises.' },
  { rating: 3, text: 'Course materials are solid, though afternoon batch timings could be more flexible.' },
  { rating: 2, text: 'Had some delays getting lab server access during project week.' },
  { rating: 1, text: 'Class schedule was changed without early communication. Disappointed.' },
];

export default function Overview({ summary, reviews, templates, isLoading, onNavigate, onSimulateReview }) {
  const [testRating, setTestRating] = useState(5);
  const [testText, setTestText] = useState(SAMPLE_PRESETS[0].text);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simMessage, setSimMessage] = useState(null);
  const [recentFilter, setRecentFilter] = useState('all');

  const posTemplateObj = templates?.find((t) => t.category === 'positive');
  const negTemplateObj = templates?.find((t) => t.category === 'negative');
  const positiveText = posTemplateObj?.reply_text || DEFAULT_POSITIVE;
  const negativeText = negTemplateObj?.reply_text || DEFAULT_NEGATIVE;
  const isSelectedTemplateActive =
    testRating >= 3 ? (posTemplateObj?.is_active ?? true) : (negTemplateObj?.is_active ?? true);

  const handleSimulate = async (e) => {
    e.preventDefault();
    setIsSimulating(true);
    setSimMessage(null);
    try {
      const res = await onSimulateReview({
        star_rating: testRating,
        review_text: testText.trim() || undefined,
        reviewer_name: `Test Student (${testRating}★)`,
        auto_publish: true,
      });
      const categoryKey = res.publish_result?.category === 'negative' ? 'negative' : 'positive';
      const catLabel = categoryKey === 'positive' ? 'Positive' : 'Negative';
      const pubSuccess = res.publish_result?.success;
      setSimMessage({
        type: pubSuccess ? 'success' : 'warning',
        category: categoryKey,
        text: pubSuccess
          ? `Simulated review ingested! ${catLabel} reply selected and processed.`
          : `Simulated review stored as pending (${res.publish_result?.message || 'automation paused'}).`,
      });
    } catch (err) {
      setSimMessage({
        type: 'error',
        text: err.message || 'Failed to simulate review',
      });
    } finally {
      setIsSimulating(false);
    }
  };

  if (isLoading && !summary) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-72 rounded-xl skeleton-shimmer" />
        <KpiGridSkeleton count={6} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <CardSkeleton height="h-80" />
          <div className="lg:col-span-2">
            <CardSkeleton height="h-80" />
          </div>
        </div>
        <CardSkeleton height="h-64" />
      </div>
    );
  }

  const dist = summary?.star_rating_distribution || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  const total = summary?.total_reviews || 0;
  const posCount = summary?.positive_reviews_count || 0;
  const posShare = total > 0 ? Math.round((posCount / total) * 100) : 0;

  const pendingCount = (reviews || []).filter((r) => {
    const st = (r.publishing_status || r.processing_status || '').toLowerCase();
    return st === 'pending' || st === 'verification_pending';
  }).length;

  const getEffectiveTime = (r) => {
    const pubTime = r.reply_published_at ? new Date(r.reply_published_at).getTime() : 0;
    const revTime = r.review_created_at
      ? new Date(r.review_created_at).getTime()
      : r.created_at
      ? new Date(r.created_at).getTime()
      : 0;
    return Math.max(pubTime, revTime);
  };

  const filteredRecent = (reviews || [])
    .filter((r) => {
      if (recentFilter === 'positive') return r.star_rating >= 3;
      if (recentFilter === 'negative') return r.star_rating <= 2;
      return true;
    })
    .sort((a, b) => getEffectiveTime(b) - getEffectiveTime(a));

  return (
    <div className="space-y-7 page-enter">
      {/* Page Title & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#1a1a2e] tracking-tight">
            Dashboard Overview
          </h1>
          <p className="text-sm text-[#64748b] mt-1">
            Real-time review monitoring and deterministic reply automation for TechZone Academy.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('reviews', { category: 'all', rating: 'all', status: 'all' })}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#e2e8f0] hover:border-[#b9d7ef] rounded-xl text-xs font-semibold text-[#1a1a2e] hover:bg-[#e8f1f8] shadow-tz-card transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40"
          >
            <MessageSquare size={14} className="text-[#025091]" />
            <span>Manage All Reviews</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('templates')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#025091] hover:bg-[#023e73] text-white rounded-xl text-xs font-semibold shadow-sm transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40"
          >
            <span>Edit Templates</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* 6 Metric KPI Cards (1-click filtered drilldown) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4 items-stretch">
        <StatCard
          title="Total Reviews"
          value={summary?.total_reviews ?? 0}
          subtitle="Google Business"
          icon={MessageSquare}
          color="blue"
          onClick={() => onNavigate('reviews', { category: 'all', rating: 'all', status: 'all' })}
        />
        <StatCard
          title="Positive (3–5★)"
          value={posCount}
          subtitle="Positive template"
          icon={ThumbsUp}
          color="emerald"
          onClick={() => onNavigate('reviews', { category: 'positive', rating: 'all', status: 'all' })}
        />
        <StatCard
          title="Negative (1–2★)"
          value={summary?.negative_reviews_count ?? 0}
          subtitle="Apology template"
          icon={ThumbsDown}
          color="rose"
          onClick={() => onNavigate('reviews', { category: 'negative', rating: 'all', status: 'all' })}
        />
        <StatCard
          title="Published Replies"
          value={summary?.total_published_replies ?? 0}
          subtitle="Verified on Google"
          icon={CheckCircle}
          color="emerald"
          onClick={() => onNavigate('reviews', { category: 'all', rating: 'all', status: 'published' })}
        />
        <StatCard
          title="Failed Replies"
          value={summary?.failed_publishing_attempts ?? 0}
          subtitle={pendingCount > 0 ? `${pendingCount} pending in queue` : 'No delivery errors'}
          icon={AlertTriangle}
          color="amber"
          onClick={() =>
            onNavigate('reviews', {
              category: 'all',
              rating: 'all',
              status: (summary?.failed_publishing_attempts ?? 0) > 0 ? 'failed' : 'pending',
            })
          }
        />
        <StatCard
          title="Average Rating"
          value={`${summary?.average_star_rating ?? 0.0} ★`}
          subtitle={`${posShare}% positive mix`}
          icon={Star}
          color="navy"
          onClick={() => onNavigate('reviews', { category: 'all', rating: 'all', status: 'all' })}
        />
      </div>

      {/* Grid: Rating Distribution & Interactive Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Star Rating Breakdown with Click-to-Filter Action */}
        <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-tz-card overflow-hidden flex flex-col justify-between">
          <div>
            <div className="h-1 w-full tz-top-accent" />
            <div className="p-6">
              <div className="flex items-center justify-between mb-1.5">
                <h2 className="font-heading text-xs font-bold text-[#1a1a2e] uppercase tracking-wider">
                  Star Rating Breakdown
                </h2>
                <span className="text-[11px] font-semibold text-[#64748b] tabular-nums">
                  Total: {total}
                </span>
              </div>
              <p className="text-xs text-[#64748b] mb-5">
                Select any star tier to drill directly into matching customer reviews.
              </p>

              <div className="space-y-2.5">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = dist[stars] || 0;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  const isPositive = stars >= 3;
                  return (
                    <button
                      type="button"
                      key={stars}
                      onClick={() =>
                        onNavigate('reviews', { rating: String(stars), category: 'all', status: 'all' })
                      }
                      className="w-full text-left group cursor-pointer p-2 -mx-2 rounded-xl hover:bg-[#eff6fb] transition-all duration-150 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40"
                      title={`Filter reviews by ${stars} stars`}
                    >
                      <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                        <div className="flex items-center gap-1.5 text-[#1a1a2e] group-hover:text-[#025091] transition-colors">
                          <span className="tabular-nums">{stars} Star{stars > 1 ? 's' : ''}</span>
                          <Star size={13} className="text-amber-400 fill-amber-400" />
                          <span className="text-[10px] text-[#64748b] font-normal">
                            ({isPositive ? 'Positive' : 'Negative'})
                          </span>
                        </div>
                        <span className="text-[#1a1a2e] font-semibold tabular-nums">
                          {count} <span className="text-[#64748b] font-normal">({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-2.5 bg-[#f1f5f9] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ease-out ${
                            isPositive
                              ? 'bg-gradient-to-r from-[#025091] to-[#00a8cc]'
                              : 'bg-gradient-to-r from-rose-500 to-rose-400'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="px-6 py-3.5 bg-[#f8fafc] border-t border-[#e2e8f0] flex items-center justify-between text-xs text-[#64748b]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#025091] inline-block" />
              Positive: 3–5★
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
              Negative: 1–2★
            </span>
          </div>
        </div>

        {/* Interactive Local Review Simulator Card */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#e2e8f0] shadow-tz-card overflow-hidden flex flex-col justify-between">
          <div className="h-1 w-full tz-top-accent" />
          <div className="p-6 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#e8f1f8] text-[#025091] border border-[#b9d7ef]">
                    <Zap size={16} />
                  </div>
                  <h2 className="font-heading text-sm font-bold text-[#1a1a2e] uppercase tracking-wider">
                    Interactive Review Simulator
                  </h2>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] bg-[#e8f1f8] text-[#025091] font-semibold px-2.5 py-1 rounded-lg border border-[#b9d7ef] self-start sm:self-auto">
                  <Sparkles size={12} />
                  <span>Sandbox Test (Never Hits Live Google)</span>
                </span>
              </div>
              <p className="text-xs text-[#64748b] mb-4">
                Choose a preset or star rating (1–5★) to verify template routing safely in local storage without touching Google.
              </p>

              {/* Quick Presets */}
              <div className="mb-4">
                <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider block mb-2">
                  Quick Test Presets:
                </span>
                <div className="flex flex-wrap gap-2">
                  {SAMPLE_PRESETS.map((preset) => (
                    <button
                      key={preset.rating}
                      type="button"
                      onClick={() => {
                        setTestRating(preset.rating);
                        setTestText(preset.text);
                        setSimMessage(null);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40 ${
                        testRating === preset.rating && testText === preset.text
                          ? 'bg-[#e8f1f8] border-[#025091] text-[#025091] font-semibold'
                          : 'bg-[#f8fafc] border-[#e2e8f0] text-[#64748b] hover:text-[#1a1a2e] hover:bg-slate-100'
                      }`}
                    >
                      {preset.rating}★ {preset.rating >= 3 ? 'Positive' : 'Negative'}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSimulate} className="space-y-4">
                <div>
                  <span className="block text-xs font-semibold text-[#1a1a2e] mb-1.5">
                    Select Rating:{' '}
                    <span className="text-[#025091] font-bold tabular-nums">
                      {testRating} Star{testRating > 1 ? 's' : ''}
                    </span>{' '}
                    ({testRating >= 3 ? 'Positive Category' : 'Negative Category'})
                  </span>
                  <div className="flex flex-wrap items-center gap-3">
                    <StarRating
                      rating={testRating}
                      size={24}
                      interactive={true}
                      onRatingChange={(r) => {
                        setTestRating(r);
                        const matchingPreset = SAMPLE_PRESETS.find((p) => p.rating === r);
                        if (matchingPreset) setTestText(matchingPreset.text);
                        setSimMessage(null);
                      }}
                    />
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-md border ${
                        testRating >= 3
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {testRating >= 3 ? 'Matches Positive Template' : 'Matches Negative Template'}
                    </span>
                  </div>
                </div>

                <div>
                  <label htmlFor="sim-review-comment" className="block text-xs font-semibold text-[#1a1a2e] mb-1">
                    Simulated Customer Comment <span className="text-[#64748b] font-normal">(optional for star-only)</span>
                  </label>
                  <input
                    id="sim-review-comment"
                    type="text"
                    value={testText}
                    onChange={(e) => {
                      setTestText(e.target.value);
                      if (simMessage) setSimMessage(null);
                    }}
                    placeholder="Enter simulated student review comment or leave empty for star-only..."
                    className="w-full px-3.5 py-2 text-sm bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-[#1a1a2e] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#025091]/30 focus:border-[#025091] focus:bg-white transition-all duration-150"
                  />
                </div>

                {/* Live Template Preview */}
                <div
                  className={`p-3.5 rounded-xl border text-xs leading-relaxed transition-colors duration-150 ${
                    !isSelectedTemplateActive
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : testRating >= 3
                      ? 'bg-[#eff6fb] border-[#b9d7ef] text-[#001f3f]'
                      : 'bg-rose-50/70 border-rose-200 text-rose-950'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-[11px] uppercase mb-1">
                    <span>
                      Active Reply Template ({testRating >= 3 ? 'Positive: 3, 4, 5★' : 'Negative: 1, 2★'}):
                    </span>
                    <span>{isSelectedTemplateActive ? 'Active in DB' : 'Disabled in DB'}</span>
                  </div>
                  <p className="italic">
                    &ldquo;{testRating >= 3 ? positiveText : negativeText}&rdquo;
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={isSimulating}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#025091] hover:bg-[#023e73] text-white rounded-xl text-xs font-bold shadow-sm transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40 focus-visible:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSimulating ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    <span>{isSimulating ? 'Simulating...' : 'Run Local Simulation'}</span>
                  </button>

                  {simMessage && (
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold page-enter">
                      <span
                        className={
                          simMessage.type === 'success'
                            ? 'text-emerald-700'
                            : simMessage.type === 'warning'
                            ? 'text-amber-700'
                            : 'text-rose-700'
                        }
                      >
                        {simMessage.text}
                      </span>
                      {simMessage.type !== 'error' && (
                        <button
                          type="button"
                          onClick={() =>
                            onNavigate('reviews', {
                              category: simMessage.category || 'all',
                              rating: 'all',
                              status: 'all',
                            })
                          }
                          className="inline-flex items-center gap-1 text-[#025091] hover:text-[#013460] underline font-bold"
                        >
                          <span>View in Reviews</span>
                          <ArrowRight size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Reviews Feed */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-tz-card overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e2e8f0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <h2 className="font-heading text-xs font-bold text-[#1a1a2e] uppercase tracking-wider">
              Recent Reviews &amp; Published Responses
            </h2>
            <div
              className="flex items-center gap-1 bg-[#f1f5f9] p-1 rounded-xl text-xs font-semibold text-[#64748b]"
              role="tablist"
            >
              {[
                { key: 'all', label: 'All', activeClass: 'bg-white text-[#1a1a2e] shadow-sm' },
                { key: 'positive', label: 'Positive (3–5★)', activeClass: 'bg-emerald-50 text-emerald-800 shadow-sm' },
                { key: 'negative', label: 'Negative (1–2★)', activeClass: 'bg-rose-50 text-rose-800 shadow-sm' },
              ].map((tab) => (
                <button
                  type="button"
                  key={tab.key}
                  role="tab"
                  aria-selected={recentFilter === tab.key}
                  onClick={() => setRecentFilter(tab.key)}
                  className={`px-2.5 py-1 rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40 ${
                    recentFilter === tab.key ? tab.activeClass : 'hover:text-[#1a1a2e]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              onNavigate('reviews', {
                category: recentFilter === 'all' ? 'all' : recentFilter,
                rating: 'all',
                status: 'all',
              })
            }
            className="text-xs font-bold text-[#025091] hover:text-[#013460] inline-flex items-center gap-1 self-start sm:self-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40 rounded-lg px-1.5 py-0.5"
          >
            <span>View All Reviews</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredRecent.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="text-[#64748b] text-sm font-medium">
                No recent reviews match the selected filter.
              </p>
              {recentFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setRecentFilter('all')}
                  className="text-xs font-semibold text-[#025091] hover:text-[#013460] underline"
                >
                  Show all reviews
                </button>
              )}
            </div>
          ) : (
            filteredRecent.slice(0, 8).map((rev) => (
              <div key={rev.id} className="p-5 sm:p-6 hover:bg-[#eff6fb]/50 transition-colors duration-150">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-bold text-[#1a1a2e] text-sm">
                        {rev.reviewer_name || 'Valued Customer'}
                      </span>
                      <StarRating rating={rev.star_rating} size={15} />
                      <span className="text-xs text-[#64748b] tabular-nums">
                        {new Date(rev.reply_published_at || rev.review_created_at || rev.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {rev.review_text && rev.review_text.trim() ? (
                      <p className="text-sm text-[#1a1a2e]/85 mt-2 italic leading-relaxed">
                        &ldquo;{rev.review_text}&rdquo;
                      </p>
                    ) : (
                      <p className="text-xs text-[#64748b] mt-2 italic">
                        No written comment — star rating only
                      </p>
                    )}
                  </div>
                  <StatusBadge status={rev.publishing_status || rev.processing_status} />
                </div>

                {rev.matched_reply && (
                  <div className="mt-3.5 pl-4 border-l-2 border-[#025091] bg-[#eff6fb]/75 p-3.5 rounded-r-xl">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-[#001f3f]">
                        TechZone Academy Published Reply:
                      </span>
                      <span className="text-[11px] text-[#025091] font-semibold">
                        ({rev.star_rating >= 3 ? 'Positive Template' : 'Negative Template'})
                      </span>
                    </div>
                    <p className="text-xs text-[#1a1a2e] leading-relaxed">{rev.matched_reply}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
