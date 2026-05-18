// =====================================================================
// FocoView — the workspace as a single Opportunity Solution Tree.
//
//   Outcome → Opportunity → Solution ticket
//
// Plus a "Sin oportunidad" section at the bottom for tickets without
// opportunity_id, and filter pills (Todo / Now / Next / Later) at the top
// to scope which slices show.
// =====================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  Outcome, Opportunity, Ticket, Profile, MetricObservation,
  OutcomeDirection, OutcomeHorizon, TicketStatus,
  TicketPriority, TicketImpact,
} from '../lib/database.types';
import { createTicket, updateOpportunity, updateOutcome, updateTicket } from '../lib/data';
import { useAuth } from '../lib/auth';
import {
  Avatar, FilterPill, Pill,
  STATUS,
  STATUS_COLOR,
  TICKET_STATUS_OPTIONS, HORIZON_OPTIONS, CONFIDENCE_OPTIONS,
  PRIORITY_COLOR, IMPACT_COLOR, EFFORT_TONE,
  type Confidence,
  DIRECTION_ARROW, fmtMetric,
} from './atoms';
import { Sparkline } from './foco/Sparkline';
import { buildRetroMarkdown } from './foco/retroExport';
import { OutcomeForm } from './foco/OutcomeForm';
import { OpportunityForm } from './foco/OpportunityForm';
import { ObservationForm } from './foco/ObservationForm';
import { StatusPicker } from './foco/StatusPicker';
import { MultiSelectFilter, type MultiSelectOption } from './foco/MultiSelectFilter';
import { btnPrimary, btnSecondary } from './foco/chrome';

const PRIORITIES: TicketPriority[] = ['Alta', 'Media', 'Baja'];

// =====================================================================
// Filter modes
// =====================================================================

type FilterMode = 'all' | 'now' | 'next' | 'later';
const FILTERS: { mode: FilterMode; label: string }[] = [
  { mode: 'all',   label: 'All' },
  { mode: 'now',   label: 'Now' },
  { mode: 'next',  label: 'Next' },
  { mode: 'later', label: 'Later' },
];

// =====================================================================
// Top-level view
// =====================================================================

