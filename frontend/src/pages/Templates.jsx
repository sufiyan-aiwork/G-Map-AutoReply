import React, { useState, useEffect } from 'react';
import {
  Save,
  CheckCircle,
  ThumbsUp,
  ThumbsDown,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  Eye,
  RotateCcw,
  Copy,
  Check,
  GraduationCap,
  Loader2
} from 'lucide-react';
import StarRating from '../components/StarRating';
import ConfirmDialog from '../components/ConfirmDialog';
import { CardSkeleton } from '../components/SkeletonLoader';

const INITIAL_DEFAULT_POSITIVE =
  'Thank you for sharing your valuable feedback with Techzone Academy! We are happy to have you as part of our learning community. We truly appreciate your support!';
const INITIAL_DEFAULT_NEGATIVE =
  'We sincerely apologise that your experience did not meet your expectations. Thank you for sharing your feedback with us. We value your suggestions and will continue working to improve our services.';

export default function Templates({ templates, isLoading, onUpdateTemplate }) {
  const [positiveText, setPositiveText] = useState('');
  const [positiveActive, setPositiveActive] = useState(true);
  const [negativeText, setNegativeText] = useState('');
  const [negativeActive, setNegativeActive] = useState(true);

  const [savedPositive, setSavedPositive] = useState({ text: '', active: true });
  const [savedNegative, setSavedNegative] = useState({ text: '', active: true });

  const [savingCategory, setSavingCategory] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [previewRating, setPreviewRating] = useState(5);
  const [copiedCategory, setCopiedCategory] = useState(null);
  const [pendingConfirm, setPendingConfirm] = useState(null);

  useEffect(() => {
    if (templates && templates.length > 0) {
      const pos = templates.find((t) => t.category === 'positive');
      if (pos) {
        setPositiveText(pos.reply_text);
        setPositiveActive(pos.is_active);
        setSavedPositive({ text: pos.reply_text, active: pos.is_active });
      }
      const neg = templates.find((t) => t.category === 'negative');
      if (neg) {
        setNegativeText(neg.reply_text);
        setNegativeActive(neg.is_active);
        setSavedNegative({ text: neg.reply_text, active: neg.is_active });
      }
    }
  }, [templates]);

  const isPosDirty = positiveText !== savedPositive.text || positiveActive !== savedPositive.active;
  const isNegDirty = negativeText !== savedNegative.text || negativeActive !== savedNegative.active;

  const executeSave = async (category) => {
    setSavingCategory(category);
    setStatusMessage(null);
    setPendingConfirm(null);
    try {
      const isPos = category === 'positive';
      const text = isPos ? positiveText : negativeText;
      const active = isPos ? positiveActive : negativeActive;

      await onUpdateTemplate(category, {
        reply_text: text,
        is_active: active,
      });

      setStatusMessage({
        type: 'success',
        text: `Saved ${category.toUpperCase()} reply template to Supabase.`,
      });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.message || `Failed to update ${category} template`,
      });
    } finally {
      setSavingCategory(null);
    }
  };

  const handleSaveClick = (category) => {
    const isActive = category === 'positive' ? positiveActive : negativeActive;
    const wasActive = category === 'positive' ? savedPositive.active : savedNegative.active;
    if (!isActive && wasActive) {
      setPendingConfirm({
        action: 'save_disabled',
        category,
        title: `Disable ${category === 'positive' ? 'Positive (3–5★)' : 'Negative (1–2★)'} Template?`,
        description: `Deactivating this template immediately halts all automated and manual Google reply publishing for ${
          category === 'positive' ? '3, 4, and 5-star' : '1 and 2-star'
        } reviews until re-enabled.`,
        confirmLabel: 'Save & Disable Template',
        variant: 'warning',
      });
      return;
    }
    executeSave(category);
  };

  const handleResetClick = (category) => {
    const defaultText = category === 'positive' ? INITIAL_DEFAULT_POSITIVE : INITIAL_DEFAULT_NEGATIVE;
    const currentText = category === 'positive' ? positiveText : negativeText;
    if (currentText === defaultText) return;

    setPendingConfirm({
      action: 'reset',
      category,
      title: `Restore Default ${category === 'positive' ? 'Positive' : 'Negative'} Copy?`,
      description:
        'This replaces the text in the editor box with the original Techzone Academy wording. Click Save afterwards to persist the change to Supabase.',
      confirmLabel: 'Restore Default Text',
      variant: 'primary',
    });
  };

  const handleConfirmAction = () => {
    if (!pendingConfirm) return;
    if (pendingConfirm.action === 'save_disabled') {
      executeSave(pendingConfirm.category);
    } else if (pendingConfirm.action === 'reset') {
      if (pendingConfirm.category === 'positive') {
        setPositiveText(INITIAL_DEFAULT_POSITIVE);
      } else {
        setNegativeText(INITIAL_DEFAULT_NEGATIVE);
      }
      setPendingConfirm(null);
    }
  };

  const handleCopy = (text, category) => {
    navigator.clipboard?.writeText(text);
    setCopiedCategory(category);
    setTimeout(() => setCopiedCategory(null), 2000);
  };

  const getPreviewReply = () => {
    if (previewRating >= 3) {
      if (!positiveActive) {
        return {
          text: '[Template is currently deactivated: Reply will NOT be published to Google]',
          disabled: true,
        };
      }
      return { text: positiveText };
    } else {
      if (!negativeActive) {
        return {
          text: '[Template is currently deactivated: Reply will NOT be published to Google]',
          disabled: true,
        };
      }
      return { text: negativeText };
    }
  };

  const preview = getPreviewReply();

  if (isLoading && (!templates || templates.length === 0)) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-72 bg-slate-200 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CardSkeleton height="h-80" />
          <CardSkeleton height="h-80" />
        </div>
        <CardSkeleton height="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy-900 tracking-tight">Predefined Reply Templates</h1>
        <p className="text-sm text-slate-500 mt-1">
          Techzone Academy enforces two fixed brand-approved templates matched deterministically by star rating (3–5★ positive, 1–2★ negative).
        </p>
      </div>

      {statusMessage && (
        <div
          role="status"
          className={`p-4 rounded-2xl border flex items-center gap-3 text-sm font-semibold shadow-sm page-enter ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {statusMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Two Templates Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Template 1: Positive */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <ThumbsUp size={21} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold text-navy-900">Positive Reply Template</h2>
                    {isPosDirty && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                        Unsaved changes
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-xs text-slate-500">Applies to:</span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      3, 4, and 5 Stars
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={positiveActive}
                aria-label="Toggle Positive Template activation"
                onClick={() => setPositiveActive(!positiveActive)}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-navy-900 rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 shrink-0"
              >
                {positiveActive ? (
                  <ToggleRight size={30} className="text-emerald-600" />
                ) : (
                  <ToggleLeft size={30} className="text-slate-400" />
                )}
                <span className={positiveActive ? 'text-emerald-700 font-bold' : 'text-slate-400 font-medium'}>
                  {positiveActive ? 'Active' : 'Disabled'}
                </span>
              </button>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="positive-template-text" className="text-xs font-bold text-navy-900">
                  Template Content
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleCopy(positiveText, 'positive')}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-navy-900"
                  >
                    {copiedCategory === 'positive' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    <span>{copiedCategory === 'positive' ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResetClick('positive')}
                    disabled={positiveText === INITIAL_DEFAULT_POSITIVE}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Restore original default wording"
                  >
                    <RotateCcw size={11} />
                    <span>Reset Default</span>
                  </button>
                </div>
              </div>

              <textarea
                id="positive-template-text"
                rows={5}
                value={positiveText}
                onChange={(e) => setPositiveText(e.target.value)}
                placeholder="Enter positive reply template text..."
                className="w-full p-4 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white leading-relaxed font-sans transition-all"
              />
              <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1.5">
                <span>Minimum 5 characters</span>
                <span className="font-medium text-slate-500 tabular-nums">{positiveText.length} characters</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">Auto-selected for 3★, 4★, 5★ reviews</span>
            <button
              type="button"
              onClick={() => handleSaveClick('positive')}
              disabled={savingCategory === 'positive' || positiveText.trim().length < 5 || !isPosDirty}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingCategory === 'positive' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{savingCategory === 'positive' ? 'Saving...' : isPosDirty ? 'Save Positive Template' : 'Saved'}</span>
            </button>
          </div>
        </div>

        {/* Template 2: Negative */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
                  <ThumbsDown size={21} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold text-navy-900">Negative Reply Template</h2>
                    {isNegDirty && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                        Unsaved changes
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-xs text-slate-500">Applies to:</span>
                    <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                      1 and 2 Stars
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={negativeActive}
                aria-label="Toggle Negative Template activation"
                onClick={() => setNegativeActive(!negativeActive)}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-navy-900 rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 shrink-0"
              >
                {negativeActive ? (
                  <ToggleRight size={30} className="text-rose-600" />
                ) : (
                  <ToggleLeft size={30} className="text-slate-400" />
                )}
                <span className={negativeActive ? 'text-rose-700 font-bold' : 'text-slate-400 font-medium'}>
                  {negativeActive ? 'Active' : 'Disabled'}
                </span>
              </button>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="negative-template-text" className="text-xs font-bold text-navy-900">
                  Template Content
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleCopy(negativeText, 'negative')}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-navy-900"
                  >
                    {copiedCategory === 'negative' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    <span>{copiedCategory === 'negative' ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResetClick('negative')}
                    disabled={negativeText === INITIAL_DEFAULT_NEGATIVE}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Restore original default wording"
                  >
                    <RotateCcw size={11} />
                    <span>Reset Default</span>
                  </button>
                </div>
              </div>

              <textarea
                id="negative-template-text"
                rows={5}
                value={negativeText}
                onChange={(e) => setNegativeText(e.target.value)}
                placeholder="Enter negative reply template text..."
                className="w-full p-4 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white leading-relaxed font-sans transition-all"
              />
              <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1.5">
                <span>Minimum 5 characters</span>
                <span className="font-medium text-slate-500 tabular-nums">{negativeText.length} characters</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">Auto-selected for 1★ and 2★ reviews</span>
            <button
              type="button"
              onClick={() => handleSaveClick('negative')}
              disabled={savingCategory === 'negative' || negativeText.trim().length < 5 || !isNegDirty}
              className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingCategory === 'negative' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{savingCategory === 'negative' ? 'Saving...' : isNegDirty ? 'Save Negative Template' : 'Saved'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Google Review Thread Simulator */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Eye size={18} className="text-blue-600" />
            <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
              Google Review Thread Preview
            </h2>
          </div>
          <span className="text-xs text-slate-500">Select a star rating to inspect how your reply renders on Google</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-5">
          <span className="text-xs font-bold text-navy-900">Preview Rating:</span>
          <StarRating
            rating={previewRating}
            size={22}
            interactive={true}
            onRatingChange={setPreviewRating}
          />
          <span
            className={`text-xs font-bold px-2.5 py-0.5 rounded-md border ${
              previewRating >= 3
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {previewRating} Star{previewRating > 1 ? 's' : ''} ({previewRating >= 3 ? 'Positive Template' : 'Negative Template'})
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 max-w-2xl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-sm">
              S
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-navy-900 text-sm">Sample Student</span>
                <span className="text-xs text-slate-400">· Preview</span>
              </div>
              <StarRating rating={previewRating} size={14} />
              <p className="text-sm text-slate-700 mt-1.5 italic">
                {previewRating >= 3
                  ? '"Learned full-stack development at Techzone Academy. Great instructors and practical projects!"'
                  : '"Had some scheduling confusion with batch timings. Hope the team improves communication."'}
              </p>
            </div>
          </div>

          <div className="ml-6 pl-4 border-l-2 border-blue-500 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-navy-900 text-white font-bold flex items-center justify-center shrink-0">
              <GraduationCap size={15} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-navy-900 text-xs">Response from Techzone Academy (Owner)</span>
                <span className="text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-semibold border border-blue-200">
                  Predefined
                </span>
              </div>
              <p
                className={`text-xs mt-1.5 leading-relaxed ${
                  preview.disabled ? 'text-rose-600 font-bold' : 'text-slate-800'
                }`}
              >
                {preview.text}
              </p>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={Boolean(pendingConfirm)}
        title={pendingConfirm?.title || ''}
        description={pendingConfirm?.description || ''}
        confirmLabel={pendingConfirm?.confirmLabel || 'Confirm'}
        variant={pendingConfirm?.variant || 'primary'}
        isLoading={Boolean(savingCategory)}
        onConfirm={handleConfirmAction}
        onCancel={() => setPendingConfirm(null)}
      />
    </div>
  );
}
