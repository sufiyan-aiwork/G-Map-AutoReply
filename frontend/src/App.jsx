import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from './layouts/DashboardLayout';
import Overview from './pages/Overview';
import Reviews from './pages/Reviews';
import Templates from './pages/Templates';
import Analytics from './pages/Analytics';
import Automation from './pages/Automation';
import ActivityLogs from './pages/ActivityLogs';
import GoogleSettings from './pages/GoogleSettings';
import Login from './pages/Login';
import { api, setUnauthorizedHandler } from './services/api';

export default function App() {
  const [adminUser, setAdminUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [sessionNotice, setSessionNotice] = useState(null);

  const [currentTab, setCurrentTab] = useState('overview');
  const [summary, setSummary] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [automationStatus, setAutomationStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const isRefreshingRef = useRef(false);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    isSyncingRef.current = isSyncing;
  }, [isSyncing]);

  const loadData = async (isBackground = false) => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    if (!isBackground) {
      setIsRefreshing(true);
      setErrorMessage(null);
    }
    try {
      const [sumRes, revRes, tplRes, autoRes, logRes] = await Promise.all([
        api.getDashboardSummary(),
        api.getReviews(),
        api.getTemplates(),
        api.getAutomationStatus(),
        api.getLogs(),
      ]);

      if (sumRes) setSummary(sumRes);
      if (revRes) setReviews(revRes);
      if (tplRes) setTemplates(tplRes);
      if (autoRes) setAutomationStatus(autoRes);
      if (logRes) setLogs(logRes);
    } catch (err) {
      console.error('Failed to load application data:', err);
      if (!isBackground) {
        setErrorMessage('Could not connect to backend API. Please make sure the FastAPI server is running on port 8000.');
      }
    } finally {
      isRefreshingRef.current = false;
      if (!isBackground) {
        setIsRefreshing(false);
      }
    }
  };

  // Startup: register global 401 handler, inspect OAuth redirect params, and check admin session
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAdminUser(null);
      setSessionNotice('Your session has expired or is unauthorized. Please sign in again.');
    });

    const params = new URLSearchParams(window.location.search);
    const authStatus = params.get('google_auth');
    if (authStatus === 'success') {
      const acc = params.get('account') || '';
      const loc = params.get('location') || '';
      const detail = loc ? `Location: ${loc}` : (acc ? `Account: ${acc}` : '');
      setToastMessage({
        type: 'success',
        text: `Google Business Profile successfully connected! ${detail ? `Auto-detected ${detail}.` : ''}`,
      });
      setCurrentTab('google');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (authStatus === 'ambiguous_account' || authStatus === 'ambiguous_location') {
      const msg = params.get('message') || 'Multiple accounts or locations detected. Ambiguity prevented automatic selection.';
      setToastMessage({
        type: 'warning',
        text: `Google OAuth Warning: ${msg}`,
      });
      setCurrentTab('google');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (authStatus === 'no_accounts' || authStatus === 'no_locations') {
      const msg = params.get('message') || 'No Google Business Profile account or location found.';
      setToastMessage({
        type: 'error',
        text: `Notice: ${msg}`,
      });
      setCurrentTab('google');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (authStatus === 'error' || authStatus === 'discovery_error') {
      const msg = params.get('message') || 'Google OAuth authorization was declined or encountered an error.';
      setToastMessage({
        type: 'error',
        text: `OAuth Error: ${msg}`,
      });
      setCurrentTab('google');
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

    return () => setUnauthorizedHandler(null);
  }, []);

  // Load dashboard data and run 30s background polling ONLY when authenticated
  useEffect(() => {
    if (!adminUser) {
      return undefined;
    }

    loadData();

    const intervalId = setInterval(() => {
      if (!isSyncingRef.current && !isRefreshingRef.current) {
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
    }
  };

  const handleToggleAutomation = async () => {
    try {
      const currentlyEnabled = automationStatus?.auto_reply_enabled ?? true;
      if (currentlyEnabled) {
        await api.pauseAutomation();
      } else {
        await api.resumeAutomation();
      }
      await loadData();
    } catch (err) {
      alert(`Error toggling automation: ${err.message}`);
    }
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
      setToastMessage({
        type: 'success',
        text: `Sync complete: ${s.new_ingested ?? 0} new reviews ingested, ${s.replies_published ?? 0} replies published to Google.`,
      });
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err) {
      setToastMessage({
        type: 'error',
        text: `Sync failed: ${err.message}`,
      });
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

  const renderContent = () => {
    switch (currentTab) {
      case 'overview':
        return (
          <Overview
            summary={summary}
            reviews={reviews}
            onNavigate={setCurrentTab}
            onSimulateReview={handleSimulateReview}
          />
        );
      case 'reviews':
        return <Reviews reviews={reviews} templates={templates} onRefresh={loadData} />;
      case 'templates':
        return <Templates templates={templates} onUpdateTemplate={handleUpdateTemplate} />;
      case 'analytics':
        return <Analytics summary={summary} />;
      case 'automation':
        return (
          <Automation
            automationStatus={automationStatus}
            onToggleAutomation={handleToggleAutomation}
            onUpdateSettings={handleUpdateAutomationSettings}
          />
        );
      case 'logs':
        return <ActivityLogs logs={logs} onRefresh={loadData} isRefreshing={isRefreshing} />;
      case 'google':
        return (
          <GoogleSettings
            onSyncReviews={handleSyncReviews}
            isSyncing={isSyncing}
          />
        );
      default:
        return (
          <Overview
            summary={summary}
            reviews={reviews}
            onNavigate={setCurrentTab}
            onSimulateReview={handleSimulateReview}
          />
        );
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Verifying administrator session...</p>
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
      onSelectTab={setCurrentTab}
      autoReplyEnabled={automationStatus?.auto_reply_enabled ?? true}
      onToggleAutomation={handleToggleAutomation}
      onRefresh={loadData}
      onSyncReviews={handleSyncReviews}
      isRefreshing={isRefreshing}
      isSyncing={isSyncing}
      businessName={summary?.business_name || 'Techzone Academy'}
      adminUser={adminUser}
      onLogout={handleLogout}
    >
      {toastMessage && (
        <div
          className={`mb-6 p-4 rounded-xl border flex items-center justify-between text-sm font-medium shadow-xs transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-xs font-semibold px-2 py-0.5 rounded hover:bg-black/5"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            onClick={loadData}
            className="px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded font-semibold text-xs transition-colors"
          >
            Retry
          </button>
        </div>
      )}
      {renderContent()}
    </DashboardLayout>
  );
}
