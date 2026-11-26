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
  ChevronLeft,
  ChevronRight,
  Clock
} from 'lucide-react';
import StarRating from '../components/StarRating';
import StatusBadge from '../components/StatusBadge';
import SelectMenu from '../components/SelectMenu';
import ConfirmDialog from '../components/ConfirmDialog';
import { TableSkeleton } from '../components/SkeletonLoader';
import { api } from '../services/api';

const DEFAULT_POSITIVE =
  'Thank you for sharing your valuable feedback with Techzone Academy! We are happy to have you as part of our learning community. We truly appreciate your support!';
const DEFAULT_NEGATIVE =
  'We sincerely apologise that your experience did not meet your expectations. Thank you for sharing your feedback with us. We value your suggestions and will continue working to improve our services.';

const RATING_OPTIONS = [
  { value: 'all', label: 'All Stars' },
  { value: '5', label: '5 Stars' },
  { value: '4', label: '4 Stars' },
  { value: '3', label: '3 Stars' },
  { value: '2', label: '2 Stars' },
  { value: '1', label: '1 Star' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'published', label: 'Published' },
  { value: 'verification_pending', label: 'Verification Pending' },
  { value: 'pending', label: 'Pending' },
  { value: 'paused', label: 'Paused' },
  { value: 'failed', label: 'Failed' },
];

