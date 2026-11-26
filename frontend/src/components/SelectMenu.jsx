import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export default function SelectMenu({
  value,
  onChange,
  options = [],
  groups = null,
  placeholder = 'Select option',
  ariaLabel,
  size = 'md', // 'sm' | 'md'
  align = 'left', // 'left' | 'right'
  className = '',
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);

  const flatOptions = useMemo(() => {
    if (Array.isArray(groups) && groups.length > 0) {
      return groups.flatMap((g) => g.options || []);
    }
    return options;
  }, [options, groups]);

  const selectedOption = flatOptions.find((opt) => String(opt.value) === String(value));

  useEffect(() => {
    if (!isOpen) return undefined;
    const handlePointerDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  const openMenu = () => {
    if (disabled) return;
    const currentIdx = flatOptions.findIndex((o) => String(o.value) === String(value));
    setHighlightedIdx(currentIdx >= 0 ? currentIdx : 0);
    setIsOpen(true);
  };

  const handleSelect = (optValue) => {
    onChange?.(optValue);
    setIsOpen(false);
    buttonRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openMenu();
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIdx((prev) => (flatOptions.length ? (prev + 1) % flatOptions.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIdx((prev) =>
        flatOptions.length ? (prev - 1 + flatOptions.length) % flatOptions.length : 0
      );
    } else if (e.key === 'Home') {
      e.preventDefault();
      setHighlightedIdx(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setHighlightedIdx(Math.max(0, flatOptions.length - 1));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const target = flatOptions[highlightedIdx];
      if (target) handleSelect(target.value);
    } else if (e.key === 'Tab') {
      setIsOpen(false);
    }
  };

  const sizeClass =
    size === 'sm'
      ? 'px-2.5 py-1.5 text-xs rounded-lg gap-1.5'
      : 'px-3.5 py-2 text-xs rounded-xl gap-2';

  const renderOption = (opt, globalIdx) => {
    const isSelected = String(opt.value) === String(value);
    const isHighlighted = highlightedIdx === globalIdx;
    return (
      <button
        type="button"
        key={String(opt.value)}
        role="option"
        aria-selected={isSelected}
        onMouseEnter={() => setHighlightedIdx(globalIdx)}
        onClick={() => handleSelect(opt.value)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-left rounded-lg transition-colors duration-150 ${
          isSelected
            ? 'bg-[#e8f1f8] text-[#025091] font-bold'
            : isHighlighted
            ? 'bg-slate-100 text-[#1a1a2e] font-medium'
            : 'text-[#1a1a2e] hover:bg-slate-50 font-medium'
        }`}
      >
        <span className="truncate">{opt.label}</span>
        {isSelected && <Check size={13} className="text-[#025091] shrink-0" />}
      </button>
    );
  };

  let runningIdx = 0;

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`} onKeyDown={handleKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={() => (isOpen ? setIsOpen(false) : openMenu())}
        className={`w-full inline-flex items-center justify-between bg-[#f8fafc] hover:bg-white border border-[#e2e8f0] hover:border-[#b9d7ef] font-semibold text-[#1a1a2e] transition-all duration-150 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#025091]/40 focus-visible:border-[#025091] disabled:opacity-50 disabled:cursor-not-allowed ${sizeClass} ${
          isOpen ? 'bg-white border-[#025091] ring-2 ring-[#025091]/20' : ''
        }`}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown
          size={14}
          className={`text-slate-500 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-[#025091]' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute z-40 mt-1.5 min-w-full w-max max-w-xs bg-white rounded-xl border border-[#e2e8f0] shadow-xl p-1.5 max-h-64 overflow-y-auto dropdown-enter ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {Array.isArray(groups) && groups.length > 0
            ? groups.map((group) => (
                <div key={group.label} className="py-1 first:pt-0 last:pb-0">
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {group.label}
                  </div>
                  <div className="space-y-0.5">
                    {(group.options || []).map((opt) => {
                      const idx = runningIdx++;
                      return renderOption(opt, idx);
                    })}
                  </div>
                </div>
              ))
            : flatOptions.map((opt, idx) => renderOption(opt, idx))}
        </div>
      )}
    </div>
  );
}
