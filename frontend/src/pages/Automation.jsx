import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Save,
  RotateCcw,
  Loader2,
  X
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { CardSkeleton } from '../components/SkeletonLoader';

export default function Automation({
  automationStatus,
  isLoading,
  onToggleAutomation,
  onUpdateSettings
}) {
  const savedInterval = automationStatus?.polling_interval_minutes ?? 15;
  const [pollingInterval, setPollingInterval] = useState(savedInterval);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  useEffect(() => {
    if (automationStatus?.polling_interval_minutes) {
      setPollingInterval(automationStatus.polling_interval_minutes);
    }
  }, [automationStatus]);

  if (isLoading && !automationStatus) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-72 bg-slate-200 rounded-xl animate-pulse" />
        <CardSkeleton height="h-52" />
        <CardSkeleton height="h-64" />
      </div>
    );
  }

  const parsedSelected = parseInt(pollingInterval, 10);
  const isDirty = parsedSelected !== savedInterval;
  const isEnabled = automationStatus?.auto_reply_enabled ?? true;

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!isDirty) return;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await onUpdateSettings({
        polling_interval: parsedSelected,
      });
      setSaveMessage({
        type: 'success',
        text: `Automation polling interval updated to every ${parsedSelected} minutes.`,
      });
      setTimeout(() => setSaveMessage(null), 5000);
    } catch (err) {
      setSaveMessage({
        type: 'error',
        text: err.message || 'Failed to update automation settings',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 page-enter">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-navy-900 tracking-tight">Automation Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage automatic reply publishing triggers, review synchronization frequency, and system safety states.
        </p>
      </div>

      {saveMessage && (
        <div
          role="status"
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm font-medium shadow-sm page-enter ${
            saveMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {saveMessage.type === 'success' ? (
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle size={18} className="text-rose-600 shrink-0" />
            )}
            <span>{saveMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveMessage(null)}
            aria-label="Dismiss notification"
            className="p-1 rounded-lg hover:bg-black/5 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Master Toggle Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-bold text-navy-900">Automatic Review Reply System</h2>
              <StatusBadge status={isEnabled ? 'active' : 'paused'} />
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              When enabled, incoming Google reviews are automatically categorized by star rating and predefined replies are published.
            </p>
          </div>

          <button
            type="button"
            onClick={onToggleAutomation}
            className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
              isEnabled
                ? 'bg-amber-500 hover:bg-amber-600 text-white focus-visible:ring-amber-500'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white focus-visible:ring-emerald-500'
            }`}
          >
            {isEnabled ? (
              <>
                <Pause size={15} />
                <span>Pause Auto-Replies</span>
              </>
            ) : (
              <>
                <Play size={15} />
                <span>Resume Auto-Replies</span>
              </>
            )}
          </button>
        </div>

        {/* Informational alert about pause behavior */}
        <div
          className={`mt-5 p-4 rounded-xl border text-xs leading-relaxed ${
            isEnabled
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
              : 'bg-amber-50/70 border-amber-200 text-amber-900'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {isEnabled ? (
              <ShieldCheck size={18} className="text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-bold mb-0.5">
                {isEnabled ? 'System Active: Live Publishing Enabled' : 'System Paused: Publishing On Hold'}
              </p>
              <p>
                {isEnabled
                  ? 'All newly collected reviews will have their predefined replies automatically dispatched to Google Business Profile according to their 1–5 star ratings.'
                  : 'Automatic publishing is currently PAUSED. New customer reviews will continue to be collected into Supabase with "pending" status, but no replies will be dispatched to Google until you resume.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Polling Interval & Scheduler Config */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-blue-600" />
            <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
              Review Polling Frequency
            </h2>
          </div>
          <span className="text-xs font-semibold text-slate-500 tabular-nums">
            Current: Every {savedInterval} min
          </span>
        </div>
        <p className="text-xs text-slate-500 mb-6">
          Set how frequently the background service checks Techzone Academy&apos;s Google Business Profile for new student reviews.
        </p>

        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" role="radiogroup" aria-label="Polling interval options">
            {[5, 15, 30, 60].map((interval) => {
              const isSelected = parsedSelected === interval;
              const isSavedOption = savedInterval === interval;
              return (
                <label
                  key={interval}
                  className={`relative p-4 rounded-xl border cursor-pointer flex flex-col items-center text-center transition-all focus-within:ring-2 focus-within:ring-blue-500 ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20 shadow-sm'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100/70 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="pollingInterval"
                    value={interval}
                    checked={isSelected}
                    onChange={(e) => setPollingInterval(Number(e.target.value))}
                    className="sr-only"
                  />
                  {isSavedOption && (
                    <span className="mb-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-navy-900 text-white">
                      Active
                    </span>
                  )}
                  <span className="text-lg font-bold text-navy-900 tabular-nums">{interval} min</span>
                  <span className="text-[11px] text-slate-500 mt-0.5">
                    {interval === 5 ? 'High Frequency' : interval === 15 ? 'Recommended' : 'Standard'}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
            <div className="text-xs text-slate-500">
              {isDirty ? (
                <span className="text-amber-700 font-semibold">
                  Unsaved change: polling interval will switch from {savedInterval} min to {parsedSelected} min.
                </span>
              ) : (
                <span>Background scheduler is aligned with the active interval.</span>
              )}
            </div>

            <div className="flex items-center gap-2.5 self-end sm:self-auto">
              {isDirty && (
                <button
                  type="button"
                  onClick={() => setPollingInterval(savedInterval)}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  <RotateCcw size={13} />
                  <span>Reset</span>
                </button>
              )}
              <button
                type="submit"
                disabled={isSaving || !isDirty}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>{isSaving ? 'Saving...' : 'Save Polling Settings'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Safety & Classification Rules Reference */}
      <div className="bg-navy-900 border border-navy-800 text-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
          Classification &amp; Safety Guarantees
        </h3>
        <ul className="space-y-2.5 text-xs text-slate-300">
          <li className="flex items-start gap-2.5">
            <span className="text-emerald-400 font-bold">✓</span>
            <span>
              <strong className="text-white">Star-based only:</strong> 3, 4, and 5 stars select the Positive reply; 1 and 2 stars select the Negative reply.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="text-emerald-400 font-bold">✓</span>
            <span>
              <strong className="text-white">No dynamic AI generation:</strong> Replies never hallucinate or alter approved template text dynamically.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="text-emerald-400 font-bold">✓</span>
            <span>
              <strong className="text-white">Duplicate prevention:</strong> Idempotent composite key checks{' '}
              <code className="px-1.5 py-0.5 rounded bg-navy-800 text-blue-200 font-mono text-[11px]">
                (location_id, google_review_id)
              </code>{' '}
              before publishing.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
