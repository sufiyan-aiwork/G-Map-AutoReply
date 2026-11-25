import React from 'react';

export default function StatusBadge({ status = 'pending' }) {
  const normStatus = (status || 'pending').toLowerCase();

  const getStyle = () => {
    switch (normStatus) {
      case 'published':
      case 'success':
      case 'active':
      case 'connected':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'verification_pending':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'processed':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'pending':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'paused':
      case 'warning':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'failed':
      case 'error':
      case 'template_error':
      case 'disconnected':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'info':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getLabel = () => {
    switch (normStatus) {
      case 'verification_pending':
        return 'Verification Pending';
      case 'template_error':
        return 'Template Issue';
      default:
        return normStatus.charAt(0).toUpperCase() + normStatus.slice(1);
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${getStyle()}`}>
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-80"></span>
      {getLabel()}
    </span>
  );
}