export function FocoView({
  outcomes, opportunities, tickets, observations, profiles, loading, onOpenTicket,
}: {
  outcomes: Outcome[];
  opportunities: Opportunity[];
  tickets: Ticket[];
  observations: MetricObservation[];
  profiles: Profile[];
  // True while the outcomes query is in-flight. Suppresses the empty-state
  // card from flashing before the first data arrives.
  loading?: boolean;
  onOpenTicket: (id: string) => void;
}) {
  const { profile } = useAuth();

  const [filter, setFilter] = useState<FilterMode>('all');
  // Ticket-scoped filters. Each is an additive AND filter: the ticket
  // must match every filter that has at least one value selected. Empty
  // arrays mean "no constraint", not "match nothing", so the default
  // view shows the full tree.
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<TicketStatus[]>([]);
  const [priorities, setPriorities] = useState<TicketPriority[]>([]);
  const ticketFilterActive = ownerIds.length > 0 || statuses.length > 0 || priorities.length > 0;
  const [editingOutcome, setEditingOutcome] = useState<
    Outcome | { _new: true } | null
  >(null);
  const [editingOpportunity, setEditingOpportunity] = useState<
    Opportunity | { _new: true; outcome_id: string } | null
  >(null);
  const [observingOutcome, setObservingOutcome] = useState<Outcome | null>(null);
  const [retroLabel, setRetroLabel] = useState<'idle' | 'copied'>('idle');
  const retroTimerRef = useRef<number | null>(null);

  // Clean up the "Copiado → idle" timer on unmount to avoid setting state
  // on an unmounted component.
  useEffect(() => {
    return () => {
      if (retroTimerRef.current !== null) {
        clearTimeout(retroTimerRef.current);
        retroTimerRef.current = null;
      }
    };
  }, []);

  const profileById = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);

  // observations grouped per outcome, ascending by captured_at (already
  // sorted by useAllMetricObservations).
  const obsByOutcome = useMemo(() => {
    const m = new Map<string, MetricObservation[]>();
    observations.forEach(ob => {
      if (!m.has(ob.outcome_id)) m.set(ob.outcome_id, []);
      m.get(ob.outcome_id)!.push(ob);
    });
    return m;
  }, [observations]);

  const oppsByOutcome = useMemo(() => {
    const m = new Map<string, Opportunity[]>();
    outcomes.forEach(o => m.set(o.id, []));
    opportunities.forEach(op => {
      if (!m.has(op.outcome_id)) m.set(op.outcome_id, []);
      m.get(op.outcome_id)!.push(op);
    });
    return m;
  }, [outcomes, opportunities]);

  // Ticket-level filters compose via AND. Empty arrays = no constraint.
  // Everything downstream (orphan list, ticketsByOpp, branch visibility)
  // derives from this filtered set, so the tree collapses to just the
  // matching work when any filter is on.
  const filteredTickets = useMemo(() => {
    if (!ticketFilterActive) return tickets;
    return tickets.filter(t => {
      if (ownerIds.length > 0) {
        if (!t.owner_id || !ownerIds.includes(t.owner_id)) return false;
      }
      if (statuses.length > 0) {
        if (!statuses.includes(t.status as TicketStatus)) return false;
      }
      if (priorities.length > 0) {
        if (!t.prioridad || !priorities.includes(t.prioridad as TicketPriority)) return false;
      }
      return true;
    });
  }, [tickets, ownerIds, statuses, priorities, ticketFilterActive]);

  const ticketsByOpp = useMemo(() => {
    const m = new Map<string, Ticket[]>();
    filteredTickets.forEach(t => {
      if (!t.opportunity_id) return;
      if (!m.has(t.opportunity_id)) m.set(t.opportunity_id, []);
      m.get(t.opportunity_id)!.push(t);
    });
    return m;
  }, [filteredTickets]);

  // Solution counts for the retro export still reflect the full backlog —
  // the retro is a workspace-wide snapshot, not a per-user filter.
  const solutionCounts = useMemo(() => {
    const m = new Map<string, number>();
    tickets.forEach(t => {
      if (!t.opportunity_id) return;
      m.set(t.opportunity_id, (m.get(t.opportunity_id) ?? 0) + 1);
    });
    return m;
  }, [tickets]);

  const orphanTickets = useMemo(
    () => filteredTickets.filter(t => !t.opportunity_id),
    [filteredTickets],
  );

  // ----- Filter logic ---------------------------------------------------
  // Now/Next/Later slices live on outcome.horizon — each outcome lives in
  // exactly one bucket, set explicitly via the horizon picker.
  //   - all   → every outcome
  //   - now   → outcomes with horizon === 'now'
  //   - next  → outcomes with horizon === 'next'
  //   - later → outcomes with horizon === 'later'
  function rootMatchesHorizon(o: Outcome): boolean {
    if (filter === 'all') return true;
    return ((o.horizon as OutcomeHorizon | null) ?? 'later') === filter;
  }

  // Opportunities and tickets are no longer status-gated by the horizon
  // filter — visibility is decided at the outcome level. When any
  // ticket-scoped filter is on we additionally drop opps that don't
  // carry any matching tickets, so the tree collapses to the branches
  // that actually need attention.
  function visibleOpps(o: Outcome): Opportunity[] {
    const opps = oppsByOutcome.get(o.id) ?? [];
    if (!ticketFilterActive) return opps;
    return opps.filter(op => (ticketsByOpp.get(op.id) ?? []).length > 0);
  }

  // When ticket filters are on, also hide outcomes whose every opp has
  // been pruned — otherwise the view fills with empty cards.
  const visibleRoots = outcomes.filter(o => {
    if (!rootMatchesHorizon(o)) return false;
    if (!ticketFilterActive) return true;
    return visibleOpps(o).length > 0;
  });

  // Orphans aren't attached to any outcome, so they don't fit a horizon.
  // Show them only on the 'all' filter so the user has a place to triage.
  const visibleOrphans = filter === 'all' ? orphanTickets : [];

  // ----- Retro export ---------------------------------------------------
  const handleCopyRetro = async () => {
    const md = buildRetroMarkdown({
      outcomes,
      opportunities,
      observations,
      solutionCounts,
    });
    try {
      await navigator.clipboard.writeText(md);
      setRetroLabel('copied');
      // Cancel any in-flight reset before scheduling a new one, else two
      // back-to-back clicks race and the label flickers.
      if (retroTimerRef.current !== null) clearTimeout(retroTimerRef.current);
      retroTimerRef.current = window.setTimeout(() => {
        setRetroLabel('idle');
        retroTimerRef.current = null;
      }, 1500);
    } catch (e) {
      alert('No pude copiar al portapapeles. Revisá los permisos del navegador.');
    }
  };

  // ----- "+ Solution" — create placeholder, then open SidePanel ---------
  const handleAddSolution = async (opp: Opportunity) => {
    const { data, error } = await createTicket({
      item: 'Nueva solución',
      opportunity_id: opp.id,
      status: 'Backlog',
    });
    if (error || !data) {
      alert(`No pude crear la solución: ${error?.message ?? 'error desconocido'}`);
      return;
    }
    onOpenTicket(data.id);
  };

  // ----- Loading state --------------------------------------------------
  // Suppress the empty state until the outcomes query has resolved. The
  // hook always starts with rows=[] before the first fetch lands, so
  // without this we'd briefly render "Empieza definiendo un outcome" on
  // every page refresh.
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Header
          filter={filter} setFilter={setFilter}
          profiles={profiles}
          ownerIds={ownerIds} setOwnerIds={setOwnerIds}
          statuses={statuses} setStatuses={setStatuses}
          priorities={priorities} setPriorities={setPriorities}
          retroLabel={retroLabel} onCopyRetro={handleCopyRetro}
          onNewOutcome={() => setEditingOutcome({ _new: true })}
        />
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14,
          padding: 24, textAlign: 'center', color: 'var(--ink-3)', fontSize: 14,
        }}>
          Cargando…
        </div>
      </div>
    );
  }

  // ----- Empty state ----------------------------------------------------
  if (outcomes.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Header
          filter={filter} setFilter={setFilter}
          profiles={profiles}
          ownerIds={ownerIds} setOwnerIds={setOwnerIds}
          statuses={statuses} setStatuses={setStatuses}
          priorities={priorities} setPriorities={setPriorities}
          retroLabel={retroLabel} onCopyRetro={handleCopyRetro}
          onNewOutcome={() => setEditingOutcome({ _new: true })}
        />
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14,
          boxShadow: 'var(--shadow-1)', padding: 32, textAlign: 'center',
        }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8 }}>
            Empieza definiendo un outcome
          </div>
          <div style={{ fontSize: 15, color: 'var(--ink-2)', maxWidth: 540, margin: '0 auto 18px', lineHeight: 1.55 }}>
            Un outcome es la métrica que quieres mover. Por ejemplo:
            <em> "horas operativas/mes del equipo de Finanzas: bajar de 32 a 12"</em>.
            Después cuelgas oportunidades (pain points) abajo, y desde ahí salen los tickets.
          </div>
          <button
            onClick={() => setEditingOutcome({ _new: true })}
            style={btnPrimary}
          >+ Crear outcome</button>
        </div>

        {editingOutcome && (
          <OutcomeForm
            outcome={'_new' in editingOutcome ? null : editingOutcome}
            outcomes={outcomes} profiles={profiles}
            onClose={() => setEditingOutcome(null)}
          />
        )}
      </div>
    );
  }

  // ----- Tree -----------------------------------------------------------
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Header
        filter={filter} setFilter={setFilter}
        profiles={profiles}
        ownerIds={ownerIds} setOwnerIds={setOwnerIds}
        statuses={statuses} setStatuses={setStatuses}
        priorities={priorities} setPriorities={setPriorities}
        retroLabel={retroLabel} onCopyRetro={handleCopyRetro}
        onNewOutcome={() => setEditingOutcome({ _new: true })}
      />

      {visibleRoots.length === 0 ? (
        <EmptyHint filter={filter} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {visibleRoots.map(o => (
            <OutcomeBranch
              key={o.id}
              outcome={o}
              opps={visibleOpps(o)}
              ticketsByOpp={ticketsByOpp}
              obsByOutcome={obsByOutcome}
              profileById={profileById}
              onOpenOutcome={setEditingOutcome}
              onOpenOpportunity={op => setEditingOpportunity(op)}
              onAddOpportunity={outcomeId => setEditingOpportunity({ _new: true, outcome_id: outcomeId })}
              onAddObservation={oc => setObservingOutcome(oc)}
              onAddSolution={handleAddSolution}
              onOpenTicket={onOpenTicket}
            />
          ))}
        </div>
      )}

      {visibleOrphans.length > 0 && (
        <OrphanSection
          tickets={visibleOrphans}
          profileById={profileById}
          onOpenTicket={onOpenTicket}
        />
      )}

      {/* Modals --------------------------------------------------------- */}
      {editingOutcome && (
        <OutcomeForm
          outcome={'_new' in editingOutcome ? null : editingOutcome}
          outcomes={outcomes} profiles={profiles}
          onClose={() => setEditingOutcome(null)}
        />
      )}
      {editingOpportunity && (
        <OpportunityForm
          opportunity={'_new' in editingOpportunity ? null : editingOpportunity}
          defaultOutcomeId={editingOpportunity.outcome_id}
          outcomes={outcomes} profiles={profiles}
          onClose={() => setEditingOpportunity(null)}
        />
      )}
      {observingOutcome && profile && (
        <ObservationForm
          outcome={observingOutcome}
          actorId={profile.id}
          onClose={() => setObservingOutcome(null)}
        />
      )}
    </div>
  );
}