const PAGE_SIZE_OPTIONS = [
  { value: 15, label: '15 / page' },
  { value: 25, label: '25 / page' },
  { value: 50, label: '50 / page' },
];

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
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
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

  useEffect(() => {
    setCurrentPage(1);
  }, [ratingFilter, statusFilter, categoryFilter, searchQuery, pageSize]);

  useEffect(() => {
    if (!selectedReview || showPublishConfirm) return undefined;
    const handleKey = (e) => {
      if (e.key === 'Escape' && !isPublishingSingle) {
        closeModal();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedReview, showPublishConfirm, isPublishingSingle]);

  const positiveTemplate = templates?.find((t) => t.category === 'positive')?.reply_text || DEFAULT_POSITIVE;
  const negativeTemplate = templates?.find((t) => t.category === 'negative')?.reply_text || DEFAULT_NEGATIVE;

  const closeModal = () => {
    setSelectedReview(null);
    setShowPublishConfirm(false);
    setPublishSuccessMsg(null);
    setPublishErrorMsg(null);
  };

  const openReviewModal = (rev) => {
    setSelectedReview(rev);
    setShowPublishConfirm(false);
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
        setShowPublishConfirm(false);
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
        setShowPublishConfirm(false);
        setPublishErrorMsg(res.message || res.result?.error || 'Failed to publish reply.');
      }
    } catch (err) {
      setShowPublishConfirm(false);
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
          <h1 className="font-heading text-2xl font-bold text-[#1a1a2e] tracking-tight">
            Customer Reviews
          </h1>
          <p className="text-sm text-[#64748b] mt-1">
            Browse TechZone Academy Google reviews, inspect matched templates, and track publishing status.
          </p>
        </div>

        {isFiltered && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#1a1a2e] bg-white border border-[#e2e8f0] hover:bg-[#e8f1f8] hover:border-[#b9d7ef] self-start sm:self-auto shadow-tz-card transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40"
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
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center gap-2 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40 ${
            categoryFilter === 'all' && ratingFilter === 'all'
              ? 'bg-[#025091] text-white shadow-sm'
              : 'bg-white border border-[#e2e8f0] text-[#1a1a2e] hover:bg-[#eff6fb]'
          }`}
        >
          <span>All Reviews</span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums ${
              categoryFilter === 'all' && ratingFilter === 'all'
                ? 'bg-[#013460] text-sky-100'
                : 'bg-[#f1f5f9] text-[#1a1a2e]'
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
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center gap-2 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
            categoryFilter === 'positive'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white border border-[#e2e8f0] text-[#1a1a2e] hover:bg-emerald-50/50'
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
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center gap-2 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 ${
            categoryFilter === 'negative'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-white border border-[#e2e8f0] text-[#1a1a2e] hover:bg-rose-50/50'
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

      {/* Search & Custom Dropdown Filters */}
      <div className="bg-white p-4 rounded-2xl border border-[#e2e8f0] shadow-tz-card flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            aria-label="Search reviews by reviewer name, comment, or Google review ID"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by reviewer name, comment, or Google review ID..."
            className="w-full pl-9 pr-9 py-2 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-sm text-[#1a1a2e] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#025091]/30 focus:border-[#025091] focus:bg-white transition-all duration-150"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search query"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#1a1a2e] p-1 rounded-lg transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <SelectMenu
            ariaLabel="Filter by star rating"
            value={ratingFilter}
            onChange={(val) => {
              setRatingFilter(val);
              setCategoryFilter('all');
            }}
            options={RATING_OPTIONS}
            className="min-w-[130px]"
          />

          <SelectMenu
            ariaLabel="Filter by reply status"
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            options={STATUS_OPTIONS}
            align="right"
            className="min-w-[175px]"
          />
        </div>
      </div>

      {/* Reviews Table / Mobile Cards or Loading Skeleton */}
      {isLoading && (!reviews || reviews.length === 0) ? (
        <TableSkeleton rows={7} cols={6} />
      ) : (
        <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-tz-card overflow-hidden">
          {paginatedReviews.length === 0 ? (
            <div className="py-14 px-4 text-center">
              <div className="inline-flex flex-col items-center gap-2 max-w-sm">
                <div className="p-3 rounded-full bg-[#e8f1f8] text-[#025091]">
                  <MessageSquare size={22} />
                </div>
                <p className="font-heading text-sm font-bold text-[#1a1a2e]">
                  No customer reviews match your filters
                </p>
                <p className="text-xs text-[#64748b]">
                  Try clearing your search terms or switching rating and status filters.
                </p>
                {isFiltered && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#025091] hover:bg-[#023e73] text-white rounded-xl text-xs font-semibold transition-all duration-150 active:scale-[0.98]"
                  >
                    <RotateCcw size={13} />
                    <span>Reset Filters</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Desktop & Tablet Responsive Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[11px] font-bold text-[#64748b] uppercase tracking-wider">
                      <th className="py-3.5 pl-4 pr-3 whitespace-nowrap">Reviewer</th>
                      <th className="py-3.5 px-2.5 whitespace-nowrap">Rating</th>
                      <th className="py-3.5 px-3 whitespace-nowrap">Customer Review</th>
                      <th className="py-3.5 px-3 whitespace-nowrap">Predefined / Published Reply</th>
                      <th className="py-3.5 px-2.5 whitespace-nowrap">Status</th>
                      <th className="py-3.5 px-2.5 whitespace-nowrap">Date</th>
                      <th className="py-3.5 pl-2.5 pr-4 text-right whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedReviews.map((rev) => {
                      const replyText =
                        rev.matched_reply || (rev.star_rating >= 3 ? positiveTemplate : negativeTemplate);
                      const hasComment = Boolean(rev.review_text && rev.review_text.trim());
                      const formattedDate = new Date(
                        rev.reply_published_at || rev.review_created_at || rev.created_at
                      ).toLocaleDateString();

                      return (
                        <tr
                          key={rev.id}
                          onClick={() => openReviewModal(rev)}
                          className="hover:bg-[#eff6fb]/60 transition-colors duration-150 cursor-pointer group align-top"
                        >
                          <td className="py-3 pl-4 pr-3 font-semibold text-[#1a1a2e] max-w-[165px]">
                            <div
                              className="group-hover:text-[#025091] transition-colors truncate"
                              title={rev.reviewer_name || 'Valued Student'}
                            >
                              {rev.reviewer_name || 'Valued Student'}
                            </div>
                            <div
                              className="text-[11px] text-[#64748b] font-mono mt-0.5 max-w-[145px] truncate"
                              title={rev.google_review_id}
                            >
                              {rev.google_review_id}
                            </div>
                          </td>

                          <td className="py-3 px-2.5 whitespace-nowrap">
                            <StarRating rating={rev.star_rating} size={13} />
                          </td>

                          <td className="py-3 px-3 min-w-[175px] max-w-[260px]">
                            {hasComment ? (
                              <p
                                className="text-xs sm:text-[13px] text-[#1a1a2e]/85 leading-relaxed line-clamp-2 break-words"
                                title={rev.review_text}
                              >
                                {rev.review_text}
                              </p>
                            ) : (
                              <span className="text-[#64748b] italic text-xs">Star rating only</span>
                            )}
                          </td>

                          <td className="py-3 px-3 min-w-[190px] max-w-[275px]">
                            {rev.matched_reply ? (
                              <div
                                className="text-xs text-[#1a1a2e] bg-[#f8fafc] p-2 rounded-lg border border-[#e2e8f0]"
                                title={rev.matched_reply}
                              >
                                <p className="line-clamp-2 leading-relaxed">
                                  <span
                                    className={`font-bold mr-1 ${
                                      rev.star_rating >= 3 ? 'text-emerald-700' : 'text-rose-700'
                                    }`}
                                  >
                                    [{rev.star_rating >= 3 ? 'Positive' : 'Negative'}]:
                                  </span>
                                  {rev.matched_reply}
                                </p>
                              </div>
                            ) : (
                              <div
                                className="text-xs text-[#64748b] bg-amber-50/60 p-2 rounded-lg border border-amber-200/80"
                                title={replyText}
                              >
                                <p className="line-clamp-2 leading-relaxed">
                                  <span
                                    className={`font-bold mr-1 ${
                                      rev.star_rating >= 3 ? 'text-emerald-700' : 'text-rose-700'
                                    }`}
                                  >
                                    [Assigned {rev.star_rating >= 3 ? 'Positive' : 'Negative'}]:
                                  </span>
                                  <span className="italic">{replyText}</span>
                                </p>
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-2.5 whitespace-nowrap">
                            <StatusBadge status={rev.publishing_status || rev.processing_status} />
                          </td>

                          <td className="py-3 px-2.5 whitespace-nowrap text-xs text-[#64748b] tabular-nums">
                            {formattedDate}
                          </td>

                          <td className="py-3 pl-2.5 pr-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openReviewModal(rev);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#025091] bg-[#e8f1f8] hover:bg-[#d7e5f3] transition-all duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40"
                            >
                              <Eye size={13} />
                              <span>{rev.matched_reply ? 'View' : 'Reply'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View (< 768px) */}
              <div className="md:hidden divide-y divide-slate-100">
                {paginatedReviews.map((rev) => {
                  const replyText =
                    rev.matched_reply || (rev.star_rating >= 3 ? positiveTemplate : negativeTemplate);
                  const formattedDate = new Date(
                    rev.reply_published_at || rev.review_created_at || rev.created_at
                  ).toLocaleDateString();

                  return (
                    <div
                      key={rev.id}
                      onClick={() => openReviewModal(rev)}
                      className="p-4 space-y-2.5 hover:bg-[#eff6fb]/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-[#1a1a2e] truncate">
                            {rev.reviewer_name || 'Valued Student'}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <StarRating rating={rev.star_rating} size={13} />
                            <span className="text-[11px] text-[#64748b] tabular-nums">{formattedDate}</span>
                          </div>
                        </div>
                        <StatusBadge status={rev.publishing_status || rev.processing_status} />
                      </div>

                      {rev.review_text && rev.review_text.trim() ? (
                        <p className="text-xs text-[#1a1a2e]/85 leading-relaxed line-clamp-2">
                          {rev.review_text}
                        </p>
                      ) : (
                        <p className="text-xs text-[#64748b] italic">Star rating only</p>
                      )}

                      <div
                        className={`text-xs p-2.5 rounded-xl border ${
                          rev.matched_reply
                            ? 'bg-[#f8fafc] border-[#e2e8f0] text-[#1a1a2e]'
                            : 'bg-amber-50/60 border-amber-200/80 text-[#64748b]'
                        }`}
                      >
                        <p className="line-clamp-2 leading-relaxed">
                          <span
                            className={`font-bold mr-1 ${
                              rev.star_rating >= 3 ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            [{rev.matched_reply ? (rev.star_rating >= 3 ? 'Positive' : 'Negative') : `Assigned ${rev.star_rating >= 3 ? 'Positive' : 'Negative'}`}]:
                          </span>
                          {replyText}
                        </p>
                      </div>

                      <div className="flex justify-end pt-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openReviewModal(rev);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#025091] bg-[#e8f1f8] hover:bg-[#d7e5f3] transition-colors"
                        >
                          <Eye size={13} />
                          <span>{rev.matched_reply ? 'View Details' : 'Preview & Reply'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Pagination Footer */}
          {totalFiltered > 0 && (
            <div className="px-4 py-3.5 bg-[#f8fafc] border-t border-[#e2e8f0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#64748b]">
              <div className="flex flex-wrap items-center gap-3">
                <span className="tabular-nums">
                  Showing <strong className="text-[#1a1a2e]">{startIdx + 1}</strong>–
                  <strong className="text-[#1a1a2e]">{Math.min(startIdx + pageSize, totalFiltered)}</strong> of{' '}
                  <strong className="text-[#1a1a2e]">{totalFiltered}</strong> review{totalFiltered === 1 ? '' : 's'}
                </span>
                <SelectMenu
                  ariaLabel="Reviews per page"
                  value={pageSize}
                  onChange={(val) => setPageSize(Number(val))}
                  options={PAGE_SIZE_OPTIONS}
                  size="sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-[#e2e8f0] hover:border-[#b9d7ef] rounded-lg font-semibold text-[#1a1a2e] hover:bg-[#eff6fb] transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40"
                >
                  <ChevronLeft size={14} />
                  <span>Prev</span>
                </button>
                <span className="px-2 font-semibold text-[#1a1a2e] tabular-nums">
                  Page {safePage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-[#e2e8f0] hover:border-[#b9d7ef] rounded-lg font-semibold text-[#1a1a2e] hover:bg-[#eff6fb] transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40"
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Review Inspection Modal */}
      {selectedReview && (
        <div
          className="fixed inset-0 z-50 bg-[#00142b]/60 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-modal-title"
          onClick={() => !isPublishingSingle && !showPublishConfirm && closeModal()}
        >
          <div
            className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-[#e2e8f0] overflow-hidden modal-enter max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1.5 w-full tz-top-accent shrink-0" />
            <div className="p-6 sm:p-7 space-y-5 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#e8f1f8] text-[#025091] border border-[#b9d7ef]">
                    <MessageSquare size={18} />
                  </div>
                  <div>
                    <h3 id="review-modal-title" className="font-heading text-base font-bold text-[#1a1a2e]">
                      Review &amp; Predefined Reply
                    </h3>
                    <p className="text-xs text-[#64748b]">Google Business Profile Review Inspection</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isPublishingSingle}
                  aria-label="Close review details modal"
                  className="text-slate-400 hover:text-[#1a1a2e] hover:bg-slate-100 p-1.5 rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40 disabled:opacity-40"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] text-[#64748b] uppercase font-bold tracking-wider">Reviewer</span>
                    <p className="font-bold text-[#1a1a2e] mt-0.5">
                      {selectedReview.reviewer_name || 'Valued Customer'}
                    </p>
                  </div>
                  <StatusBadge status={selectedReview.publishing_status || selectedReview.processing_status} />
                </div>

                <div>
                  <span className="text-[11px] text-[#64748b] uppercase font-bold tracking-wider">
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
                  <span className="text-[11px] text-[#64748b] uppercase font-bold tracking-wider">
                    Customer Review on Google
                  </span>
                  <p className="mt-1 p-3.5 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] text-[#1a1a2e] text-sm leading-relaxed">
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
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#025091] hover:text-[#013460]"
                      >
                        {copiedId === selectedReview.id ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                        <span>{copiedId === selectedReview.id ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200 text-[#1a1a2e] text-sm leading-relaxed">
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
                      <p>{selectedReview.matched_reply}</p>
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
                      <p className="text-xs text-[#1a1a2e] bg-white/85 p-3 rounded-lg border border-sky-200 italic">
                        &ldquo;{selectedReview.matched_reply}&rdquo;
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-[#64748b] uppercase font-bold tracking-wider flex items-center gap-1">
                          <Eye size={13} className="text-[#025091]" /> Predefined Reply Template Preview
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyReply(
                              selectedReview.star_rating >= 3 ? positiveTemplate : negativeTemplate,
                              'preview'
                            )
                          }
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#025091] hover:text-[#013460]"
                        >
                          {copiedId === 'preview' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                          <span>{copiedId === 'preview' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>

                      <div className="p-3.5 bg-[#eff6fb] rounded-xl border border-[#b9d7ef] text-[#1a1a2e] text-sm leading-relaxed">
                        <div className="text-[11px] font-bold text-[#001f3f] mb-1 flex items-center justify-between">
                          <span>
                            Assigned Template:{' '}
                            {selectedReview.star_rating >= 3 ? 'Positive (3–5 Stars)' : 'Negative (1–2 Stars)'}
                          </span>
                          <span className="text-[#025091] font-semibold">Deterministic</span>
                        </div>
                        <p>{selectedReview.star_rating >= 3 ? positiveTemplate : negativeTemplate}</p>
                      </div>
                    </div>

                    {/* Single-Review Manual Authorization Box */}
                    <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200 space-y-3">
                      <div className="flex items-start gap-2.5">
                        <ShieldCheck size={16} className="text-amber-600 mt-0.5 shrink-0" />
                        <div>
                          <h4 className="font-heading text-xs font-bold text-amber-950">
                            Controlled Single-Review Publishing
                          </h4>
                          <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                            {autoReplyEnabled
                              ? 'Automatic publishing is ACTIVE system-wide for new reviews. You can manually authorize publishing this pending review individually below.'
                              : 'Automatic publishing is currently PAUSED system-wide. You can manually authorize publishing this specific reply to Google.'}
                          </p>
                        </div>
                      </div>

                      {publishSuccessMsg && (
                        <div className="p-3 bg-emerald-100 border border-emerald-300 rounded-lg text-emerald-900 text-xs flex items-center gap-2">
                          <CheckCircle size={15} className="shrink-0" />
                          <span>{publishSuccessMsg}</span>
                        </div>
                      )}

                      {publishErrorMsg && (
                        <div className="p-3 bg-rose-100 border border-rose-300 rounded-lg text-rose-900 text-xs flex items-center gap-2">
                          <AlertCircle size={15} className="shrink-0" />
                          <span>{publishErrorMsg}</span>
                        </div>
                      )}

                      {!publishSuccessMsg && (
                        <button
                          type="button"
                          onClick={() => setShowPublishConfirm(true)}
                          disabled={isPublishingSingle}
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#025091] hover:bg-[#023e73] text-white rounded-xl text-xs font-bold shadow-sm transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40 disabled:opacity-50"
                        >
                          <Send size={13} />
                          <span>Authorize &amp; Publish Single Reply to Google</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 text-xs text-[#64748b] border-t border-[#e2e8f0]">
                  <div>
                    <span className="font-semibold text-[#1a1a2e]">Google Review ID:</span>
                    <div className="font-mono text-[11px] text-[#64748b] truncate mt-0.5">
                      {selectedReview.google_review_id}
                    </div>
                  </div>
                  <div>
                    <span className="font-semibold text-[#1a1a2e]">Review Date:</span>
                    <div className="mt-0.5 tabular-nums">
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
                  className="px-5 py-2 bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#1a1a2e] rounded-xl text-xs font-bold transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40 disabled:opacity-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unified ConfirmDialog for Single-Review Live Google Publishing */}
      <ConfirmDialog
        isOpen={Boolean(selectedReview && showPublishConfirm)}
        title="Publish Reply to Live Google Review?"
        description={`This submits the exact predefined ${
          (selectedReview?.star_rating || 5) >= 3 ? 'Positive' : 'Negative'
        } template as a public owner response for ${
          selectedReview?.reviewer_name || 'this reviewer'
        } on Google Business Profile.`}
        confirmLabel="Confirm & Publish"
        variant="primary"
        isLoading={isPublishingSingle}
        onConfirm={handleExecuteSinglePublish}
        onCancel={() => setShowPublishConfirm(false)}
      />
    </div>
  );
}
