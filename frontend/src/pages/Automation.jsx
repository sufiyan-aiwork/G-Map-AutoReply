import React, { useState, useEffect } from 'react';
import { Sliders, Play, Pause, Clock, ShieldCheck, CheckCircle2, AlertTriangle, Save } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

export default function Automation({
  automationStatus,
  onToggleAutomation,
  onUpdateSettings
}) {
  const [pollingInterval, setPollingInterval] = useState(15);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  useEffect(() => {
    if (automationStatus?.polling_interval_minutes) {
      setPollingInterval(automationStatus.polling_interval_minutes);
    }
  }, [automationStatus]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await onUpdateSettings({
        polling_interval: parseInt(pollingInterval, 10),
      });
      setSaveMessage({
        type: 'success',
        text: 'Automation polling interval updated successfully!',
      });
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (err) {
      setSaveMessage({
        type: 'error',
        text: err.message || 'Failed to update automation settings',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isEnabled = automationStatus?.auto_reply_enabled ?? true;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Automation Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage automatic reply publishing triggers, review synchronization frequency, and system safety states.
        </p>
      </div>

      {saveMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-medium ${
            saveMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {saveMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{saveMessage.text}</span>
        </div>
      )}

      {/* Master Toggle Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">Automatic Review Reply System</h2>
              <StatusBadge status={isEnabled ? 'active' : 'paused'} />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              When enabled, incoming Google reviews are automatically categorized by star rating and predefined replies are published.
            </p>
          </div>

          <button
            onClick={onToggleAutomation}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold shadow-sm transition-all ${
              isEnabled
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {isEnabled ? (
              <>
                <Pause size={16} />
                <span>Pause Auto-Replies</span>
              </>
            ) : (
              <>
                <Play size={16} />
                <span>Resume Auto-Replies</span>
              </>
            )}
          </button>
        </div>

        {/* Informational alert about pause behavior */}
        <div className={`mt-5 p-4 rounded-xl border text-xs leading-relaxed ${
          isEnabled
            ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
            : 'bg-amber-50/60 border-amber-200 text-amber-900'
        }`}>
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
                  ? 'All newly collected reviews will have their predefined replies automatically dispatched to Google Business Profile according to their 1-5 star ratings.'
                  : 'Automatic publishing is currently PAUSED. New customer reviews will continue to be collected into Supabase with "pending" status, but no replies will be dispatched to Google until you resume.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Polling Interval & Scheduler Config */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Clock size={18} className="text-blue-600" />
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Review Polling Frequency
          </h2>
        </div>
        <p className="text-xs text-slate-500 mb-6">
          Set how frequently the background service checks Techzone Academy's Google Business Profile for new student reviews.
        </p>

        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[5, 15, 30, 60].map((interval) => (
              <label
                key={interval}
                className={`p-4 rounded-xl border cursor-pointer flex flex-col items-center text-center transition-all ${
                  parseInt(pollingInterval, 10) === interval
                    ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100/70'
                }`}
              >
                <input
                  type="radio"
                  name="pollingInterval"
                  value={interval}
                  checked={parseInt(pollingInterval, 10) === interval}
                  onChange={(e) => setPollingInterval(e.target.value)}
                  className="sr-only"
                />
                <span className="text-lg font-bold text-slate-800">{interval} min</span>
                <span className="text-[11px] text-slate-500 mt-1">
                  {interval === 5 ? 'High Frequency' : interval === 15 ? 'Recommended' : 'Standard'}
                </span>
              </label>
            ))}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-60"
            >
              <Save size={14} />
              <span>{isSaving ? 'Saving...' : 'Save Polling Settings'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Safety & Classification Rules Reference */}
      <div className="bg-slate-900 text-slate-300 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
          Classification & Safety Guarantees
        </h3>
        <ul className="space-y-2 text-xs text-slate-400">
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 font-bold">✓</span>
            <span><strong>Star-based only:</strong> 3, 4, and 5 stars select the Positive reply; 1 and 2 stars select the Negative reply.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 font-bold">✓</span>
            <span><strong>No dynamic AI generation:</strong> Replies never hallucinate or change text dynamically.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 font-bold">✓</span>
            <span><strong>Duplicate prevention:</strong> Idempotent key checks <code>(location_id, google_review_id)</code> before publishing.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
