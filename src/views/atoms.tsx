import { useState, type CSSProperties } from 'react';
import type {
  TicketStatus, TicketPriority, TicketImpact,
  OutcomeHorizon, OutcomeDirection, OutcomeCadence,
} from '../lib/database.types';

export const STATUS: TicketStatus[] = ['Backlog','Discovery','In Progress','Blocked','In Review','Done'];

export const STATUS_COLOR: Record<TicketStatus, { bg: string; fg: string }> = {
  'Backlog':     { bg: '#F2F2F2', fg: '#464646' },
  'Discovery':   { bg: '#EBE2FF', fg: '#5A2BC9' },
  'In Progress': { bg: '#DEE6FF', fg: '#1F3FBF' },
  'Blocked':     { bg: '#FFE0DE', fg: '#A8221C' },
  'In Review':   { bg: '#FFF1D1', fg: '#8A6300' },
  'Done':        { bg: '#DDF5EA', fg: '#0E6E4F' },
};

export const PRIORITY_COLOR: Record<TicketPriority, { bg: string; fg: string }> = {
  'Alta':  { bg: '#FFE0DE', fg: '#A8221C' },
  'Media': { bg: '#FFF1D1', fg: '#8A6300' },
  'Baja':  { bg: '#F2F2F2', fg: '#464646' },
};

// Impact tones — Alto impact reads as positive (green), Medio as amber,
// Bajo as muted. Inverse semantics from priority on purpose: a high-impact
// solution is good news; high-priority means urgent.
export const IMPACT_COLOR: Record<TicketImpact, { bg: string; fg: string }> = {
  'Alto':  { bg: '#DDF5EA', fg: '#0E6E4F' },
  'Medio': { bg: '#FFF1D1', fg: '#8A6300' },
  'Bajo':  { bg: '#F2F2F2', fg: '#6B6B6B' },
};

// Effort is just t-shirt sizing — no semantic good/bad. Use one neutral
// chip so it reads as a label, not a judgment.
export const EFFORT_TONE: { bg: string; fg: string } = { bg: '#F2F2F2', fg: '#464646' };

// Horizon palette — strong attention for "now", warmer "next", muted parking
// lot for "later". `now` re-uses the coral tone we already use for high-
// priority tickets so the system reads consistently.
export const HORIZON_COLOR: Record<OutcomeHorizon, { bg: string; fg: string }> = {
  'now':   { bg: '#FFE0DE', fg: '#A8221C' }, // coral — strong attention
  'next':  { bg: '#FFF1D1', fg: '#8A6300' }, // amber — medium
  'later': { bg: '#F2F2F2', fg: '#6B6B6B' }, // muted parking lot
};

export const CONFIDENCE_COLOR: Record<'Low' | 'Medium' | 'High', { bg: string; fg: string }> = {
  'Low':    { bg: '#F2F2F2', fg: '#464646' },
  'Medium': { bg: '#FFF1D1', fg: '#8A6300' },
  'High':   { bg: '#DDF5EA', fg: '#0E6E4F' },
};

// Option arrays for StatusPicker. Each option pairs a value with its
// label and tone so the picker can render the pill without re-deriving
// it. Order matters — these are the order rows appear in the popover.
export type Confidence = 'Low' | 'Medium' | 'High';

export const TICKET_STATUS_OPTIONS: { value: TicketStatus; label: string; tone: { bg: string; fg: string } }[] =
  STATUS.map(s => ({ value: s, label: s, tone: STATUS_COLOR[s] }));

// Horizon options for the StatusPicker on root outcome cards. The label is
// kept English-y on purpose — these match the filter pill labels at the top
// of FocoView so the mapping reads at a glance.
export const HORIZON_OPTIONS: { value: OutcomeHorizon; label: string; tone: { bg: string; fg: string } }[] =
  (['now', 'next', 'later'] as OutcomeHorizon[]).map(h => ({
    value: h,
    label: h.charAt(0).toUpperCase() + h.slice(1),
    tone: HORIZON_COLOR[h],
  }));

export const CONFIDENCE_OPTIONS: { value: Confidence; label: string; tone: { bg: string; fg: string } }[] =
  (['Low', 'Medium', 'High'] as Confidence[])
    .map(c => ({ value: c, label: c, tone: CONFIDENCE_COLOR[c] }));

export const DIRECTION_LABEL: Record<OutcomeDirection, string> = {
  up: 'Subir es bueno',
  down: 'Bajar es bueno',
};

export const DIRECTION_ARROW: Record<OutcomeDirection, string> = {
  up: '↑',
  down: '↓',
};

export const CADENCE_LABEL: Record<OutcomeCadence, string> = {
  weekly: 'Semanal',
  monthly: 'Mensual',
  quarterly: 'Trimestral',
};

export const pill: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '3px 9px', borderRadius: 999, fontSize: 13, fontWeight: 700,
  letterSpacing: '-0.01em', whiteSpace: 'nowrap',
};

export const card: CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14,
  boxShadow: 'var(--shadow-1)',
};

export function Pill({ tone, children }: { tone: { bg: string; fg: string }; children: React.ReactNode }) {
  return <span style={{ ...pill, background: tone.bg, color: tone.fg }}>{children}</span>;
}

// Filter pill for view scopes (Todo / Now / Next / Later). When active,
// the pill flips to the coral-on-white treatment so the current scope reads
// at a glance; inactive pills sit on the muted surface palette.
export function FilterPill({ label, active, onClick }: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...pill,
        border: 0,
        cursor: 'pointer',
        height: 28,
        padding: '0 14px',
        fontSize: 14,
        fontWeight: 700,
        background: active ? 'var(--coral)' : 'var(--surface-2)',
        color: active ? '#fff' : 'var(--ink-2)',
      }}
    >
      {label}
    </button>
  );
}

export function Avatar({ name, initials, color, size = 28 }: { name?: string; initials: string; color: string; size?: number }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ position: 'relative', flexShrink: 0 }}
    >
      <div style={{
        width: size, height: size, borderRadius: 999, background: color, color: '#fff',
        display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: size <= 22 ? 11 : 13,
        letterSpacing: '-0.02em',
      }}>{initials}</div>
      {hover && name && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 6px)',
          left: '50%', transform: 'translateX(-50%)',
          background: 'var(--ink)', color: '#fff',
          padding: '4px 8px', borderRadius: 6,
          fontSize: 12, fontWeight: 600,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 100,
          boxShadow: '0 2px 6px rgba(27,27,27,0.18)',
          animation: 'fadeIn .1s ease-out',
        }}>{name}</div>
      )}
    </div>
  );
}

export function fmtMetric(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  if (Number.isInteger(n)) return String(n);
  return n.toLocaleString('es-CL', { maximumFractionDigits: 2 });
}

export function fmtRel(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso).getTime();
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return 'recién';
  if (diff < 3600) return `hace ${Math.floor(diff/60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff/3600)} h`;
  if (diff < 604800) return `hace ${Math.floor(diff/86400)} d`;
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
}
