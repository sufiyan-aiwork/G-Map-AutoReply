import React, { useState, useEffect } from 'react';
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
  Radio,
  Clock
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { api } from '../services/api';

export default function GoogleSettings({ onSyncReviews, isSyncing }) {
  const [googleInfo, setGoogleInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const fetchGoogleStatus = async () => {
    setIsLoading(true);
    try {
      const data = await api.getGoogleStatus();
      setGoogleInfo(data);
    } catch (err) {
      console.error('Error fetching Google status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGoogleStatus();
  }, []);

  const handleConnectGoogle = async () => {
    try {
      const { auth_url } = await api.getGoogleAuthUrl();
      if (auth_url) {
        window.location.href = auth_url;
      }
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: `Failed to initiate Google authorization: ${err.message}`,
      });
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect Techzone Academy from Google Business Profile?')) {
      return;
    }
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
    }
  };

  const isConnected = googleInfo?.is_connected;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Google Account Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Authorized connection to Techzone Academy's Google Business Profile and automated reply sync engine.
        </p>
      </div>

      {actionMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-medium ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {actionMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Main Connection Status Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              isConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
            }`}>
              <Globe2 size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Google Business Profile Integration</h2>
                <StatusBadge status={isConnected ? 'active' : 'info'} />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isConnected
                  ? 'Authorized & actively synchronizing reviews'
                  : 'Requires Google OAuth 2.0 authorization with business.manage scope'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isConnected ? (
              <>
                <button
                  onClick={onSyncReviews}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-60"
                >
                  <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                  <span>{isSyncing ? 'Synchronizing...' : 'Sync Reviews Now'}</span>
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60"
                  title="Disconnect account"
                >
                  <Unlink size={14} />
                  <span>Disconnect</span>
                </button>
              </>
            ) : (
              <button
                onClick={handleConnectGoogle}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
              >
                <ExternalLink size={14} />
                <span>Connect Google Account</span>
              </button>
            )}
          </div>
        </div>

        {/* Profile Attributes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
            <Building2 size={20} className="text-slate-500 mt-0.5 shrink-0" />
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase">Business Profile</span>
              <p className="text-sm font-bold text-slate-800 mt-0.5 truncate" title={googleInfo?.business_name || 'Techzone Academy'}>
                {googleInfo?.business_name || 'Techzone Academy'}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
            <Globe2 size={20} className="text-slate-500 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <span className="text-xs text-slate-400 font-semibold uppercase">Account ID</span>
              <p className="text-xs font-bold text-slate-800 font-mono mt-0.5 truncate" title={googleInfo?.account_id || 'Not detected'}>
                {googleInfo?.account_id || (
                  <span className="text-slate-400 font-normal italic">Auto-detect on login</span>
                )}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
            <MapPin size={20} className="text-slate-500 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <span className="text-xs text-slate-400 font-semibold uppercase">Location ID</span>
              <p className="text-xs font-bold text-slate-800 font-mono mt-0.5 truncate" title={googleInfo?.location_id || 'Not detected'}>
                {googleInfo?.location_id || (
                  <span className="text-slate-400 font-normal italic">Auto-detect on login</span>
                )}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
            <Clock size={20} className="text-slate-500 mt-0.5 shrink-0" />
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase">Last Synchronized</span>
              <p className="text-xs font-bold text-slate-800 mt-0.5">
                {googleInfo?.last_synced_at
                  ? new Date(googleInfo.last_synced_at).toLocaleTimeString() + ' (' + new Date(googleInfo.last_synced_at).toLocaleDateString() + ')'
                  : 'Pending first sync'}
              </p>
            </div>
          </div>
        </div>

        {/* API Scope and Readiness Info */}
        <div className="mt-6 p-4 rounded-xl bg-blue-50/60 border border-blue-200 text-xs text-blue-900 leading-relaxed">
          <div className="flex items-start gap-2.5">
            <ShieldCheck size={18} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-0.5">OAuth 2.0 Credentials & Scope</p>
              <p className="text-blue-800">
                Authorized for Google Business Profile API with scope <code>https://www.googleapis.com/auth/business.manage</code>.
                When configured, credentials in <code>backend/.env</code> communicate directly with Google's reviews endpoint:
                <br />
                <code className="bg-blue-100/70 px-1 py-0.5 rounded text-[11px] font-mono mt-1 inline-block">
                  PUT /accounts/{'{accountId}'}/locations/{'{locationId}'}/reviews/{'{reviewId}'}/reply
                </code>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Security & Token Policy Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Key size={16} className="text-slate-600" />
          <span>Security & Data Privacy Protections</span>
        </h3>
        <div className="space-y-3 text-xs text-slate-600">
          <div className="flex items-start gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <span><strong>No Frontend Token Exposure:</strong> Access tokens and refresh tokens are securely retained exclusively within the backend environment.</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <span><strong>Duplicate Prevention:</strong> Reviews are tracked by composite key <code>(location_id, google_review_id)</code> to ensure no duplicate replies are ever posted.</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <span><strong>Bounded Retries:</strong> Transient Google API connectivity errors employ exponential backoff with up to 3 bounded retries.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
