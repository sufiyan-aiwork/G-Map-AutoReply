import React, { useState } from 'react';
import {
  Search,
  Filter,
  MessageSquare,
  X,
  Copy,
  Check,
  Calendar,
  User,
  Star,
  RotateCcw,
  Send,
  Eye,
  AlertCircle,
  CheckCircle,
  ShieldCheck,
  Loader2
} from 'lucide-react';
import StarRating from '../components/StarRating';
import StatusBadge from '../components/StatusBadge';
import { api } from '../services/api';

const DEFAULT_POSITIVE = "Thank you for sharing your valuable feedback with Techzone Academy! We are happy to have you as part of our learning community. We truly appreciate your support!";
const DEFAULT_NEGATIVE = "We sincerely apologise that your experience did not meet your expectations. Thank you for sharing your feedback with us. We value your suggestions and will continue working to improve our services.";

export default function Reviews({ reviews, templates, onRefresh }) {
  const [ratingFilter, setRatingFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReview, setSelectedReview] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Controlled test publish state
  const [isPublishingSingle, setIsPublishingSingle] = useState(false);
  const [showConfirmPublish, setShowConfirmPublish] = useState(false);
  const [publishSuccessMsg, setPublishSuccessMsg] = useState(null);
  const [publishErrorMsg, setPublishErrorMsg] = useState(null);

  const positiveTemplate = templates?.find(t => t.category === 'positive')?.reply_text || DEFAULT_POSITIVE;
  const negativeTemplate = templates?.find(t => t.category === 'negative')?.reply_text || DEFAULT_NEGATIVE;

  const handleCopyReply = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleResetFilters = () => {
    setRatingFilter('all');
    setStatusFilter('all');
    setCategoryFilter('all');
    setSearchQuery('');
  };

  const handleExecuteSinglePublish = async () => {
    if (!selectedReview) return;
    setIsPublishingSingle(true);
    setPublishErrorMsg(null);
    setPublishSuccessMsg(null);

    try {
      const res = await api.publishReviewReply(selectedReview.id);
      if (res.success) {
        setPublishSuccessMsg(res.message || 'Predefined reply successfully published to Google!');
        setShowConfirmPublish(false);
        const replyText = res.result?.reply_text || (selectedReview.star_rating >= 3 ? positiveTemplate : negativeTemplate);
        
        // Update local review state
        const finalStatus = res.result?.publishing_status || 'published';
        setSelectedReview(prev => prev ? {
          ...prev,
          publishing_status: finalStatus,
          processing_status: finalStatus === 'published' ? 'processed' : 'pending',
          matched_reply: replyText,
          reply_published_at: new Date().toISOString()
        } : null);

        if (onRefresh) {
          await onRefresh();
        }
      } else {
        setPublishErrorMsg(res.message || res.result?.error || 'Failed to publish reply.');
      }
    } catch (err) {
      setPublishErrorMsg(err.message || 'Error publishing reply to Google API.');
    } finally {
      setIsPublishingSingle(false);
    }
  };

  const isFiltered = ratingFilter !== 'all' || statusFilter !== 'all' || categoryFilter !== 'all' || searchQuery.trim() !== '';

  const getEffectiveTime = (r) => {
    const pubTime = r.reply_published_at ? new Date(r.reply_published_at).getTime() : 0;
    const revTime = r.review_created_at ? new Date(r.review_created_at).getTime() : (r.created_at ? new Date(r.created_at).getTime() : 0);
    return Math.max(pubTime, revTime);
  };

  const filteredReviews = (reviews || []).filter((r) => {
    // Rating filter
    if (ratingFilter !== 'all' && r.star_rating !== parseInt(ratingFilter, 10)) {
      return false;
    }
    // Category filter
    if (categoryFilter === 'positive' && r.star_rating < 3) return false;
    if (categoryFilter === 'negative' && r.star_rating > 2) return false;

    // Status filter
    if (statusFilter !== 'all') {
      const st = (r.publishing_status || r.processing_status || '').toLowerCase();
      if (st !== statusFilter) return false;
    }
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const textMatch = (r.review_text || '').toLowerCase().includes(q);
      const nameMatch = (r.reviewer_name || '').toLowerCase().includes(q);
      const idMatch = (r.google_review_id || '').toLowerCase().includes(q);
      if (!textMatch && !nameMatch && !idMatch) return false;
    }
    return true;
  }).sort((a, b) => getEffectiveTime(b) - getEffectiveTime(a));

  const totalCount = (reviews || []).length;
  const posCount = (reviews || []).filter(r => r.star_rating >= 3).length;
  const negCount = (reviews || []).filter(r => r.star_rating < 3).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Customer Reviews</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time feed of Techzone Academy Google reviews, star classifications, and published replies.
          </p>
        </div>

        {isFiltered && (
          <button
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 self-start sm:self-auto transition-colors"
          >
            <RotateCcw size={13} />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      {/* Quick Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => { setCategoryFilter('all'); setRatingFilter('all'); }}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
            categoryFilter === 'all' && ratingFilter === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <span>All Reviews</span>
          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-800">
            {totalCount}
          </span>
        </button>

        <button
          onClick={() => { setCategoryFilter('positive'); setRatingFilter('all'); }}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
            categoryFilter === 'positive'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <span>Positive (3-5★)</span>
          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
            {posCount}
          </span>
        </button>

        <button
          onClick={() => { setCategoryFilter('negative'); setRatingFilter('all'); }}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
            categoryFilter === 'negative'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <span>Negative (1-2★)</span>
          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800">
            {negCount}
          </span>
        </button>
      </div>

      {/* Search and Dropdown Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by student name, review text, or Google review ID..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Specific Star Dropdown */}
          <select
            value={ratingFilter}
            onChange={(e) => {
              setRatingFilter(e.target.value);
              setCategoryFilter('all');
            }}
            className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Stars</option>
            <option value="5">5 Stars</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars</option>
            <option value="2">2 Stars</option>
            <option value="1">1 Star</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="published">Published</option>
            <option value="pending">Pending</option>
            <option value="paused">Paused</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Reviews Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3.5 px-4">Student / Reviewer</th>
                <th className="py-3.5 px-4">Rating</th>
                <th className="py-3.5 px-4">Customer Review</th>
                <th className="py-3.5 px-4">Selected Predefined Reply</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReviews.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No customer reviews match your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredReviews.map((rev) => (
                  <tr
                    key={rev.id}
                    onClick={() => setSelectedReview(rev)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      <div className="group-hover:text-blue-600 transition-colors">{rev.reviewer_name || 'Valued Student'}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">{rev.google_review_id}</div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StarRating rating={rev.star_rating} size={15} />
                    </td>
                    <td className="py-3.5 px-4 max-w-xs truncate text-slate-600">
                      {rev.review_text || <span className="text-slate-300 italic">No comment provided</span>}
                    </td>
                    <td className="py-3.5 px-4 max-w-sm">
                      {rev.matched_reply ? (
                        <div className="text-xs text-slate-700 truncate bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <span className={`font-bold mr-1 ${rev.star_rating >= 3 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            [{rev.star_rating >= 3 ? 'Positive Template' : 'Negative Template'}]:
                          </span>
                          {rev.matched_reply}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 truncate bg-amber-50/50 p-2 rounded-lg border border-amber-200/60">
                          <span className={`font-bold mr-1 ${rev.star_rating >= 3 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            [Pending {rev.star_rating >= 3 ? 'Positive' : 'Negative'}]:
                          </span>
                          <span className="italic">{rev.star_rating >= 3 ? positiveTemplate : negativeTemplate}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusBadge status={rev.publishing_status || rev.processing_status} />
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-500">
                      {new Date(rev.review_created_at || rev.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedReview(rev);
                          setShowConfirmPublish(false);
                          setPublishSuccessMsg(null);
                          setPublishErrorMsg(null);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                      >
                        <Eye size={13} />
                        <span>{rev.matched_reply ? 'View Details' : 'Preview & Reply'}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Detail Modal */}
      {selectedReview && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Review & Predefined Reply</h3>
                  <p className="text-xs text-slate-400">Google Business Profile Review Management</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedReview(null);
                  setShowConfirmPublish(false);
                  setPublishSuccessMsg(null);
                  setPublishErrorMsg(null);
                }}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">Student Name</span>
                  <p className="font-bold text-slate-900 mt-0.5">{selectedReview.reviewer_name || 'Valued Customer'}</p>
                </div>
                <StatusBadge status={selectedReview.publishing_status || selectedReview.processing_status} />
              </div>

              <div>
                <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">Star Rating Classification</span>
                <div className="flex items-center gap-2 mt-1">
                  <StarRating rating={selectedReview.star_rating} size={20} />
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    selectedReview.star_rating >= 3 ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
                  }`}>
                    {selectedReview.star_rating} Stars ({selectedReview.star_rating >= 3 ? 'Positive Template: 3-5★' : 'Negative Template: 1-2★'})
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">Original Review on Google</span>
                <p className="mt-1 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 text-sm leading-relaxed">
                  "{selectedReview.review_text || 'No comment provided'}"
                </p>
              </div>

              {/* If already published */}
              {selectedReview.matched_reply ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-emerald-700 uppercase font-bold tracking-wider flex items-center gap-1">
                      <CheckCircle size={13} /> Published Predefined Reply
                    </span>
                    <button
                      onClick={() => handleCopyReply(selectedReview.matched_reply, selectedReview.id)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                    >
                      {copiedId === selectedReview.id ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      <span>{copiedId === selectedReview.id ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200 text-emerald-950 text-sm leading-relaxed">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-xs text-emerald-800">
                        Live on Google Business Profile:
                      </span>
                      {selectedReview.reply_published_at && (
                        <span className="text-[11px] text-emerald-600">
                          {new Date(selectedReview.reply_published_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-800">{selectedReview.matched_reply}</p>
                  </div>
                </div>
              ) : (
                /* Predefined Template Preview & Single-Review Test Publishing */
                <div className="space-y-3 pt-1">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-slate-500 uppercase font-bold tracking-wider flex items-center gap-1">
                        <Eye size={13} className="text-blue-500" /> Predefined Reply Template Preview
                      </span>
                      <button
                        onClick={() => handleCopyReply(selectedReview.star_rating >= 3 ? positiveTemplate : negativeTemplate, 'preview')}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                      >
                        {copiedId === 'preview' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                        <span>{copiedId === 'preview' ? 'Copied' : 'Copy Template'}</span>
                      </button>
                    </div>

                    <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-200 text-slate-800 text-sm leading-relaxed">
                      <div className="text-[11px] font-bold text-blue-800 mb-1 flex items-center justify-between">
                        <span>Assigned Template: {selectedReview.star_rating >= 3 ? 'Positive (3-5 Stars)' : 'Negative (1-2 Stars)'}</span>
                        <span className="text-slate-500 font-normal">Deterministic</span>
                      </div>
                      <p className="text-slate-800">
                        {selectedReview.star_rating >= 3 ? positiveTemplate : negativeTemplate}
                      </p>
                    </div>
                  </div>

                  {/* Controlled Test Mechanism */}
                  <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200 space-y-3">
                    <div className="flex items-start gap-2">
                      <ShieldCheck size={16} className="text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <h4 className="text-xs font-bold text-amber-900">Controlled Single-Review Publishing</h4>
                        <p className="text-[11px] text-amber-700 mt-0.5">
                          Automatic publishing is disabled system-wide. You can inspect this specific review and explicitly authorize publishing its predefined reply to Google.
                        </p>
                      </div>
                    </div>

                    {publishSuccessMsg && (
                      <div className="p-3 bg-emerald-100 border border-emerald-300 rounded-lg text-emerald-900 text-xs flex items-center gap-2">
                        <CheckCircle size={15} className="shrink-0 text-emerald-600" />
                        <span>{publishSuccessMsg}</span>
                      </div>
                    )}

                    {publishErrorMsg && (
                      <div className="p-3 bg-rose-100 border border-rose-300 rounded-lg text-rose-900 text-xs flex items-center gap-2">
                        <AlertCircle size={15} className="shrink-0 text-rose-600" />
                        <span>{publishErrorMsg}</span>
                      </div>
                    )}

                    {!publishSuccessMsg && (
                      <div>
                        {!showConfirmPublish ? (
                          <button
                            type="button"
                            onClick={() => setShowConfirmPublish(true)}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                          >
                            <Send size={13} />
                            <span>Authorize & Publish Single Reply to Google</span>
                          </button>
                        ) : (
                          <div className="p-3 bg-white border border-amber-300 rounded-xl space-y-2">
                            <p className="text-xs font-bold text-slate-800">
                              Confirm live publishing to Google Business Profile?
                            </p>
                            <p className="text-[11px] text-slate-500">
                              This will submit the exact predefined template above as a public owner response to this review.
                            </p>
                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setShowConfirmPublish(false)}
                                disabled={isPublishingSingle}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={handleExecuteSinglePublish}
                                disabled={isPublishingSingle}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
                              >
                                {isPublishingSingle ? (
                                  <>
                                    <Loader2 size={13} className="animate-spin" />
                                    <span>Publishing...</span>
                                  </>
                                ) : (
                                  <>
                                    <Send size={13} />
                                    <span>Confirm Publish to Google</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-3 text-xs text-slate-500 border-t border-slate-100">
                <div>
                  <span className="font-semibold text-slate-700">Google Review ID:</span>
                  <div className="font-mono text-[11px] text-slate-500 truncate">{selectedReview.google_review_id}</div>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Review Date:</span>
                  <div>{new Date(selectedReview.review_created_at || selectedReview.created_at).toLocaleString()}</div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => {
                  setSelectedReview(null);
                  setShowConfirmPublish(false);
                  setPublishSuccessMsg(null);
                  setPublishErrorMsg(null);
                }}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
