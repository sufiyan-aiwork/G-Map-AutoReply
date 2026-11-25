import React, { useState, useEffect } from 'react';
import {
  Search,
  MessageSquare,
  X,
  Copy,
  Check,
  RotateCcw,
  Send,
  Eye,
  AlertCircle,
  CheckCircle,
  ShieldCheck,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Clock
} from 'lucide-react';
import StarRating from '../components/StarRating';
import StatusBadge from '../components/StatusBadge';
import { TableSkeleton } from '../components/SkeletonLoader';
import { api } from '../services/api';

const DEFAULT_POSITIVE =
  'Thank you for sharing your valuable feedback with Techzone Academy! We are happy to have you as part of our learning community. We truly appreciate your support!';
const DEFAULT_NEGATIVE =
  'We sincerely apologise that your experience did not meet your expectations. Thank you for sharing your feedback with us. We value your suggestions and will continue working to improve our services.';

export default function Reviews({
  reviews,
  templates,
  isLoading,
  autoReplyEnabled = false,
  initialFilter = null,
  onRefresh,
}) {
  const [ratingFilter, setRatingFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const [selectedReview, setSelectedReview] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const [isPublishingSingle, setIsPublishingSingle] = useState(false);
  const [showConfirmPublish, setShowConfirmPublish] = useState(false);
  const [publishSuccessMsg, setPublishSuccessMsg] = useState(null);
  const [publishErrorMsg, setPublishErrorMsg] = useState(null);

  useEffect(() => {
    if (initialFilter) {
      setRatingFilter(initialFilter.rating || 'all');
      setCategoryFilter(initialFilter.category || 'all');
      setStatusFilter(initialFilter.status || 'all');
      setCurrentPage(1);
    }
  }, [initialFilter]);

  // Reset pagination to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [ratingFilter, statusFilter, categoryFilter, searchQuery, pageSize]);

  // Escape key dismissal for review modal
  useEffect(() => {
    if (!selectedReview) return undefined;
    const handleKey = (e) => {
      if (e.key === 'Escape' && !isPublishingSingle) {
        closeModal();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedReview, isPublishingSingle]);

  const positiveTemplate = templates?.find((t) => t.category === 'positive')?.reply_text || DEFAULT_POSITIVE;
  const negativeTemplate = templates?.find((t) => t.category === 'negative')?.reply_text || DEFAULT_NEGATIVE;

  const closeModal = () => {
    setSelectedReview(null);
    setShowConfirmPublish(false);
    setPublishSuccessMsg(null);
    setPublishErrorMsg(null);
  };

  const openReviewModal = (rev) => {
    setSelectedReview(rev);
    setShowConfirmPublish(false);
    setPublishSuccessMsg(null);
    setPublishErrorMsg(null);
  };

  const handleCopyReply = (text, id) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2200);
  };

  const handleResetFilters = () => {
    setRatingFilter('all');
    setStatusFilter('all');
    setCategoryFilter('all');
    setSearchQuery('');
    setCurrentPage(1);
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
        const replyText =
          res.result?.reply_text || (selectedReview.star_rating >= 3 ? positiveTemplate : negativeTemplate);
        const finalStatus = res.result?.publishing_status || 'published';

        setSelectedReview((prev) =>
          prev
            ? {
                ...prev,
                publishing_status: finalStatus,
                processing_status: finalStatus === 'published' ? 'processed' : 'pending',
                matched_reply: replyText,
                reply_published_at: finalStatus === 'published' ? new Date().toISOString() : null,
              }
            : null
        );

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

  const isFiltered =
    ratingFilter !== 'all' || statusFilter !== 'all' || categoryFilter !== 'all' || searchQuery.trim() !== '';

  const getEffectiveTime = (r) => {
    const pubTime = r.reply_published_at ? new Date(r.reply_published_at).getTime() : 0;
    const revTime = r.review_created_at
      ? new Date(r.review_created_at).getTime()
      : r.created_at
      ? new Date(r.created_at).getTime()
      : 0;
    return Math.max(pubTime, revTime);
  };

  const filteredReviews = (reviews || [])
    .filter((r) => {
      if (ratingFilter !== 'all' && r.star_rating !== parseInt(ratingFilter, 10)) {
        return false;
      }
      if (categoryFilter === 'positive' && r.star_rating < 3) return false;
      if (categoryFilter === 'negative' && r.star_rating > 2) return false;

      if (statusFilter !== 'all') {
        const st = (r.publishing_status || r.processing_status || '').toLowerCase();
        if (st !== statusFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const textMatch = (r.review_text || '').toLowerCase().includes(q);
        const nameMatch = (r.reviewer_name || '').toLowerCase().includes(q);
        const idMatch = (r.google_review_id || '').toLowerCase().includes(q);
        if (!textMatch && !nameMatch && !idMatch) return false;
      }
      return true;
    })
    .sort((a, b) => getEffectiveTime(b) - getEffectiveTime(a));

  const totalCount = (reviews || []).length;
  const posCount = (reviews || []).filter((r) => r.star_rating >= 3).length;
  const negCount = (reviews || []).filter((r) => r.star_rating < 3).length;

  const totalFiltered = filteredReviews.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const paginatedReviews = filteredReviews.slice(startIdx, startIdx + pageSize);

  const selectedStatus = (selectedReview?.publishing_status || selectedReview?.processing_status || '').toLowerCase();
  const isSelectedPublished = selectedStatus === 'published' && Boolean(selectedReview?.matched_reply);
  const isSelectedVerificationPending = selectedStatus === 'verification_pending';

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 tracking-tight">Customer Reviews</h1>
          <p className="text-sm text-slate-500 mt-1">
            Browse Techzone Academy Google reviews, inspect matched templates, and track publishing status.
          </p>
        </div>

        {isFiltered && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-navy-800 bg-white border border-slate-300 hover:bg-slate-50 self-start sm:self-auto shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <RotateCcw size={13} />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      {/* Quick Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setCategoryFilter('all');
            setRatingFilter('all');
          }}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            categoryFilter === 'all' && ratingFilter === 'all'
              ? 'bg-navy-900 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <span>All Reviews</span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums ${
              categoryFilter === 'all' && ratingFilter === 'all'
                ? 'bg-navy-700 text-blue-100'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {totalCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setCategoryFilter('positive');
            setRatingFilter('all');
          }}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
            categoryFilter === 'positive'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <span>Positive (3–5★)</span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums ${
              categoryFilter === 'positive' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-800'
            }`}
          >
            {posCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setCategoryFilter('negative');
            setRatingFilter('all');
          }}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
            categoryFilter === 'negative'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <span>Negative (1–2★)</span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums ${
              categoryFilter === 'negative' ? 'bg-rose-700 text-white' : 'bg-rose-50 text-rose-800'
            }`}
          >
            {negCount}
          </span>
        </button>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            aria-label="Search reviews by reviewer name, comment, or Google review ID"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by reviewer name, comment, or Google review ID..."
            className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search query"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 rounded"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Filter by star rating"
            value={ratingFilter}
            onChange={(e) => {
              setRatingFilter(e.target.value);
              setCategoryFilter('all');
            }}
            className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Stars</option>
            <option value="5">5 Stars</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars</option>
            <option value="2">2 Stars</option>
            <option value="1">1 Star</option>
          </select>

          <select
            aria-label="Filter by reply status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="published">Published</option>
            <option value="verification_pending">Verification Pending</option>
            <option value="pending">Pending</option>
            <option value="paused">Paused</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Reviews Table or Loading Skeleton */}
      {isLoading && (!reviews || reviews.length === 0) ? (
        <TableSkeleton rows={7} cols={6} />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Reviewer</th>
                  <th className="py-3.5 px-4">Rating</th>
                  <th className="py-3.5 px-4">Customer Review</th>
                  <th className="py-3.5 px-4">Predefined / Published Reply</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedReviews.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-14 px-4 text-center">
                      <div className="inline-flex flex-col items-center gap-2 max-w-sm">
                        <div className="p-3 rounded-full bg-blue-50 text-blue-600">
                          <MessageSquare size={22} />
                        </div>
                        <p className="text-sm font-semibold text-navy-900">
                          No customer reviews match your filters
                        </p>
                        <p className="text-xs text-slate-500">
                          Try clearing your search terms or switching rating and status filters.
                        </p>
                        {isFiltered && (
                          <button
                            type="button"
                            onClick={handleResetFilters}
                            className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors"
                          >
                            <RotateCcw size={13} />
                            <span>Reset Filters</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedReviews.map((rev) => (
                    <tr
                      key={rev.id}
                      onClick={() => openReviewModal(rev)}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 font-semibold text-navy-900 whitespace-nowrap">
                        <div className="group-hover:text-blue-700 transition-colors">
                          {rev.reviewer_name || 'Valued Student'}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5 max-w-[160px] truncate">
                          {rev.google_review_id}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StarRating rating={rev.star_rating} size={15} />
                      </td>
                      <td className="py-3.5 px-4 max-w-xs truncate text-slate-600">
                        {rev.review_text && rev.review_text.trim() ? (
                          rev.review_text
                        ) : (
                          <span className="text-slate-400 italic text-xs">Star rating only</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 max-w-sm">
                        {rev.matched_reply ? (
                          <div className="text-xs text-slate-700 truncate bg-slate-50 p-2 rounded-lg border border-slate-200">
                            <span
                              className={`font-bold mr-1 ${
                                rev.star_rating >= 3 ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              [{rev.star_rating >= 3 ? 'Positive' : 'Negative'}]:
                            </span>
                            {rev.matched_reply}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500 truncate bg-amber-50/50 p-2 rounded-lg border border-amber-200/70">
                            <span
                              className={`font-bold mr-1 ${
                                rev.star_rating >= 3 ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              [Assigned {rev.star_rating >= 3 ? 'Positive' : 'Negative'}]:
                            </span>
                            <span className="italic">
                              {rev.star_rating >= 3 ? positiveTemplate : negativeTemplate}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusBadge status={rev.publishing_status || rev.processing_status} />
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-500 tabular-nums">
                        {new Date(rev.reply_published_at || rev.review_created_at || rev.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openReviewModal(rev);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          <Eye size={13} />
                          <span>{rev.matched_reply ? 'View' : 'Preview & Reply'}</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalFiltered > 0 && (
            <div className="px-4 py-3.5 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-3">
                <span className="tabular-nums">
                  Showing <strong>{startIdx + 1}</strong>–<strong>{Math.min(startIdx + pageSize, totalFiltered)}</strong> of{' '}
                  <strong>{totalFiltered}</strong> review{totalFiltered === 1 ? '' : 's'}
                </span>
                <select
                  aria-label="Reviews per page"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-navy-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={15}>15 / page</option>
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold text-navy-900 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <ChevronLeft size={14} />
                  <span>Prev</span>
                </button>
                <span className="px-2 font-semibold text-navy-900 tabular-nums">
                  Page {safePage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold text-navy-900 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Review Detail Modal */}
      {selectedReview && (
        <div
          className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-modal-title"
          onClick={() => !isPublishingSingle && closeModal()}
        >
          <div
            className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 modal-enter max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h3 id="review-modal-title" className="text-base font-bold text-navy-900">
                    Review & Predefined Reply
                  </h3>
                  <p className="text-xs text-slate-500">Google Business Profile Review Inspection</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={isPublishingSingle}
                aria-label="Close review details modal"
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">Reviewer</span>
                  <p className="font-bold text-navy-900 mt-0.5">
                    {selectedReview.reviewer_name || 'Valued Customer'}
                  </p>
                </div>
                <StatusBadge status={selectedReview.publishing_status || selectedReview.processing_status} />
              </div>

              <div>
                <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">
                  Star Rating Classification
                </span>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <StarRating rating={selectedReview.star_rating} size={20} />
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-md border ${
                      selectedReview.star_rating >= 3
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                  >
                    {selectedReview.star_rating} Star{selectedReview.star_rating > 1 ? 's' : ''} (
                    {selectedReview.star_rating >= 3 ? 'Positive Template: 3–5★' : 'Negative Template: 1–2★'})
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">
                  Customer Review on Google
                </span>
                <p className="mt-1 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 text-sm leading-relaxed">
                  {selectedReview.review_text && selectedReview.review_text.trim()
                    ? `"${selectedReview.review_text}"`
                    : 'No written comment — star rating only.'}
                </p>
              </div>

              {isSelectedPublished ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-emerald-700 uppercase font-bold tracking-wider flex items-center gap-1">
                      <CheckCircle size={13} /> Published Predefined Reply
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyReply(selectedReview.matched_reply, selectedReview.id)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                    >
                      {copiedId === selectedReview.id ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      <span>{copiedId === selectedReview.id ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200 text-slate-900 text-sm leading-relaxed">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <span className="font-bold text-xs text-emerald-800">
                        Verified Live on Google Business Profile
                      </span>
                      {selectedReview.reply_published_at && (
                        <span className="text-[11px] text-emerald-700 tabular-nums">
                          {new Date(selectedReview.reply_published_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-800">{selectedReview.matched_reply}</p>
                  </div>
                </div>
              ) : isSelectedVerificationPending ? (
                <div className="p-4 bg-sky-50 rounded-xl border border-sky-200 space-y-2">
                  <div className="flex items-center gap-2 text-sky-900 font-bold text-xs">
                    <Clock size={15} className="text-sky-600 shrink-0" />
                    <span>Accepted by Google — Awaiting Public Visibility Verification</span>
                  </div>
                  <p className="text-xs text-sky-800 leading-relaxed">
                    This reply has already been accepted by Google Business Profile. The scheduler reconciles visibility automatically using GET-only checks without sending duplicate PUT requests.
                  </p>
                  {selectedReview.matched_reply && (
                    <p className="text-xs text-slate-700 bg-white/80 p-3 rounded-lg border border-sky-200 italic">
                      "{selectedReview.matched_reply}"
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-slate-500 uppercase font-bold tracking-wider flex items-center gap-1">
                        <Eye size={13} className="text-blue-600" /> Predefined Reply Template Preview
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyReply(
                            selectedReview.star_rating >= 3 ? positiveTemplate : negativeTemplate,
                            'preview'
                          )
                        }
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                      >
                        {copiedId === 'preview' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                        <span>{copiedId === 'preview' ? 'Copied' : 'Copy Template'}</span>
                      </button>
                    </div>

                    <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-200 text-slate-800 text-sm leading-relaxed">
                      <div className="text-[11px] font-bold text-navy-900 mb-1 flex items-center justify-between">
                        <span>
                          Assigned Template:{' '}
                          {selectedReview.star_rating >= 3 ? 'Positive (3–5 Stars)' : 'Negative (1–2 Stars)'}
                        </span>
                        <span className="text-blue-700 font-semibold">Deterministic</span>
                      </div>
                      <p className="text-slate-800">
                        {selectedReview.star_rating >= 3 ? positiveTemplate : negativeTemplate}
                      </p>
                    </div>
                  </div>

                  {/* Single-Review Manual Authorization Box */}
                  <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <ShieldCheck size={16} className="text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <h4 className="text-xs font-bold text-amber-950">Controlled Single-Review Publishing</h4>
                        <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                          {autoReplyEnabled
                            ? 'Automatic publishing is ACTIVE system-wide for new reviews. You can manually authorize publishing this pending review individually below.'
                            : 'Automatic publishing is currently PAUSED system-wide. You can manually authorize publishing this specific reply to Google.'}
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
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          >
                            <Send size={13} />
                            <span>Authorize & Publish Single Reply to Google</span>
                          </button>
                        ) : (
                          <div className="p-3.5 bg-white border border-amber-300 rounded-xl space-y-2.5">
                            <p className="text-xs font-bold text-navy-900">
                              Confirm live publishing to Google Business Profile?
                            </p>
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                              This submits the predefined template above as a public owner reply for{' '}
                              <strong>{selectedReview.reviewer_name || 'this customer'}</strong>.
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
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 text-xs text-slate-500 border-t border-slate-100">
                <div>
                  <span className="font-semibold text-navy-900">Google Review ID:</span>
                  <div className="font-mono text-[11px] text-slate-500 truncate mt-0.5">
                    {selectedReview.google_review_id}
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-navy-900">Review Date:</span>
                  <div className="mt-0.5">
                    {new Date(selectedReview.review_created_at || selectedReview.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={closeModal}
                disabled={isPublishingSingle}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-navy-900 rounded-xl text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
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
