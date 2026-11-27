import React, { useState, useEffect, useRef } from 'react';
import {
  Globe2,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Key,
  Building2,
  MapPin,
  ExternalLink,
  Unlink,
  Clock,
  Copy,
  Check,
  X
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { CardSkeleton } from '../components/SkeletonLoader';
import { api } from '../services/api';
import { formatSafeTimeAndDate } from '../utils/dateUtils';

export default function GoogleSettings({ onSyncReviews, isSyncing }) {
  const [googleInfo, setGoogleInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const copyTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const fetchGoogleStatus = async () => {
    setIsLoading(true);
    try {
      const data = await api.getGoogleStatus();
      setGoogleInfo(data);
    } catch (err) {
      console.error('Error fetching Google status:', err);
      setActionMessage({
        type: 'error',
        text: `Failed to fetch Google Business Profile status: ${err.message || 'Backend error'}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGoogleStatus();
  }, []);

  const handleConnectGoogle = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    setActionMessage(null);
    try {
      const res = await api.getGoogleAuthUrl();
      const authUrl = res?.auth_url;
      if (!authUrl || !/^https?:\/\//i.test(authUrl)) {
        throw new Error('Backend did not return a valid Google authorization URL.');
      }
      window.location.href = authUrl;
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: `Failed to initiate Google authorization: ${err.message}`,
      });
      setIsConnecting(false);
    }
  };

  const handleConfirmDisconnect = async () => {
    setIsDisconnecting(true);
    setActionMessage(null);
    try {
      await api.disconnectGoogle();
      await fetchGoogleStatus();
      setActionMessage({
        type: 'success',
        text: 'Google Business Profile successfully disconnected.',
      });
    } catch (err) {
      setActionMessage({
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

  if (isLoading && !googleInfo) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-72 rounded-xl skeleton-shimmer" />
        <CardSkeleton height="h-72" />
        <CardSkeleton height="h-44" />
      </div>
    );
  }

  const isConnected = Boolean(googleInfo?.is_connected);

  return (
    <div className="space-y-6 page-enter">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#1a1a2e] tracking-tight">
            Google Business Settings
          </h1>
          <p className="text-sm text-[#64748b] mt-1">
            Authorized connection to TechZone Academy&apos;s Google Business Profile and automated reply sync engine.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchGoogleStatus}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#e2e8f0] hover:border-[#b9d7ef] hover:bg-[#eff6fb] text-[#1a1a2e] rounded-xl text-xs font-semibold shadow-tz-card transition-all duration-150 active:scale-[0.98] self-start sm:self-auto disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40"
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin text-[#025091]' : ''} />
          <span>Refresh Connection</span>
        </button>
      </div>

      {actionMessage && (
        <div
          role="status"
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm font-medium shadow-tz-card toast-enter ${actionMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
        >
          <div className="flex items-center gap-2.5">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle size={18} className="text-rose-600 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            aria-label="Dismiss notification"
            className="p-1 rounded-lg hover:bg-black/5 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main Connection Status Card */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-tz-card overflow-hidden">
        <div className="h-1 w-full tz-top-accent" />
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#e2e8f0]">
            <div className="flex items-center gap-3.5">
              <div
                className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${isConnected
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                    : 'bg-[#e8f1f8] text-[#025091] border-[#b9d7ef]'
                  }`}
              >
                <Globe2 size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="font-heading text-base font-bold text-[#1a1a2e]">
                    Google Business Profile Integration
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

            <div className="flex items-center gap-2.5 self-start sm:self-auto">
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
                  disabled={isConnecting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#025091] hover:bg-[#023e73] text-white rounded-xl text-xs font-bold shadow-sm transition-all duration-150 active:scale-[0.98] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40"
                >
                  <ExternalLink size={14} />
                  <span>{isConnecting ? 'Redirecting...' : 'Connect Google Account'}</span>
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

          {/* API Scope and Readiness Info */}
          <div className="mt-6 p-4 rounded-xl bg-[#eff6fb] border border-[#b9d7ef] text-xs text-[#1a1a2e] leading-relaxed">
            <div className="flex items-start gap-2.5">
              <ShieldCheck size={18} className="text-[#025091] shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-[#001f3f] mb-0.5">OAuth 2.0 Credentials &amp; Scope</p>
                <p className="text-[#023e73]">
                  Authorized for Google Business Profile API with scope{' '}
                  <code className="font-mono bg-white/90 px-1.5 py-0.5 rounded border border-[#b9d7ef] text-[11px]">
                    https://www.googleapis.com/auth/business.manage
                  </code>
                  . Reply dispatches call Google&apos;s official review reply endpoint:
                  <br />
                  <code className="bg-white/90 px-1.5 py-0.5 rounded border border-[#b9d7ef] text-[11px] font-mono mt-1.5 inline-block">
                    PUT /accounts/{'{accountId}'}/locations/{'{locationId}'}/reviews/{'{reviewId}'}/reply
                  </code>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security & Token Policy Card */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 shadow-tz-card">
        <h3 className="font-heading text-xs font-bold text-[#1a1a2e] uppercase tracking-wider mb-4 flex items-center gap-2">
          <Key size={15} className="text-[#025091]" />
          <span>Security &amp; Data Privacy Protections</span>
        </h3>
        <div className="space-y-3 text-xs text-[#64748b]">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong className="text-[#1a1a2e]">No Frontend Token Exposure:</strong> Access tokens and refresh tokens remain stored exclusively on the backend.
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong className="text-[#1a1a2e]">Duplicate Prevention:</strong> Reviews are keyed on{' '}
              <code className="font-mono text-[11px] bg-[#f1f5f9] px-1 py-0.5 rounded border border-[#e2e8f0]">
                (location_id, google_review_id)
              </code>{' '}
              so no duplicate replies are ever posted.
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong className="text-[#1a1a2e]">Bounded Retries:</strong> Transient Google API connectivity errors use bounded retries without dropping audit visibility.
            </span>
          </div>
        </div>
      </div>

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