// =====================================================================
// Header — filter pills + retro export + "+ Outcome"
// =====================================================================

function Header({
  filter, setFilter,
  profiles,
  ownerIds, setOwnerIds,
  statuses, setStatuses,
  priorities, setPriorities,
  retroLabel, onCopyRetro, onNewOutcome,
}: {
  filter: FilterMode;
  setFilter: (f: FilterMode) => void;
  profiles: Profile[];
  ownerIds: string[]; setOwnerIds: (v: string[]) => void;
  statuses: TicketStatus[]; setStatuses: (v: TicketStatus[]) => void;
  priorities: TicketPriority[]; setPriorities: (v: TicketPriority[]) => void;
  retroLabel: 'idle' | 'copied';
  onCopyRetro: () => void;
  onNewOutcome: () => void;
}) {
  // Owner dropdown rows show the avatar + name so the filter looks like
  // the rows the user is filtering. Memoize since profiles can be hefty.
  const ownerOptions: MultiSelectOption<string>[] = useMemo(
    () => profiles.map(p => ({
      value: p.id,
      label: p.name,
      accessory: <Avatar name={p.name} initials={p.initials} color={p.color} size={20} />,
    })),
    [profiles],
  );

  const statusOptions: MultiSelectOption<TicketStatus>[] = useMemo(
    () => STATUS.map(s => ({
      value: s,
      label: s,
      accessory: <Pill tone={STATUS_COLOR[s]}>{s}</Pill>,
    })),
    [],
  );

  const priorityOptions: MultiSelectOption<TicketPriority>[] = useMemo(
    () => PRIORITIES.map(p => ({
      value: p,
      label: p,
      accessory: <Pill tone={PRIORITY_COLOR[p]}>{p}</Pill>,
    })),
    [],
  );

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <FilterPill
            key={f.mode}
            label={f.label}
            active={filter === f.mode}
            onClick={() => setFilter(f.mode)}
          />
        ))}
        {/* Divider — horizon scope on the left, ticket-shaped filters on
            the right. They compose, but each set is operationally
            distinct: horizon picks the slice of the roadmap, the others
            narrow the ticket rows inside that slice. */}
        <span style={{ width: 1, height: 18, background: 'var(--line-2)', margin: '0 6px' }} />
        <MultiSelectFilter
          label="Owner"
          options={ownerOptions}
          selected={ownerIds}
          onChange={setOwnerIds}
        />
        <MultiSelectFilter
          label="Status"
          options={statusOptions}
          selected={statuses}
          onChange={setStatuses}
        />
        <MultiSelectFilter
          label="Prioridad"
          options={priorityOptions}
          selected={priorities}
          onChange={setPriorities}
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCopyRetro} style={btnSecondary}>
          {retroLabel === 'copied' ? '✓ Copiado' : '📋 Resumen mensual'}
        </button>
        <button onClick={onNewOutcome} style={btnPrimary}>+ Outcome</button>
      </div>
    </div>
  );
}

