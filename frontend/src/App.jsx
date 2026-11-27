import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import DashboardLayout from './layouts/DashboardLayout';
import Overview from './pages/Overview';
import Reviews from './pages/Reviews';
import Templates from './pages/Templates';
import ActivityLogs from './pages/ActivityLogs';
import Settings from './pages/Settings';
import Login from './pages/Login';
import ConfirmDialog from './components/ConfirmDialog';
import { api, setUnauthorizedHandler } from './services/api';

export default function App() {
  const [adminUser, setAdminUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [sessionNotice, setSessionNotice] = useState(null);

  const [currentTab, setCurrentTab] = useState('overview');
  const [reviewsFilterPreset, setReviewsFilterPreset] = useState(null);
  const [summary, setSummary] = useState(null);
  const [summaryDays, setSummaryDays] = useState('all');
  const [reviews, setReviews] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [automationStatus, setAutomationStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const [toastMessage, setToastMessage] = useState(null);
  const [isToastExiting, setIsToastExiting] = useState(false);

  const [showResumeConfirm, setShowResumeConfirm] = useState(false);
  const [isTogglingAutomation, setIsTogglingAutomation] = useState(false);

  const activeLoadsRef = useRef(0);
  const loadDataSeqRef = useRef(0);
  const isSyncingRef = useRef(false);
  const summaryDaysRef = useRef('all');
  const summaryRequestSeqRef = useRef(0);

  useEffect(() => {
    isSyncingRef.current = isSyncing;
  }, [isSyncing]);

  useEffect(() => {
    summaryDaysRef.current = summaryDays;
  }, [summaryDays]);

  useEffect(() => {
    if (!toastMessage?.duration || isToastExiting) return undefined;
    const fadeTimer = setTimeout(() => {
      setIsToastExiting(true);
    }, toastMessage.duration);
    return () => clearTimeout(fadeTimer);
  }, [toastMessage, isToastExiting]);

  useEffect(() => {
    if (!isToastExiting) return undefined;
    const clearTimer = setTimeout(() => {
      setToastMessage(null);
      setIsToastExiting(false);
    }, 180);
    return () => clearTimeout(clearTimer);
  }, [isToastExiting]);

  const dismissToast = () => {
    setIsToastExiting(true);
  };

  const showToast = (type, text, duration = 5000) => {
    setIsToastExiting(false);
    setToastMessage({ type, text, duration, _nonce: Date.now() });
  };

  const loadData = async (isBackground = false) => {
    if (isBackground && activeLoadsRef.current > 0) return;
    activeLoadsRef.current += 1;
    const loadSeq = ++loadDataSeqRef.current;
    if (!isBackground) {
      setIsRefreshing(true);
      setErrorMessage(null);
    }
    try {
      const requestSeq = ++summaryRequestSeqRef.current;
      const requestedDays = summaryDaysRef.current;
      const [sumRes, revRes, tplRes, autoRes, logRes] = await Promise.all([
        api.getDashboardSummary(requestedDays),
        api.getReviews(),
        api.getTemplates(),
        api.getAutomationStatus(),
        api.getLogs(),
      ]);

      if (loadSeq !== loadDataSeqRef.current) return;
      if (sumRes && requestSeq === summaryRequestSeqRef.current && summaryDaysRef.current === requestedDays) {
        setSummary(sumRes);
      }
      if (revRes) setReviews(revRes);
      if (tplRes) setTemplates(tplRes);
      if (autoRes) setAutomationStatus(autoRes);
      if (logRes) setLogs(logRes);
    } catch (err) {
      console.error('Failed to load application data:', err);
      if (!isBackground && loadSeq === loadDataSeqRef.current) {
        setErrorMessage('Could not connect to backend API. Please verify the FastAPI server is running on port 8000.');
      }
    } finally {
      activeLoadsRef.current = Math.max(0, activeLoadsRef.current - 1);
      setIsInitialLoading(false);
      if (activeLoadsRef.current === 0) {
        setIsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAdminUser(null);
      setSummary(null);
      setReviews([]);
      setTemplates([]);
      setAutomationStatus(null);
      setLogs([]);
      setIsInitialLoading(true);
      setSessionNotice('Your administrator session expired or was signed out. Please sign in again.');
    });

    const params = new URLSearchParams(window.location.search);
    const authStatus = params.get('google_auth');

    if (authStatus === 'success') {
      const acc = params.get('account') || '';
      const loc = params.get('location') || '';
      const detail = loc ? `Location: ${loc}` : (acc ? `Account: ${acc}` : '');
      showToast('success', `Google Business Profile successfully connected! ${detail ? `Auto-detected ${detail}.` : ''}`, 7000);
      setCurrentTab('settings');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (authStatus === 'ambiguous_account' || authStatus === 'ambiguous_location') {
      const msg = params.get('message') || 'Multiple accounts or locations detected. Ambiguity prevented automatic selection.';
      showToast('warning', `Google OAuth Warning: ${msg}`, 8000);
      setCurrentTab('settings');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (authStatus === 'no_accounts' || authStatus === 'no_locations') {
      const msg = params.get('message') || 'No Google Business Profile account or location found.';
      showToast('error', `Notice: ${msg}`, 8000);
      setCurrentTab('settings');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (authStatus === 'error' || authStatus === 'discovery_error') {
      const msg = params.get('message') || 'Google OAuth authorization was declined or encountered an error.';
      showToast('error', `OAuth Error: ${msg}`, 8000);
      setCurrentTab('settings');
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const checkSession = async () => {
      try {
        const res = await api.getAdminSession();
        if (res?.authenticated && res?.admin) {
          setAdminUser(res.admin);
          setSessionNotice(null);
        } else {
          setAdminUser(null);
        }
      } catch {
        setAdminUser(null);
      } finally {
        setAuthChecked(true);
      }
    };

    checkSession();

    return () => {
      setUnauthorizedHandler(null);
    };
  }, []);

  useEffect(() => {
    if (!adminUser) {
      return undefined;
    }

    setIsInitialLoading(true);
    loadData();

    const intervalId = setInterval(() => {
      if (!isSyncingRef.current && activeLoadsRef.current === 0) {
        loadData(true);
      }
    }, 30000);

    return () => clearInterval(intervalId);
  }, [adminUser]);

  const handleLoginSuccess = (admin) => {
    setSessionNotice(null);
    setErrorMessage(null);
    setAdminUser(admin);
  };

  const handleLogout = async () => {
    try {
      await api.adminLogout();
    } catch {
      // Ignore network error during logout cleanup
    } finally {
      setAdminUser(null);
      setSummary(null);
      setReviews([]);
      setTemplates([]);
      setAutomationStatus(null);
      setLogs([]);
      setSessionNotice(null);
      setIsInitialLoading(true);
    }
  };

  const handlePeriodChange = async (period) => {
    const normalized = period === 'all' ? 'all' : Number(period);
    if (normalized !== 'all' && ![7, 14, 21, 30].includes(normalized)) return;
    setSummaryDays(normalized);
    summaryDaysRef.current = normalized;
    const seq = ++summaryRequestSeqRef.current;
    try {
      const sumRes = await api.getDashboardSummary(normalized);
      if (sumRes && seq === summaryRequestSeqRef.current) {
        setSummary(sumRes);
      }
    } catch (err) {
      console.error('Failed to filter dashboard summary:', err);
    }
  };

  const handleNavigate = (tab, filterPreset = null) => {
    if (tab === 'reviews') {
      setReviewsFilterPreset(filterPreset ? { ...filterPreset, _nonce: Date.now() } : null);
    }
    setCurrentTab(tab);
  };

  const executeToggleAutomation = async (enable) => {
    setIsTogglingAutomation(true);
    try {
      if (enable) {
        await api.resumeAutomation();
        showToast('success', 'Automatic reply publishing is now ACTIVE for new Google reviews.');
      } else {
        await api.pauseAutomation();
        showToast('warning', 'Automatic reply publishing is PAUSED. New reviews will be stored as pending.');
      }
      await loadData();
    } catch (err) {
      showToast('error', `Failed to update automation state: ${err.message}`);
    } finally {
      setIsTogglingAutomation(false);
      setShowResumeConfirm(false);
    }
  };

  const handleToggleAutomation = async () => {
    const currentlyEnabled = automationStatus?.auto_reply_enabled ?? false;
    if (!currentlyEnabled) {
      setShowResumeConfirm(true);
      return;
    }
    await executeToggleAutomation(false);
  };

  const handleSimulateReview = async (payload) => {
    const res = await api.simulateReview(payload);
    await loadData();
    return res;
  };

  const handleSyncReviews = async () => {
    setIsSyncing(true);
    try {
      const res = await api.syncReviewsNow();
      await loadData();
      const s = res.summary || {};
      showToast(
        'success',
        `Sync complete: ${s.new_ingested ?? 0} new ingested, ${s.duplicates_skipped ?? 0} duplicates skipped, ${s.replies_published ?? 0} published.`
      );
    } catch (err) {
      showToast('error', `Sync failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateTemplate = async (category, data) => {
    const updated = await api.updateTemplate(category, data);
    await loadData();
    return updated;
  };

  const handleUpdateAutomationSettings = async (data) => {
    const res = await api.updateAutomationSettings(data);
    await loadData();
    return res;
  };

  const renderToast = () => {
    if (!toastMessage) return null;
    const styleMap = {
      success: { bg: 'bg-emerald-50 border-emerald-200 text-emerald-900', Icon: CheckCircle2, iconColor: 'text-emerald-600' },
      warning: { bg: 'bg-amber-50 border-amber-200 text-amber-900', Icon: AlertTriangle, iconColor: 'text-amber-600' },
      error: { bg: 'bg-rose-50 border-rose-200 text-rose-900', Icon: AlertCircle, iconColor: 'text-rose-600' },
      info: { bg: 'bg-[#e8f1f8] border-[#b9d7ef] text-[#001f3f]', Icon: Info, iconColor: 'text-[#025091]' },
    };
    const cfg = styleMap[toastMessage.type] || styleMap.info;
    const Icon = cfg.Icon;

    return (
      <div
        role="status"
        aria-live="polite"
        className={`mb-5 p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm font-medium shadow-tz-card ${
          isToastExiting ? 'toast-exit' : 'toast-enter'
        } ${cfg.bg}`}
      >
        <div className="flex items-center gap-2.5">
          <Icon size={18} className={`shrink-0 ${cfg.iconColor}`} />
          <span>{toastMessage.text}</span>
        </div>
        <button
          type="button"
          onClick={dismissToast}
          aria-label="Dismiss notification"
          className="p-1 rounded-lg hover:bg-black/5 transition-colors duration-150 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40"
        >
          <X size={16} />
        </button>
      </div>
    );
  };

  const renderContent = () => {
    switch (currentTab) {
      case 'overview':
        return (
          <Overview
            summary={summary}
            reviews={reviews}
            templates={templates}
            isLoading={isInitialLoading}
            onNavigate={handleNavigate}
            onSimulateReview={handleSimulateReview}
            selectedDays={summaryDays}
            onChangePeriod={handlePeriodChange}
          />
        );
      case 'reviews':
        return (
          <Reviews
            reviews={reviews}
            templates={templates}
            isLoading={isInitialLoading}
            autoReplyEnabled={automationStatus?.auto_reply_enabled ?? false}
            initialFilter={reviewsFilterPreset}
            onRefresh={loadData}
          />
        );
      case 'templates':
        return <Templates templates={templates} isLoading={isInitialLoading} onUpdateTemplate={handleUpdateTemplate} />;
      case 'logs':
        return <ActivityLogs logs={logs} isLoading={isInitialLoading} onRefresh={loadData} isRefreshing={isRefreshing} />;
      case 'settings':
        return (
          <Settings
            automationStatus={automationStatus}
            isLoading={isInitialLoading}
            onUpdateSettings={handleUpdateAutomationSettings}
            onSyncReviews={handleSyncReviews}
            isSyncing={isSyncing}
          />
        );
      default:
        return (
          <Overview
            summary={summary}
            reviews={reviews}
            templates={templates}
            isLoading={isInitialLoading}
            onNavigate={handleNavigate}
            onSimulateReview={handleSimulateReview}
            selectedDays={summaryDays}
            onChangePeriod={handlePeriodChange}
          />
        );
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#f6f9fc] flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-4 border-[#025091] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-[#001f3f]">Verifying administrator session...</p>
        </div>
      </div>
    );
  }

  if (!adminUser) {
    return <Login onLoginSuccess={handleLoginSuccess} sessionNotice={sessionNotice} />;
  }

  return (
    <DashboardLayout
      currentTab={currentTab}
      onSelectTab={(tab) => handleNavigate(tab)}
      autoReplyEnabled={automationStatus?.auto_reply_enabled ?? false}
      pollingInterval={automationStatus?.polling_interval_minutes ?? summary?.polling_interval ?? 15}
      onToggleAutomation={handleToggleAutomation}
      onRefresh={() => loadData(false)}
      onSyncReviews={handleSyncReviews}
      isRefreshing={isRefreshing}
      isSyncing={isSyncing}
      businessName={summary?.business_name || 'TechZone Academy'}
      adminUser={adminUser}
      onLogout={handleLogout}
    >
      {renderToast()}

      {errorMessage && (
        <div className="mb-5 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between gap-4 shadow-tz-card page-enter">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={18} className="text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => loadData(false)}
            className="px-3.5 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-xl font-semibold text-xs transition-all duration-150 active:scale-[0.98] shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
          >
            Retry
          </button>
        </div>
      )}

      {renderContent()}

      <ConfirmDialog
        isOpen={showResumeConfirm}
        title="Enable Automatic Reply Publishing?"
        description="When resumed, newly discovered Google Business Profile reviews will automatically receive predefined replies based on their 1–5 star rating during polling cycles. Existing reviews remain skipped."
        confirmLabel="Resume Auto-Replies"
        variant="success"
        isLoading={isTogglingAutomation}
        onConfirm={() => executeToggleAutomation(true)}
        onCancel={() => setShowResumeConfirm(false)}
      />
    </DashboardLayout>
  );
}
