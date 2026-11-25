import React, { useEffect } from 'react';
import { AlertTriangle, ShieldAlert, CheckCircle2, Info, X, Loader2 } from 'lucide-react';

export default function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary', // 'primary' | 'warning' | 'danger' | 'success'
  isLoading = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isLoading) {
        onCancel?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) return null;

  const variants = {
    primary: {
      iconBg: 'bg-blue-50 text-blue-600 border-blue-200',
      Icon: Info,
      btn: 'bg-blue-600 hover:bg-blue-700 text-white focus-visible:ring-blue-500',
    },
    success: {
      iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
      Icon: CheckCircle2,
      btn: 'bg-emerald-600 hover:bg-emerald-700 text-white focus-visible:ring-emerald-500',
    },
    warning: {
      iconBg: 'bg-amber-50 text-amber-600 border-amber-200',
      Icon: AlertTriangle,
      btn: 'bg-amber-600 hover:bg-amber-700 text-white focus-visible:ring-amber-500',
    },
    danger: {
      iconBg: 'bg-rose-50 text-rose-600 border-rose-200',
      Icon: ShieldAlert,
      btn: 'bg-rose-600 hover:bg-rose-700 text-white focus-visible:ring-rose-500',
    },
  };

  const style = variants[variant] || variants.primary;
  const Icon = style.Icon;

  return (
    <div
      className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={() => !isLoading && onCancel?.()}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 modal-enter"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`p-2.5 rounded-xl border shrink-0 ${style.iconBg}`}>
              <Icon size={20} />
            </div>
            <div>
              <h3 id="confirm-dialog-title" className="text-base font-bold text-slate-900">
                {title}
              </h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                {description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            aria-label="Close confirmation dialog"
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-60 ${style.btn}`}
          >
            {isLoading && <Loader2 size={14} className="animate-spin" />}
            <span>{isLoading ? 'Processing...' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
