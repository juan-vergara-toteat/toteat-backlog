// =====================================================================
// MultiSelectFilter — generic dropdown for ticket-shaped filters.
//
// Used in FocoView's header to scope the tree by owner, status, etc.
// The button reads as a filter pill: muted when nothing is selected,
// coral with a count badge when one or more values are chosen. The
// popover follows the same close-on-outside / close-on-Escape idiom as
// StatusPicker so the two feel like siblings.
// =====================================================================

import { useEffect, useRef, useState } from 'react';
import { pill } from '../atoms';

export type MultiSelectOption<V extends string> = {
  value: V;
  label: string;
  // Optional preview rendered to the left of the label inside the
  // popover — used for owner avatars and status pills so the user
  // recognizes options the same way they appear on the ticket rows.
  accessory?: React.ReactNode;
};

export function MultiSelectFilter<V extends string>({
  label, options, selected, onChange,
}: {
  label: string;
  options: MultiSelectOption<V>[];
  selected: V[];
  onChange: (next: V[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside mousedown — matches StatusPicker so clicking
  // through one popover into another swaps cleanly without a stale
  // "everything is open" state.
  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const active = selected.length > 0;

  const toggle = (v: V) => {
    if (selected.includes(v)) onChange(selected.filter(x => x !== v));
    else onChange([...selected, v]);
  };

  return (
    <div
      ref={wrapperRef}
      style={{ position: 'relative', display: 'inline-flex' }}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          ...pill,
          height: 28,
          padding: '0 12px',
          border: 0,
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 700,
          background: active ? 'var(--coral)' : 'var(--surface-2)',
          color: active ? '#fff' : 'var(--ink-2)',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          boxShadow: open
            ? '0 0 0 2px rgba(27,27,27,0.10)'
            : hover
            ? '0 0 0 2px rgba(0,0,0,0.04)'
            : 'none',
          transition: 'box-shadow .12s ease-out',
        }}
      >
        <span>{label}</span>
        {active && (
          <span style={{
            background: 'rgba(255,255,255,0.28)',
            padding: '1px 7px', borderRadius: 999,
            fontSize: 12, fontWeight: 800, lineHeight: 1.2,
          }}>{selected.length}</span>
        )}
        <span aria-hidden="true" style={{ opacity: 0.7, fontSize: 11, marginLeft: 2 }}>▾</span>
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: '100%', left: 0, marginTop: 6,
            minWidth: 220, maxWidth: 320,
            background: 'var(--surface)',
            border: '1px solid var(--line)', borderRadius: 12,
            boxShadow: 'var(--shadow-2)',
            padding: 4,
            display: 'flex', flexDirection: 'column', gap: 2,
            zIndex: 40,
            animation: 'fadeIn .12s ease-out',
            maxHeight: 320, overflowY: 'auto',
          }}
        >
          {options.map(opt => (
            <Row
              key={opt.value}
              option={opt}
              checked={selected.includes(opt.value)}
              onToggle={() => toggle(opt.value)}
            />
          ))}
          {active && (
            <>
              <div style={{ height: 1, background: 'var(--line)', margin: '4px 0' }} />
              <button
                type="button"
                onClick={() => onChange([])}
                style={{
                  padding: '6px 8px', border: 0, borderRadius: 8,
                  background: 'transparent', cursor: 'pointer',
                  textAlign: 'left', font: 'inherit',
                  fontSize: 13, fontWeight: 700, color: 'var(--coral)',
                }}
              >Limpiar filtro</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Row<V extends string>({
  option, checked, onToggle,
}: {
  option: MultiSelectOption<V>;
  checked: boolean;
  onToggle: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      role="option"
      aria-selected={checked}
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 8px', border: 0, borderRadius: 8,
        background: hover ? 'var(--surface-2)' : 'transparent',
        cursor: 'pointer', textAlign: 'left', font: 'inherit',
        color: 'var(--ink-1)', width: '100%',
      }}
    >
      <span aria-hidden="true" style={{
        width: 16, height: 16, borderRadius: 4,
        border: '1.5px solid ' + (checked ? 'var(--coral)' : 'var(--line-2)'),
        background: checked ? 'var(--coral)' : 'transparent',
        display: 'grid', placeItems: 'center',
        color: '#fff', fontSize: 11, fontWeight: 800, lineHeight: 1,
        flexShrink: 0,
      }}>{checked ? '✓' : ''}</span>
      {option.accessory}
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-1)' }}>{option.label}</span>
    </button>
  );
}
