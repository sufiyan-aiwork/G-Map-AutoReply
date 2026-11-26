import React, { useState } from 'react';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  LogIn,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import { api } from '../services/api';

export default function Login({ onLoginSuccess, sessionNotice }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handlePasswordKeyState = (e) => {
    if (typeof e.getModifierState === 'function') {
      setCapsLockOn(e.getModifierState('CapsLock'));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMsg('Please enter both username and password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await api.adminLogin(username.trim(), password);
      if (res?.authenticated && res?.admin) {
        onLoginSuccess(res.admin);
      } else {
        setErrorMsg('Authentication failed. Please check your credentials.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Invalid username or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen tz-login-backdrop flex flex-col justify-center items-center p-4 font-sans">
      <div className="w-full max-w-md page-enter">
        {/* Branding Header with Official TechZone Logo Slot */}
        <div className="flex flex-col items-center text-center mb-7">
          <BrandLogo size="lg" surface="dark" className="mb-4" />
          <h1 className="font-heading text-2xl font-bold text-white tracking-tight">
            TechZone Academy
          </h1>
          <p className="text-xs font-semibold text-[#00d2ff] uppercase tracking-widest mt-1">
            Review Reply Automation Admin
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl border border-white/15 overflow-hidden">
          <div className="h-1.5 w-full tz-top-accent" />

          <div className="p-7 sm:p-8">
            <div className="mb-6">
              <h2 className="font-heading text-lg font-bold text-[#1a1a2e]">
                Administrator Sign In
              </h2>
              <p className="text-xs text-[#64748b] mt-1 leading-relaxed">
                Sign in to manage Google Business Profile reviews, reply templates, and automation schedules.
              </p>
            </div>

            {(errorMsg || sessionNotice) && (
              <div
                id="login-feedback"
                role="alert"
                className={`mb-5 p-3.5 rounded-xl border flex items-start gap-2.5 text-xs font-medium page-enter ${
                  errorMsg
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                {errorMsg ? (
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
                ) : (
                  <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
                )}
                <span>{errorMsg || sessionNotice}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="admin-username"
                  className="block text-xs font-semibold text-[#1a1a2e] mb-1.5"
                >
                  Username
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    id="admin-username"
                    type="text"
                    autoComplete="username"
                    autoFocus
                    required
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    aria-invalid={Boolean(errorMsg)}
                    aria-describedby={errorMsg ? 'login-feedback' : undefined}
                    placeholder="Enter admin username"
                    disabled={isSubmitting}
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-[#1a1a2e] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#025091]/30 focus:border-[#025091] focus:bg-white transition-all duration-150 disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="admin-password"
                  className="block text-xs font-semibold text-[#1a1a2e] mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    onKeyUp={handlePasswordKeyState}
                    onKeyDown={handlePasswordKeyState}
                    aria-invalid={Boolean(errorMsg)}
                    aria-describedby={errorMsg ? 'login-feedback' : undefined}
                    placeholder="Enter password"
                    disabled={isSubmitting}
                    className="w-full pl-10 pr-10 py-2.5 text-sm bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-[#1a1a2e] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#025091]/30 focus:border-[#025091] focus:bg-white transition-all duration-150 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#025091] p-1 rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {capsLockOn && (
                  <p className="mt-1.5 text-[11px] font-medium text-amber-700 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    <span>Caps Lock is currently on</span>
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#025091] hover:bg-[#023e73] text-white rounded-xl text-sm font-bold shadow-md shadow-[#025091]/25 transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/50 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? <Loader2 size={17} className="animate-spin" /> : <LogIn size={17} />}
                <span>{isSubmitting ? 'Signing in...' : 'Sign In'}</span>
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-[#e2e8f0] flex items-center gap-2 text-[11px] text-[#64748b]">
              <ShieldCheck size={15} className="text-emerald-600 shrink-0" />
              <span>
                Protected by HttpOnly signed sessions. Background review polling runs independently.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