function EmptyHint({ filter }: { filter: FilterMode }) {
  const text = filter === 'now'
    ? 'No hay outcomes en "Now". Cambiá el horizonte de un outcome desde su tarjeta para que aparezca acá.'
    : filter === 'next'
    ? 'No hay outcomes en "Next". Cambiá el horizonte de un outcome desde su tarjeta para que aparezca acá.'
    : filter === 'later'
    ? 'No hay outcomes en "Later". Cambiá el horizonte de un outcome desde su tarjeta para que aparezca acá.'
    : 'Sin contenido para mostrar.';
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14,
      padding: 24, textAlign: 'center', color: 'var(--ink-2)', fontSize: 15,
    }}>
      {text}
    </div>
  );
}

// =====================================================================
// OutcomeBranch — outcome card + opps + solutions
// =====================================================================

function OutcomeBranch({
  outcome, opps, ticketsByOpp, obsByOutcome, profileById,
  onOpenOutcome, onOpenOpportunity, onAddOpportunity,
  onAddObservation, onAddSolution, onOpenTicket,
}: {
  outcome: Outcome;
  opps: Opportunity[];
  ticketsByOpp: Map<string, Ticket[]>;
  obsByOutcome: Map<string, MetricObservation[]>;
  profileById: Map<string, Profile>;
  onOpenOutcome: (o: Outcome) => void;
  onOpenOpportunity: (op: Opportunity) => void;
  onAddOpportunity: (outcomeId: string) => void;
  onAddObservation: (o: Outcome) => void;
  onAddSolution: (op: Opportunity) => Promise<void>;
  onOpenTicket: (id: string) => void;
}) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14,
      boxShadow: 'var(--shadow-1)', overflow: 'hidden',
    }}>
      <OutcomeCard
        outcome={outcome}
        observations={obsByOutcome.get(outcome.id) ?? []}
        profileById={profileById}
        onClick={() => onOpenOutcome(outcome)}
        onAddObservation={() => onAddObservation(outcome)}
        onAddOpportunity={() => onAddOpportunity(outcome.id)}
      />

      <div style={{ borderTop: '1px solid var(--line)' }}>
        {opps.length === 0 ? (
          <div style={oppListStyle}>
            <EmptyOppRow>
              Aún sin oportunidades. Aquí van los pain points del equipo.
            </EmptyOppRow>
          </div>
        ) : (
          <div style={oppListStyle}>
            {opps.map(op => (
              <OpportunityNode
                key={op.id}
                opp={op}
                tickets={ticketsByOpp.get(op.id) ?? []}
                profileById={profileById}
                onClick={() => onOpenOpportunity(op)}
                onAddSolution={() => onAddSolution(op)}
                onOpenTicket={onOpenTicket}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Container that holds the tinted opportunity sections inside an outcome.
// Light vertical breathing room around the stack, plus a 6px gap between
// opp sections so the surface-2 tints read as distinct regions rather than
// one continuous band.
const oppListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '10px 14px',
};

// =====================================================================
// Outcome card — top of each branch
// =====================================================================

function OutcomeCard({
  outcome, observations, profileById,
  onClick, onAddObservation, onAddOpportunity,
}: {
  outcome: Outcome;
  observations: MetricObservation[];
  profileById: Map<string, Profile>;
  onClick: () => void;
  onAddObservation: () => void;
  onAddOpportunity: () => void;
}) {
  const owner = outcome.owner_id ? profileById.get(outcome.owner_id) : null;
  // Last ~12 observations for the sparkline. observations are asc by
  // captured_at from useAllMetricObservations.
  const sparkValues = observations.slice(-12).map(o => Number(o.value));
  return (
    <div onClick={onClick} style={{
      padding: 16, cursor: 'pointer',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {/* Top row — title left, metadata (horizon picker + owner avatar) right.
          This is the conventional card layout; metadata pills cluster in the
          top-right so the title gets visual prominence on the left. */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', flex: 1, minWidth: 0 }}>
          {outcome.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <StatusPicker
            current={(outcome.horizon ?? 'later') as OutcomeHorizon}
            options={HORIZON_OPTIONS}
            onChange={async (h) => {
              const { error } = await updateOutcome(outcome.id, { horizon: h });
              if (error) alert(`No pude cambiar el horizonte: ${error.message}`);
            }}
            ariaLabel="Cambiar horizonte"
          />
          {owner && (
            <Avatar name={owner.name} initials={owner.initials} color={owner.color} size={26} />
          )}
        </div>
      </div>
      {outcome.description && (
        <div style={{
          fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>{outcome.description}</div>
      )}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>
          {fmtMetric(outcome.current_value)}
        </span>
        <span style={{ fontSize: 16, color: 'var(--ink-3)', fontWeight: 700 }}>
          {DIRECTION_ARROW[outcome.direction as OutcomeDirection]}
        </span>
        <span style={{ fontSize: 16, color: 'var(--ink-3)', fontWeight: 700 }}>
          {fmtMetric(outcome.target_value)}{outcome.metric_unit ? ` ${outcome.metric_unit}` : ''}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Sparkline
            values={sparkValues}
            direction={(outcome.direction ?? 'down') as OutcomeDirection}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button onClick={(e) => { e.stopPropagation(); onAddObservation(); }} style={btnGhostSmall}>+ Observación</button>
          <button onClick={(e) => { e.stopPropagation(); onAddOpportunity(); }} style={btnGhostSmall}>+ Opportunity</button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Opportunity node — opp card + its solution tickets (indented)
// =====================================================================

function OpportunityNode({
  opp, tickets, profileById, onClick, onAddSolution, onOpenTicket,
}: {
  opp: Opportunity;
  tickets: Ticket[];
  profileById: Map<string, Profile>;
  onClick: () => void;
  onAddSolution: () => void;
  onOpenTicket: (id: string) => void;
}) {
  const owner = opp.owner_id ? profileById.get(opp.owner_id) : null;
  return (
    // Tinted opportunity region. The surface-2 background sits on top of the
    // outcome's white surface to encapsulate the opp + its solutions visually
    // — no border, no shadow, no left rail. The contrast does the work.
    <div style={{
      background: 'var(--surface-2)',
      borderRadius: 8,
      padding: '10px 14px',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Opportunity header: title + description + confidence pill +
          "+ Solution" + owner avatar. Click anywhere on the body opens the
          edit form. */}
      <div onClick={onClick} style={{
        cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>{opp.title}</div>
          {opp.description && (
            <div style={{
              fontSize: 14, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.5,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>{opp.description}</div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
            <StatusPicker
              current={(opp.confidence ?? 'Medium') as Confidence}
              options={CONFIDENCE_OPTIONS}
              onChange={async (c) => {
                const { error } = await updateOpportunity(opp.id, { confidence: c });
                if (error) alert(`No pude cambiar la confianza: ${error.message}`);
              }}
              ariaLabel="Cambiar confianza"
            />
            {opp.impact_estimate && (
              <span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600 }}>· {opp.impact_estimate}</span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onAddSolution(); }}
              style={{ ...btnGhostSmall, marginLeft: 'auto' }}
            >+ Solution</button>
          </div>
        </div>
        {owner && <Avatar name={owner.name} initials={owner.initials} color={owner.color} size={26} />}
      </div>

      {/* Solution rows — sit directly on the surface-2 tint. Tight stack,
          no separators, no gaps. Hover lifts each row to white. */}
      {tickets.length === 0 ? (
        <EmptyOppRow inline>Sin solutions todavía</EmptyOppRow>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
          {tickets.map(t => (
            <SolutionRow
              key={t.id}
              ticket={t}
              profileById={profileById}
              onClick={() => onOpenTicket(t.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Solution row — terminal node in the tree
// =====================================================================

function SolutionRow({ ticket, profileById, onClick }: {
  ticket: Ticket;
  profileById: Map<string, Profile>;
  onClick: () => void;
}) {
  const owner = ticket.owner_id ? profileById.get(ticket.owner_id) : null;
  const [hover, setHover] = useState(false);
  const priority = ticket.prioridad as TicketPriority | null;
  const impact = ticket.impacto as TicketImpact | null;
  const effort = ticket.esfuerzo as string | null;
  const progress = ticket.progress ?? 0;
  // Hide the meta strip entirely when there's nothing to show — keeps
  // the row compact for sparsely-filled tickets instead of leaving a
  // blank second line.
  const hasMeta = !!priority || !!impact || !!effort || progress > 0;
  return (
    // Each ticket reads as its own white chip floating on the opportunity's
    // surface-2 tint. A subtle base shadow lifts it off the tint; hover swaps
    // to the standard shadow-1 token so the lift is more pronounced when the
    // row is interactive. Margin-block keeps adjacent chips visually separated.
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '12px 14px',
        borderRadius: 8,
        marginBlock: 3,
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--surface)',
        boxShadow: hover ? 'var(--shadow-1)' : '0 1px 2px rgba(27,27,27,0.04)',
        transition: 'box-shadow 80ms ease-out',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {ticket.item}
        </div>
        {ticket.description && (
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ticket.description}
          </div>
        )}
        {hasMeta && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginTop: 8,
            flexWrap: 'wrap',
          }}>
            {priority && <MetaChip label="Prioridad" value={priority} tone={PRIORITY_COLOR[priority]} />}
            {impact && <MetaChip label="Impacto" value={impact} tone={IMPACT_COLOR[impact]} />}
            {effort && <MetaChip label="Esfuerzo" value={effort} tone={EFFORT_TONE} />}
            <ProgressMeter value={progress} />
          </div>
        )}
      </div>
      <StatusPicker
        current={ticket.status as TicketStatus}
        options={TICKET_STATUS_OPTIONS}
        onChange={async (s) => {
          const { error } = await updateTicket(ticket.id, { status: s });
          if (error) alert(`No pude cambiar el estado del ticket: ${error.message}`);
        }}
        ariaLabel="Cambiar estado"
      />
      {owner && <Avatar name={owner.name} initials={owner.initials} color={owner.color} size={22} />}
    </div>
  );
}

// Compact label+value chip used in the ticket meta strip. The label sits
// outside the tone (in muted ink) so the tone only emphasizes the value —
// reading "Prioridad: Baja" stays calm when the value is muted.
function MetaChip({ label, value, tone }: {
  label: string;
  value: string;
  tone: { bg: string; fg: string };
}) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 12, fontWeight: 600, color: 'var(--ink-3)',
      letterSpacing: '-0.01em',
    }}>
      {label}
      <span style={{
        background: tone.bg, color: tone.fg,
        borderRadius: 999, padding: '2px 9px',
        fontSize: 12, fontWeight: 800,
      }}>{value}</span>
    </span>
  );
}

// Tiny progress meter — bar + percentage. Always renders when shown
// so 0% looks like an empty bar rather than nothing.
function ProgressMeter({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      fontSize: 12, fontWeight: 600, color: 'var(--ink-3)',
      letterSpacing: '-0.01em',
    }}>
      Progreso
      <span style={{
        position: 'relative',
        width: 64, height: 6, borderRadius: 999,
        background: 'var(--line-2)', overflow: 'hidden',
      }}>
        <span style={{
          position: 'absolute', inset: 0,
          width: `${pct}%`,
          background: pct >= 100 ? 'var(--good, #0E6E4F)' : 'var(--coral)',
          borderRadius: 999,
        }} />
      </span>
      <span style={{ color: 'var(--ink-2)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
    </span>
  );
}

// Inline empty-state helper used inside opportunity sections (and as a
// stand-in for an "empty" opp list at the outcome level). Sits on whatever
// background it's placed on; uses muted italic copy.
function EmptyOppRow({ children, inline }: {
  children: React.ReactNode;
  inline?: boolean;
}) {
  return (
    <div style={{
      padding: inline ? '6px 8px 2px' : '8px 12px',
      fontSize: 14, color: 'var(--muted)', fontStyle: 'italic',
    }}>
      {children}
    </div>
  );
}

// =====================================================================
// Orphan section — tickets with no opportunity_id
// =====================================================================

function OrphanSection({ tickets, profileById, onOpenTicket }: {
  tickets: Ticket[];
  profileById: Map<string, Profile>;
  onOpenTicket: (id: string) => void;
}) {
  return (
    // Outer card mirrors an outcome card (white). Inside we drop a single
    // tinted region that holds the header + the solution rows, so the orphan
    // group reads exactly like one of the surface-2 opportunity sections.
    <section style={{
      background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14,
      boxShadow: 'var(--shadow-1)', overflow: 'hidden',
    }}>
      <div style={oppListStyle}>
        <div style={{
          background: 'var(--surface-2)',
          borderRadius: 8,
          padding: '10px 14px',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em' }}>Sin oportunidad</div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>
                {tickets.length} ticket{tickets.length === 1 ? '' : 's'} sin asociar — abre cada uno para colgarlo de una oportunidad.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
            {tickets.map(t => (
              <SolutionRow
                key={t.id} ticket={t}
                profileById={profileById}
                onClick={() => onOpenTicket(t.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// Helpers / styles
// =====================================================================

const btnGhostSmall: React.CSSProperties = {
  height: 26, border: '1px solid var(--line-2)', background: 'var(--surface)', color: 'var(--ink-2)',
  fontWeight: 700, fontSize: 13, padding: '0 10px', borderRadius: 999, cursor: 'pointer',
  whiteSpace: 'nowrap', flexShrink: 0,
};
