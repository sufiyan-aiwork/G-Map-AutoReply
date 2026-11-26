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
      iconBg: 'bg-[#e8f1f8] text-[#025091] border-[#b9d7ef]',
      Icon: Info,
      btn: 'bg-[#025091] hover:bg-[#023e73] text-white focus-visible:ring-[#025091]/40',
    },
    success: {
      iconBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      Icon: CheckCircle2,
      btn: 'bg-emerald-600 hover:bg-emerald-700 text-white focus-visible:ring-emerald-500/40',
    },
    warning: {
      iconBg: 'bg-amber-50 text-amber-700 border-amber-200',
      Icon: AlertTriangle,
      btn: 'bg-amber-600 hover:bg-amber-700 text-white focus-visible:ring-amber-500/40',
    },
    danger: {
      iconBg: 'bg-rose-50 text-rose-700 border-rose-200',
      Icon: ShieldAlert,
      btn: 'bg-rose-600 hover:bg-rose-700 text-white focus-visible:ring-rose-500/40',
    },
  };

  const style = variants[variant] || variants.primary;
  const Icon = style.Icon;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#00142b]/60 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={() => !isLoading && onCancel?.()}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-[#e2e8f0] overflow-hidden modal-enter"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 w-full tz-top-accent" />
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className={`p-2.5 rounded-xl border shrink-0 ${style.iconBg}`}>
                <Icon size={20} />
              </div>
              <div>
                <h3 id="confirm-dialog-title" className="text-base font-bold text-[#1a1a2e]">
                  {title}
                </h3>
                <p className="text-xs text-[#64748b] mt-1.5 leading-relaxed">
                  {description}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              aria-label="Close confirmation dialog"
              className="text-slate-400 hover:text-[#1a1a2e] hover:bg-slate-100 p-1.5 rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40 disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2 bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#1a1a2e] rounded-xl text-xs font-semibold transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40 disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed ${style.btn}`}
            >
              {isLoading && <Loader2 size={14} className="animate-spin" />}
              <span>{isLoading ? 'Processing...' : confirmLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
