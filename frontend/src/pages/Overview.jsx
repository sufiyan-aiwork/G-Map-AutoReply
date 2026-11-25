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
  Sparkles,
  Zap,
  Filter
} from 'lucide-react';
import StatCard from '../components/StatCard';
import StarRating from '../components/StarRating';
import StatusBadge from '../components/StatusBadge';

const SAMPLE_PRESETS = [
  { rating: 5, text: "Outstanding Python & Full-Stack Bootcamp! Mentors are true industry experts." },
  { rating: 4, text: "Great curriculum and hands-on projects. Would appreciate more cloud workshops." },
  { rating: 3, text: "Decent course content, but weekend lab slot availability could be expanded." },
  { rating: 2, text: "Encountered two-week administrative delay when requesting my graduation certificate." },
  { rating: 1, text: "Class timings were altered twice with very short notice. Disappointed with coordination." }
];

export default function Overview({ summary, reviews, onNavigate, onSimulateReview }) {
  const [testRating, setTestRating] = useState(5);
  const [testText, setTestText] = useState(SAMPLE_PRESETS[0].text);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simMessage, setSimMessage] = useState(null);
  const [recentFilter, setRecentFilter] = useState('all');

  const handleSimulate = async (e) => {
    e.preventDefault();
    setIsSimulating(true);
    setSimMessage(null);
    try {
      const res = await onSimulateReview({
        star_rating: testRating,
        review_text: testText,
        reviewer_name: `Test Student (${testRating}★)`,
        auto_publish: true,
      });
      setSimMessage({
        type: 'success',
        text: `Review submitted! ${res.publish_result?.category === 'positive' ? 'Positive' : 'Negative'} reply automatically published to Google.`,
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

  const dist = summary?.star_rating_distribution || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  const total = summary?.total_reviews || 1;

  // Effective timestamp prioritizing published replies, then incoming review date
  const getEffectiveTime = (r) => {
    const pubTime = r.reply_published_at ? new Date(r.reply_published_at).getTime() : 0;
    const revTime = r.review_created_at ? new Date(r.review_created_at).getTime() : (r.created_at ? new Date(r.created_at).getTime() : 0);
    return Math.max(pubTime, revTime);
  };

  // Filter and sort recent reviews
  const filteredRecent = (reviews || [])
    .filter((r) => {
      if (recentFilter === 'positive') return r.star_rating >= 3;
      if (recentFilter === 'negative') return r.star_rating <= 2;
      return true;
    })
    .sort((a, b) => getEffectiveTime(b) - getEffectiveTime(a));

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Page Title & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard Overview</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time review monitoring and deterministic reply automation for Techzone Academy.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('reviews')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-xs transition-all"
          >
            <MessageSquare size={14} className="text-blue-600" />
            <span>Manage All Reviews</span>
          </button>
          <button
            onClick={() => onNavigate('templates')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all"
          >
            <span>Edit Templates</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* 6 Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Total Reviews"
          value={summary?.total_reviews ?? 0}
          subtitle="Google Business"
          icon={MessageSquare}
          color="blue"
        />
        <StatCard
          title="Positive (3-5★)"
          value={summary?.positive_reviews_count ?? 0}
          subtitle="Thank you replies"
          icon={ThumbsUp}
          color="emerald"
        />
        <StatCard
          title="Negative (1-2★)"
          value={summary?.negative_reviews_count ?? 0}
          subtitle="Apology replies"
          icon={ThumbsDown}
          color="rose"
        />
        <StatCard
          title="Published Replies"
          value={summary?.total_published_replies ?? 0}
          subtitle="100% Automated"
          icon={CheckCircle}
          color="emerald"
        />
        <StatCard
          title="Failed / Pending"
          value={summary?.failed_publishing_attempts ?? 0}
          subtitle="Issues or paused"
          icon={AlertTriangle}
          color="amber"
        />
        <StatCard
          title="Average Rating"
          value={`${summary?.average_star_rating ?? 0.0} ★`}
          subtitle="Customer Score"
          icon={Star}
          color="indigo"
        />
      </div>

      {/* Grid: Rating Distribution & Interactive Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Star Rating Breakdown with Click-to-Filter Action */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Star Rating Breakdown
              </h2>
              <span className="text-[11px] font-semibold text-slate-400">Total: {summary?.total_reviews ?? 0}</span>
            </div>
            <p className="text-xs text-slate-500 mb-5">
              Click any rating to inspect matching customer reviews.
            </p>

            <div className="space-y-3.5">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = dist[stars] || 0;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                const isPositive = stars >= 3;
                return (
                  <div
                    key={stars}
                    onClick={() => onNavigate('reviews')}
                    className="group cursor-pointer p-1.5 -mx-1.5 rounded-xl hover:bg-slate-50 transition-colors"
                    title={`Click to view ${stars}-star reviews`}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold mb-1">
                      <div className="flex items-center gap-1.5 text-slate-700 group-hover:text-blue-600 transition-colors">
                        <span>{stars} Stars</span>
                        <Star size={13} className="text-amber-400 fill-amber-400" />
                        <span className="text-[10px] text-slate-400 font-normal">
                          ({isPositive ? 'Positive' : 'Negative'})
                        </span>
                      </div>
                      <span className="text-slate-500 font-medium">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isPositive ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
              Positive: 3, 4, 5★
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
              Negative: 1, 2★
            </span>
          </div>
        </div>

        {/* Interactive Live Review Simulator Card */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                  <Zap size={16} />
                </div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Interactive Review Simulator
                </h2>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-md border border-blue-200">
                <Sparkles size={12} />
                <span>Instant Auto-Reply Preview</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Select one-click presets or pick any star rating (1–5) to test how Techzone Academy automatically selects and publishes predefined replies.
            </p>

            {/* Quick 1-Click Presets */}
            <div className="mb-4">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
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
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                      testRating === preset.rating
                        ? 'bg-blue-50 border-blue-400 text-blue-700 font-semibold ring-2 ring-blue-500/10'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {preset.rating}★ {preset.rating >= 3 ? 'Positive' : 'Negative'}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSimulate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Rating: <span className="text-blue-600 font-bold">{testRating} Stars</span> ({testRating >= 3 ? 'Positive Category' : 'Negative Category'})
                </label>
                <div className="flex items-center gap-3">
                  <StarRating
                    rating={testRating}
                    size={24}
                    interactive={true}
                    onRatingChange={(r) => {
                      setTestRating(r);
                      const matchingPreset = SAMPLE_PRESETS.find(p => p.rating === r);
                      if (matchingPreset) setTestText(matchingPreset.text);
                    }}
                  />
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    testRating >= 3 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }`}>
                    {testRating >= 3 ? '→ Matches Positive Template' : '→ Matches Negative Template'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer Review Comment:
                </label>
                <input
                  type="text"
                  required
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  placeholder="Enter student review comment..."
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Dynamic Live Reply Matching Preview */}
              <div className={`p-3.5 rounded-xl border text-xs leading-relaxed transition-all ${
                testRating >= 3 ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900' : 'bg-rose-50/50 border-rose-200 text-rose-900'
              }`}>
                <div className="flex items-center justify-between font-bold text-[11px] uppercase mb-1">
                  <span>Selected Reply Template ({testRating >= 3 ? 'Positive: 3, 4, 5★' : 'Negative: 1, 2★'}):</span>
                  <span>Auto-Dispatch</span>
                </div>
                <p className="italic">
                  {testRating >= 3
                    ? '"Thank you for sharing your valuable feedback with Techzone Academy! We are happy to have you as part of our learning community. We truly appreciate your support!"'
                    : '"We sincerely apologise that your experience did not meet your expectations. Thank you for sharing your feedback with us. We value your suggestions and will continue working to improve our services."'}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSimulating || !testText.trim()}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
                >
                  <Send size={14} />
                  <span>{isSimulating ? 'Processing Review...' : 'Ingest & Publish Reply'}</span>
                </button>

                {simMessage && (
                  <span className={`text-xs font-semibold ${simMessage.type === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {simMessage.text}
                  </span>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Recent Reviews Feed with Quick Filter Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Recent Reviews & Published Responses
            </h2>
            {/* Quick Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs font-semibold text-slate-600">
              <button
                onClick={() => setRecentFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  recentFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setRecentFilter('positive')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  recentFilter === 'positive' ? 'bg-emerald-50 text-emerald-800 shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                Positive (3-5★)
              </button>
              <button
                onClick={() => setRecentFilter('negative')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  recentFilter === 'negative' ? 'bg-rose-50 text-rose-800 shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                Negative (1-2★)
              </button>
            </div>
          </div>

          <button
            onClick={() => onNavigate('reviews')}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 self-start sm:self-auto"
          >
            <span>View All Reviews</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredRecent.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              No recent reviews match the selected filter.
            </div>
          ) : (
            filteredRecent.slice(0, 8).map((rev) => (
              <div key={rev.id} className="p-5 sm:p-6 hover:bg-slate-50/70 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-900 text-sm">{rev.reviewer_name || 'Valued Customer'}</span>
                      <StarRating rating={rev.star_rating} size={15} />
                      <span className="text-xs text-slate-400">
                        {new Date(rev.review_created_at || rev.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 mt-2 italic leading-relaxed">"{rev.review_text}"</p>
                  </div>
                  <StatusBadge status={rev.publishing_status || rev.processing_status} />
                </div>

                {rev.matched_reply && (
                  <div className="mt-3.5 pl-4 border-l-2 border-blue-500 bg-blue-50/40 p-3.5 rounded-r-xl">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-blue-900">Techzone Academy Published Reply:</span>
                      <span className="text-[11px] text-blue-600 font-semibold">
                        ({rev.star_rating >= 3 ? 'Positive Template' : 'Negative Template'})
                      </span>
                    </div>
                    <p className="text-xs text-blue-900 leading-relaxed">{rev.matched_reply}</p>
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
