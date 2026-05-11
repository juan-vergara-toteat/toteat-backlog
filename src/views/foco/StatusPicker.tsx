// =====================================================================
// StatusPicker — generic inline status pill with popover.
//
// Click a pill, pick a new value, done. Used for ticket status,
// opportunity status, and confidence on FocoView's cards. Removes the
// 4-click round trip through the edit form for a status change.
//
// Generic over any string-literal union — pass in the option list and
// onChange receives the chosen value typed correctly.
// =====================================================================

import { useEffect, useRef, useState } from 'react';
import { pill } from '../atoms';

export type PickerOption<V extends string> = {
  value: V;
  label: string;
  tone: { bg: string; fg: string };
};

export function StatusPicker<V extends string>({
  current,
  options,
  onChange,
  ariaLabel,
}: {
  current: V;
  options: PickerOption<V>[];
  onChange: (next: V) => void;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const currentOption =
    options.find(o => o.value === current) ??
    // Fallback so we never crash on an unknown value (e.g. a status that
    // got removed from the union but is still in the DB row).
    { value: current, label: current, tone: { bg: '#F2F2F2', fg: '#464646' } };

  // Close on outside click. We listen on `mousedown` (not `click`) so the
  // popover closes before the parent card's onClick can fire — otherwise
  // clicking outside the popover would also try to open the edit form.
  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Subtle ring affordance: stronger when open, lighter on hover.
  const buttonShadow = open
    ? '0 0 0 2px rgba(27,27,27,0.10)'
    : hover
    ? '0 0 0 2px rgba(0,0,0,0.04)'
    : 'none';

  return (
    <div
      ref={wrapperRef}
      style={{ position: 'relative', display: 'inline-flex' }}
      // Stop bubbling on the wrapper too so clicking the popover never
      // reaches the parent card's onClick handler.
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(o => !o);
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          ...pill,
          background: currentOption.tone.bg,
          color: currentOption.tone.fg,
          border: 0,
          cursor: 'pointer',
          boxShadow: buttonShadow,
          transition: 'box-shadow .12s ease-out',
        }}
      >
        <span>{currentOption.label}</span>
        <span aria-hidden="true" style={{ opacity: 0.6, fontSize: 12, marginLeft: 3 }}>🔽</span>
      </button>

      {open && (
        <div
          role="listbox"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            minWidth: 160,
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 12,
            boxShadow: 'var(--shadow-2)',
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            zIndex: 30,
            animation: 'fadeIn .12s ease-out',
          }}
        >
          {options.map(opt => {
            const isCurrent = opt.value === current;
            return (
              <PickerRow
                key={opt.value}
                option={opt}
                isCurrent={isCurrent}
                onSelect={() => {
                  setOpen(false);
                  if (!isCurrent) onChange(opt.value);
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function PickerRow<V extends string>({
  option, isCurrent, onSelect,
}: {
  option: PickerOption<V>;
  isCurrent: boolean;
  onSelect: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      role="option"
      aria-selected={isCurrent}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 8px',
        border: 0,
        borderRadius: 8,
        background: hover ? 'var(--surface-2)' : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        font: 'inherit',
        color: 'var(--ink-1)',
        width: '100%',
      }}
    >
      {/* Coral dot marks the current selection. Reserve the slot on every
          row so labels stay aligned regardless of which row is current. */}
      <span
        aria-hidden="true"
        style={{
          width: 6, height: 6, borderRadius: 999,
          background: isCurrent ? 'var(--coral)' : 'transparent',
          flexShrink: 0,
        }}
      />
      <span
        style={{
          ...pill,
          fontSize: 13,
          padding: '2px 8px',
          background: option.tone.bg,
          color: option.tone.fg,
        }}
      >
        {option.label}
      </span>
    </button>
  );
}
