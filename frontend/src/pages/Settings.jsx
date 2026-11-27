import React, { useState, useEffect, useRef } from 'react';
import {
  Globe2,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Key,
  Building2,
  MapPin,
  ExternalLink,
  Unlink,
  Clock,
  Copy,
  Check,
  Save,
  RotateCcw,
  Loader2,
  X
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { CardSkeleton } from '../components/SkeletonLoader';
import { api } from '../services/api';
import { formatSafeTimeAndDate } from '../utils/dateUtils';

export default function Settings({
  automationStatus,
  isLoading: isParentLoading,
  onUpdateSettings,
  onSyncReviews,
  isSyncing,
}) {
  // Google Business Profile state
  const [googleInfo, setGoogleInfo] = useState(null);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(true);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [googleActionMsg, setGoogleActionMsg] = useState(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  // Review Synchronization / Polling Frequency state
  const savedInterval = Number(automationStatus?.polling_interval_minutes) || 15;
  const [pollingInterval, setPollingInterval] = useState(savedInterval);
  const [isSavingPolling, setIsSavingPolling] = useState(false);
  const [pollingSaveMsg, setPollingSaveMsg] = useState(null);

  const parsedSelected = Number.isFinite(parseInt(pollingInterval, 10))
    ? parseInt(pollingInterval, 10)
    : savedInterval;
  const isDirty = parsedSelected !== savedInterval;

  const isDirtyRef = useRef(false);
  const copyTimerRef = useRef(null);
  const pollingMsgTimerRef = useRef(null);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      if (pollingMsgTimerRef.current) clearTimeout(pollingMsgTimerRef.current);
    };
  }, []);

  const fetchGoogleStatus = async () => {
    setIsLoadingGoogle(true);
    try {
      const data = await api.getGoogleStatus();
      setGoogleInfo(data);
    } catch (err) {
      console.error('Error fetching Google status:', err);
      setGoogleActionMsg({
        type: 'error',
        text: `Failed to verify Google Business Profile status: ${err.message || 'Backend error'}`,
      });
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  useEffect(() => {
    fetchGoogleStatus();
  }, []);

  useEffect(() => {
    if (automationStatus?.polling_interval_minutes != null && !isDirtyRef.current) {
      setPollingInterval(Number(automationStatus.polling_interval_minutes) || 15);
    }
  }, [automationStatus?.polling_interval_minutes]);

  const handleConnectGoogle = async () => {
    if (isConnectingGoogle) return;
    setIsConnectingGoogle(true);
    setGoogleActionMsg(null);
    try {
      const res = await api.getGoogleAuthUrl();
      const authUrl = res?.auth_url;
      if (!authUrl || !/^https?:\/\//i.test(authUrl)) {
        throw new Error('Backend did not return a valid Google authorization URL.');
      }
      window.location.href = authUrl;
    } catch (err) {
      setGoogleActionMsg({
        type: 'error',
        text: `Failed to initiate Google authorization: ${err.message}`,
      });
      setIsConnectingGoogle(false);
    }
  };

  const handleConfirmDisconnect = async () => {
    setIsDisconnecting(true);
    setGoogleActionMsg(null);
    try {
      await api.disconnectGoogle();
      await fetchGoogleStatus();
      setGoogleActionMsg({
        type: 'success',
        text: 'Google Business Profile successfully disconnected.',
      });
    } catch (err) {
      setGoogleActionMsg({
        type: 'error',
        text: err.message || 'Failed to disconnect account',
      });
    } finally {
      setIsDisconnecting(false);
      setShowDisconnectConfirm(false);
    }
  };

  const handleSyncNow = async () => {
    if (!onSyncReviews) return;
    await onSyncReviews();
    await fetchGoogleStatus();
  };

  const handleCopyId = async (field, value) => {
    if (!value) return;
    try {
      await navigator.clipboard?.writeText(value);
      setCopiedField(field);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Clipboard write unavailable in non-secure context
    }
  };

  const handleSavePolling = async (e) => {
    e.preventDefault();
    if (!isDirty || !onUpdateSettings || !Number.isFinite(parsedSelected) || parsedSelected < 1) return;
    setIsSavingPolling(true);
    setPollingSaveMsg(null);
    try {
      await onUpdateSettings({
        polling_interval: parsedSelected,
      });
      isDirtyRef.current = false;
      setPollingSaveMsg({
        type: 'success',
        text: `Review polling interval updated to every ${parsedSelected} minutes.`,
      });
      if (pollingMsgTimerRef.current) clearTimeout(pollingMsgTimerRef.current);
      pollingMsgTimerRef.current = setTimeout(() => setPollingSaveMsg(null), 5000);
    } catch (err) {
      setPollingSaveMsg({
        type: 'error',
        text: err.message || 'Failed to update synchronization settings',
      });
    } finally {
      setIsSavingPolling(false);
    }
  };

  if (isParentLoading && !automationStatus) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-72 rounded-xl skeleton-shimmer" />
        <CardSkeleton height="h-72" />
        <CardSkeleton height="h-60" />
        <CardSkeleton height="h-44" />
      </div>
    );
  }

  const isConnected = Boolean(googleInfo?.is_connected);

  return (
    <div className="space-y-6 page-enter">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#1a1a2e] tracking-tight">
            Settings
          </h1>
          <p className="text-sm text-[#64748b] mt-1">
            Manage Google Business Profile connectivity, review synchronization cadence, and automation safety rules.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchGoogleStatus}
          disabled={isLoadingGoogle}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#e2e8f0] hover:border-[#b9d7ef] hover:bg-[#eff6fb] text-[#1a1a2e] rounded-xl text-xs font-semibold shadow-tz-card transition-all duration-150 active:scale-[0.98] self-start sm:self-auto disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40"
        >
          <RefreshCw size={13} className={isLoadingGoogle ? 'animate-spin text-[#025091]' : ''} />
          <span>Refresh Connection</span>
        </button>
      </div>

      {/* SECTION A: Google Business Profile */}
      <section aria-labelledby="settings-google-heading" className="space-y-4">
        {googleActionMsg && (
          <div
            role="status"
            className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm font-medium shadow-tz-card toast-enter ${
              googleActionMsg.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {googleActionMsg.type === 'success' ? (
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle size={18} className="text-rose-600 shrink-0" />
              )}
              <span>{googleActionMsg.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setGoogleActionMsg(null)}
              aria-label="Dismiss notification"
              className="p-1 rounded-lg hover:bg-black/5 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {isLoadingGoogle && !googleInfo ? (
          <CardSkeleton height="h-72" />
        ) : (
        <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-tz-card overflow-hidden">
          <div className="h-1 w-full tz-top-accent" />
          <div className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#e2e8f0]">
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${
                    isConnected
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                      : 'bg-[#e8f1f8] text-[#025091] border-[#b9d7ef]'
                  }`}
                >
                  <Globe2 size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 id="settings-google-heading" className="font-heading text-base font-bold text-[#1a1a2e]">
                      Google Business Profile
                    </h2>
                    <StatusBadge status={isConnected ? 'connected' : 'disconnected'} />
                  </div>
                  <p className="text-xs text-[#64748b] mt-1">
                    {isConnected
                      ? 'Authorized & actively synchronizing customer reviews'
                      : 'Requires Google OAuth 2.0 authorization with business.manage scope'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
                {isConnected ? (
                  <>
                    <button
                      type="button"
                      onClick={handleSyncNow}
                      disabled={isSyncing}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#025091] hover:bg-[#023e73] text-white rounded-xl text-xs font-semibold shadow-sm transition-all duration-150 active:scale-[0.98] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40"
                    >
                      <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                      <span>{isSyncing ? 'Synchronizing...' : 'Sync Reviews Now'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleConnectGoogle}
                      disabled={isConnectingGoogle}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-[#eff6fb] border border-[#b9d7ef] hover:bg-[#d7e5f3] text-[#025091] rounded-xl text-xs font-semibold transition-all duration-150 active:scale-[0.98] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40"
                    >
                      <ExternalLink size={14} />
                      <span>{isConnectingGoogle ? 'Redirecting...' : 'Reconnect'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDisconnectConfirm(true)}
                      disabled={isDisconnecting}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-[#e2e8f0] hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 text-[#1a1a2e] rounded-xl text-xs font-semibold transition-all duration-150 active:scale-[0.98] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                    >
                      <Unlink size={14} />
                      <span>Disconnect</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleConnectGoogle}
                    disabled={isConnectingGoogle}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#025091] hover:bg-[#023e73] text-white rounded-xl text-xs font-bold shadow-sm transition-all duration-150 active:scale-[0.98] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40"
                  >
                    <ExternalLink size={14} />
                    <span>{isConnectingGoogle ? 'Redirecting...' : 'Connect Google Account'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Profile Attributes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              <div className="p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] flex items-start gap-3">
                <Building2 size={19} className="text-[#025091] mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[11px] text-[#64748b] font-semibold uppercase tracking-wider">
                    Business Profile
                  </span>
                  <p
                    className="text-sm font-bold text-[#1a1a2e] mt-0.5 truncate"
                    title={googleInfo?.business_name || 'TechZone Academy'}
                  >
                    {googleInfo?.business_name || 'TechZone Academy'}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 min-w-0">
                  <Globe2 size={19} className="text-[#025091] mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[11px] text-[#64748b] font-semibold uppercase tracking-wider">
                      Account ID
                    </span>
                    <p
                      className="text-xs font-bold text-[#1a1a2e] font-mono mt-0.5 truncate tabular-nums"
                      title={googleInfo?.account_id || 'Not detected'}
                    >
                      {googleInfo?.account_id || (
                        <span className="text-[#64748b] font-normal italic font-sans">Auto-detect on login</span>
                      )}
                    </p>
                  </div>
                </div>
                {googleInfo?.account_id && (
                  <button
                    type="button"
                    onClick={() => handleCopyId('account', googleInfo.account_id)}
                    aria-label="Copy Google Account ID"
                    className="p-1.5 text-slate-400 hover:text-[#025091] hover:bg-[#e8f1f8] rounded-lg transition-colors shrink-0"
                  >
                    {copiedField === 'account' ? (
                      <Check size={13} className="text-emerald-600" />
                    ) : (
                      <Copy size={13} />
                    )}
                  </button>
                )}
              </div>

              <div className="p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 min-w-0">
                  <MapPin size={19} className="text-[#025091] mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[11px] text-[#64748b] font-semibold uppercase tracking-wider">
                      Location ID
                    </span>
                    <p
                      className="text-xs font-bold text-[#1a1a2e] font-mono mt-0.5 truncate tabular-nums"
                      title={googleInfo?.location_id || 'Not detected'}
                    >
                      {googleInfo?.location_id || (
                        <span className="text-[#64748b] font-normal italic font-sans">Auto-detect on login</span>
                      )}
                    </p>
                  </div>
                </div>
                {googleInfo?.location_id && (
                  <button
                    type="button"
                    onClick={() => handleCopyId('location', googleInfo.location_id)}
                    aria-label="Copy Google Location ID"
                    className="p-1.5 text-slate-400 hover:text-[#025091] hover:bg-[#e8f1f8] rounded-lg transition-colors shrink-0"
                  >
                    {copiedField === 'location' ? (
                      <Check size={13} className="text-emerald-600" />
                    ) : (
                      <Copy size={13} />
                    )}
                  </button>
                )}
              </div>

              <div className="p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] flex items-start gap-3">
                <Clock size={19} className="text-[#025091] mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[11px] text-[#64748b] font-semibold uppercase tracking-wider">
                    Last Synchronized
                  </span>
                  <p className="text-xs font-bold text-[#1a1a2e] mt-0.5 tabular-nums">
                    {formatSafeTimeAndDate(googleInfo?.last_synced_at, 'Pending first sync')}
                  </p>
                </div>
              </div>
            </div>

            {/* OAuth Scope & Security Info */}
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#eff6fb] border border-[#b9d7ef] text-xs text-[#1a1a2e] leading-relaxed">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck size={18} className="text-[#025091] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-[#001f3f] mb-1">OAuth 2.0 Credentials &amp; Scope</p>
                    <p className="text-[#023e73]">
                      Authorized for Google Business Profile API with scope{' '}
                      <code className="font-mono bg-white/90 px-1.5 py-0.5 rounded border border-[#b9d7ef] text-[11px]">
                        https://www.googleapis.com/auth/business.manage
                      </code>
                      . Reply dispatches target Google&apos;s official review reply endpoint:
                    </p>
                    <code className="bg-white/90 px-1.5 py-0.5 rounded border border-[#b9d7ef] text-[11px] font-mono mt-1.5 inline-block break-all">
                      PUT /accounts/{'{accountId}'}/locations/{'{locationId}'}/reviews/{'{reviewId}'}/reply
                    </code>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] space-y-2.5 text-xs text-[#64748b]">
                <div className="font-bold text-[#1a1a2e] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Key size={14} className="text-[#025091]" />
                  <span>Security &amp; Data Privacy Protections</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-[#1a1a2e]">No Frontend Token Exposure:</strong> Access and refresh tokens remain exclusively on the backend.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-[#1a1a2e]">Bounded Retries:</strong> Transient API connectivity errors use bounded retries without dropping audit visibility.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}
      </section>

      {/* SECTION B: Review Synchronization */}
      <section aria-labelledby="settings-sync-heading" className="space-y-4">
        {pollingSaveMsg && (
          <div
            role="status"
            className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm font-medium shadow-tz-card toast-enter ${
              pollingSaveMsg.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {pollingSaveMsg.type === 'success' ? (
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle size={18} className="text-rose-600 shrink-0" />
              )}
              <span>{pollingSaveMsg.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setPollingSaveMsg(null)}
              aria-label="Dismiss notification"
              className="p-1 rounded-lg hover:bg-black/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-tz-card overflow-hidden">
          <div className="h-1 w-full tz-top-accent" />
          <div className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-[#025091]" />
                <h2 id="settings-sync-heading" className="font-heading text-base font-bold text-[#1a1a2e]">
                  Review Synchronization
                </h2>
              </div>
              <span className="text-xs font-semibold text-[#64748b] tabular-nums">
                Current: Every {savedInterval} min
              </span>
            </div>
            <p className="text-xs text-[#64748b] mb-6">
              Configure how frequently the background scheduler checks TechZone Academy&apos;s Google Business Profile for new reviews.
            </p>

            <form onSubmit={handleSavePolling} className="space-y-6">
              <div
                className="grid grid-cols-2 sm:grid-cols-4 gap-4"
                role="radiogroup"
                aria-label="Polling interval options"
              >
                {[5, 15, 30, 60].map((interval) => {
                  const isSelected = parsedSelected === interval;
                  const isSavedOption = savedInterval === interval;
                  return (
                    <label
                      key={interval}
                      className={`relative p-4 rounded-xl border cursor-pointer flex flex-col items-center text-center transition-all duration-150 active:scale-[0.99] focus-within:ring-2 focus-within:ring-[#025091]/40 ${
                        isSelected
                          ? 'border-[#025091] bg-[#e8f1f8] ring-2 ring-[#025091]/20 shadow-sm'
                          : 'border-[#e2e8f0] bg-[#f8fafc] hover:bg-[#eff6fb] hover:border-[#b9d7ef]'
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
                        <span className="mb-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-[#001f3f] text-[#00d2ff]">
                          Active
                        </span>
                      )}
                      <span className="font-heading text-lg font-bold text-[#1a1a2e] tabular-nums">
                        {interval} min
                      </span>
                      <span className="text-[11px] text-[#64748b] mt-0.5">
                        {interval === 5 ? 'High Frequency' : interval === 15 ? 'Recommended' : 'Standard'}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[#e2e8f0]">
                <div className="text-xs text-[#64748b]">
                  {isDirty ? (
                    <span className="text-amber-700 font-semibold">
                      Unsaved change: polling interval will switch from {savedInterval} min to {parsedSelected} min.
                    </span>
                  ) : (
                    <span>Background scheduler runs independently of administrator browser sessions.</span>
                  )}
                </div>

                <div className="flex items-center gap-2.5 self-end sm:self-auto">
                  {isDirty && (
                    <button
                      type="button"
                      onClick={() => setPollingInterval(savedInterval)}
                      disabled={isSavingPolling}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-[#e2e8f0] hover:bg-[#eff6fb] text-[#1a1a2e] rounded-xl text-xs font-semibold transition-all duration-150 active:scale-[0.98] disabled:opacity-50"
                    >
                      <RotateCcw size={13} />
                      <span>Reset</span>
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSavingPolling || !isDirty}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#025091] hover:bg-[#023e73] text-white rounded-xl text-xs font-semibold shadow-sm transition-all duration-150 active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40 focus-visible:ring-offset-1"
                  >
                    {isSavingPolling ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    <span>{isSavingPolling ? 'Saving...' : 'Save Polling Settings'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* SECTION C: Automation Configuration & Safety Rules */}
      <section aria-labelledby="settings-automation-rules-heading">
        <div className="bg-[#001f3f] border border-[#012b55] text-slate-200 rounded-2xl p-6 shadow-tz-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <h2
              id="settings-automation-rules-heading"
              className="font-heading text-xs font-bold text-white uppercase tracking-wider"
            >
              Automation Configuration &amp; Safety Guarantees
            </h2>
            <span className="text-[11px] text-[#00d2ff] font-medium">
              Auto-Reply Active/Paused is controlled in the top navbar
            </span>
          </div>
          <ul className="space-y-2.5 text-xs text-slate-300">
            <li className="flex items-start gap-2.5">
              <span className="text-[#00e676] font-bold">✓</span>
              <span>
                <strong className="text-white">Star-based classification:</strong> 3, 4, and 5 stars select the Positive template; 1 and 2 stars select the Negative template.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-[#00e676] font-bold">✓</span>
              <span>
                <strong className="text-white">Fixed predefined templates:</strong> Replies never generate or mutate unapproved text dynamically.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-[#00e676] font-bold">✓</span>
              <span>
                <strong className="text-white">Duplicate prevention:</strong> Idempotent composite key checks{' '}
                <code className="px-1.5 py-0.5 rounded bg-[#012b55] text-[#00d2ff] font-mono text-[11px] border border-[#025091]/40">
                  (location_id, google_review_id)
                </code>{' '}
                ensure no review receives duplicate replies.
              </span>
            </li>
          </ul>
        </div>
      </section>

      <ConfirmDialog
        isOpen={showDisconnectConfirm}
        title="Disconnect Google Business Profile?"
        description="Disconnecting revokes live review synchronization and automatic reply publishing for TechZone Academy until an administrator reconnects via Google OAuth 2.0."
        confirmLabel="Disconnect Account"
        variant="danger"
        isLoading={isDisconnecting}
        onConfirm={handleConfirmDisconnect}
        onCancel={() => setShowDisconnectConfirm(false)}
      />
    </div>
  );
}
