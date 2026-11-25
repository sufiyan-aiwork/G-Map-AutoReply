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
  Building2,
  GraduationCap
} from 'lucide-react';
import StarRating from '../components/StarRating';

const INITIAL_DEFAULT_POSITIVE = "Thank you for sharing your valuable feedback with Techzone Academy! We are happy to have you as part of our learning community. We truly appreciate your support!";
const INITIAL_DEFAULT_NEGATIVE = "We sincerely apologise that your experience did not meet your expectations. Thank you for sharing your feedback with us. We value your suggestions and will continue working to improve our services.";

export default function Templates({ templates, onUpdateTemplate }) {
  const [positiveText, setPositiveText] = useState('');
  const [positiveActive, setPositiveActive] = useState(true);
  const [negativeText, setNegativeText] = useState('');
  const [negativeActive, setNegativeActive] = useState(true);
  
  const [savingCategory, setSavingCategory] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [previewRating, setPreviewRating] = useState(5);
  const [copiedCategory, setCopiedCategory] = useState(null);

  useEffect(() => {
    if (templates && templates.length > 0) {
      const pos = templates.find((t) => t.category === 'positive');
      if (pos) {
        setPositiveText(pos.reply_text);
        setPositiveActive(pos.is_active);
      }
      const neg = templates.find((t) => t.category === 'negative');
      if (neg) {
        setNegativeText(neg.reply_text);
        setNegativeActive(neg.is_active);
      }
    }
  }, [templates]);

  const handleSave = async (category) => {
    setSavingCategory(category);
    setStatusMessage(null);
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
        text: `Successfully saved ${category.toUpperCase()} reply template!`,
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

  const handleResetToDefault = (category) => {
    if (category === 'positive') {
      setPositiveText(INITIAL_DEFAULT_POSITIVE);
    } else {
      setNegativeText(INITIAL_DEFAULT_NEGATIVE);
    }
  };

  const handleCopy = (text, category) => {
    navigator.clipboard.writeText(text);
    setCopiedCategory(category);
    setTimeout(() => setCopiedCategory(null), 2000);
  };

  const getPreviewReply = () => {
    if (previewRating >= 3) {
      if (!positiveActive) return { text: '[Template is currently deactivated: Reply will NOT be published to Google]', disabled: true, category: 'Positive', applicable: '3, 4, 5 stars' };
      return { text: positiveText, category: 'Positive', applicable: '3, 4, 5 stars' };
    } else {
      if (!negativeActive) return { text: '[Template is currently deactivated: Reply will NOT be published to Google]', disabled: true, category: 'Negative', applicable: '1, 2 stars' };
      return { text: negativeText, category: 'Negative', applicable: '1, 2 stars' };
    }
  };

  const preview = getPreviewReply();

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Predefined Reply Templates</h1>
        <p className="text-sm text-slate-500 mt-1">
          Techzone Academy uses strictly two predefined templates. Classified purely based on star ratings (3-5★ positive, 1-2★ negative).
        </p>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-2xl border flex items-center gap-3 text-sm font-semibold shadow-xs transition-all ${
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
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
                  <ThumbsUp size={22} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Positive Reply Template</h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-slate-500">Applicable to:</span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      3, 4, and 5 Stars
                    </span>
                  </div>
                </div>
              </div>

              {/* Active Toggle */}
              <button
                type="button"
                onClick={() => setPositiveActive(!positiveActive)}
                className="flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900"
                title="Toggle template activation"
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
                <label className="text-xs font-bold text-slate-700">
                  Template Content
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(positiveText, 'positive')}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                  >
                    {copiedCategory === 'positive' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    <span>{copiedCategory === 'positive' ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResetToDefault('positive')}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-blue-600"
                    title="Reset to default initial text"
                  >
                    <RotateCcw size={11} />
                    <span>Reset Default</span>
                  </button>
                </div>
              </div>

              <textarea
                rows={5}
                value={positiveText}
                onChange={(e) => setPositiveText(e.target.value)}
                placeholder="Enter positive reply template text..."
                className="w-full p-4 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed font-sans"
              />
              <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1.5">
                <span>Min 5 characters</span>
                <span className="font-medium text-slate-500">{positiveText.length} characters</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Auto-published for all 3★, 4★, 5★ reviews
            </span>
            <button
              onClick={() => handleSave('positive')}
              disabled={savingCategory === 'positive' || positiveText.trim().length < 5}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
            >
              <Save size={14} />
              <span>{savingCategory === 'positive' ? 'Saving...' : 'Save Positive Template'}</span>
            </button>
          </div>
        </div>

        {/* Template 2: Negative */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
                  <ThumbsDown size={22} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Negative Reply Template</h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-slate-500">Applicable to:</span>
                    <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                      1 and 2 Stars
                    </span>
                  </div>
                </div>
              </div>

              {/* Active Toggle */}
              <button
                type="button"
                onClick={() => setNegativeActive(!negativeActive)}
                className="flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900"
                title="Toggle template activation"
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
                <label className="text-xs font-bold text-slate-700">
                  Template Content
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(negativeText, 'negative')}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                  >
                    {copiedCategory === 'negative' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    <span>{copiedCategory === 'negative' ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResetToDefault('negative')}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-blue-600"
                    title="Reset to default initial text"
                  >
                    <RotateCcw size={11} />
                    <span>Reset Default</span>
                  </button>
                </div>
              </div>

              <textarea
                rows={5}
                value={negativeText}
                onChange={(e) => setNegativeText(e.target.value)}
                placeholder="Enter negative reply template text..."
                className="w-full p-4 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 leading-relaxed font-sans"
              />
              <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1.5">
                <span>Min 5 characters</span>
                <span className="font-medium text-slate-500">{negativeText.length} characters</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Auto-published for all 1★ and 2★ reviews
            </span>
            <button
              onClick={() => handleSave('negative')}
              disabled={savingCategory === 'negative' || negativeText.trim().length < 5}
              className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
            >
              <Save size={14} />
              <span>{savingCategory === 'negative' ? 'Saving...' : 'Save Negative Template'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Realistic Google Business Profile Thread Simulation */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Eye size={18} className="text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Live Google Review Thread Simulator
            </h2>
          </div>
          <span className="text-xs text-slate-500">Pick any star rating to preview the published reply</span>
        </div>

        {/* Star Picker */}
        <div className="flex items-center gap-4 mb-5">
          <span className="text-xs font-bold text-slate-700">Simulate Rating:</span>
          <StarRating
            rating={previewRating}
            size={22}
            interactive={true}
            onRatingChange={setPreviewRating}
          />
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
            previewRating >= 3 ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
          }`}>
            {previewRating} Star{previewRating > 1 ? 's' : ''} ({previewRating >= 3 ? 'Positive Template' : 'Negative Template'})
          </span>
        </div>

        {/* Realistic Google Thread Card */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 max-w-2xl">
          {/* Customer's Review */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-sm">
              S
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">Sample Student</span>
                <span className="text-xs text-slate-400">· Just now</span>
              </div>
              <StarRating rating={previewRating} size={14} />
              <p className="text-sm text-slate-700 mt-1 italic">
                {previewRating >= 3
                  ? '"Learned full-stack web development at Techzone Academy. Great instructors and practical projects!"'
                  : '"Had some logistical delays with course schedule updates. Hope the admin team improves communication."'}
              </p>
            </div>
          </div>

          {/* Business Reply Thread */}
          <div className="ml-6 pl-4 border-l-2 border-blue-400 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center shrink-0">
              <GraduationCap size={15} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-xs">Response from Techzone Academy (Owner)</span>
                <span className="text-[11px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-semibold border border-emerald-200">
                  Automated
                </span>
              </div>
              <p className={`text-xs mt-1 leading-relaxed ${preview.disabled ? 'text-rose-600 font-bold' : 'text-slate-800'}`}>
                {preview.text}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
