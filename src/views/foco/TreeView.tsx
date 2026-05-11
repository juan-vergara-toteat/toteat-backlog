// =====================================================================
// TreeView — node-link diagram visualization of the Opportunity Solution
// Tree.
//
//   [Outcome]                                (root, 1 per subtree)
//      └── [Opportunity]
//             └── [Solution ticket]
//             └── [Solution ticket]
//             └── ...
//
// Opportunities lay out horizontally under the outcome (one column each).
// Solution tickets stack vertically under their opportunity so a long
// backlog grows downward, not sideways. Each opportunity therefore
// occupies one horizontal slot regardless of how many tickets it owns.
//
// Connectors are right-angle elbows from outcome → opp; for tickets we
// draw a vertical trunk from the opp down and a short horizontal stub
// into each ticket so the parent-child relationship reads at a glance.
//
// This view is read-only-clickable: clicking a node opens the same edit
// modals / SidePanel as FocoView. Adds still go through the list view.
// =====================================================================

import { useMemo, useState } from 'react';
import type {
  Outcome, Opportunity, Ticket, Profile, MetricObservation,
  OutcomeDirection, OutcomeHorizon, TicketStatus,
} from '../../lib/database.types';
import {
  Avatar, FilterPill,
  STATUS_COLOR, HORIZON_COLOR, CONFIDENCE_COLOR,
  DIRECTION_ARROW, fmtMetric,
  type Confidence,
} from '../atoms';
import { OutcomeForm } from './OutcomeForm';
import { OpportunityForm } from './OpportunityForm';
import { btnPrimary } from './chrome';

// =====================================================================
// Filter modes — same semantics as FocoView
// =====================================================================

type FilterMode = 'all' | 'now' | 'next' | 'later';
const FILTERS: { mode: FilterMode; label: string }[] = [
  { mode: 'all',   label: 'All' },
  { mode: 'now',   label: 'Now' },
  { mode: 'next',  label: 'Next' },
  { mode: 'later', label: 'Later' },
];

// =====================================================================
// Node sizes (px). Outcome > Opp > Ticket so the hierarchy reads from
// node footprint alone. Heights are generous because every node now
// carries description + metadata, matching the list view's density.
// =====================================================================

const OUTCOME_W = 380, OUTCOME_H = 180;
const OPP_W     = 320, OPP_H     = 180;
const SOL_W     = 256, SOL_H     = 124;

// Horizontal gap between sibling opportunity columns.
const COL_GAP = 28;
// Vertical gap between outcome → opp and opp → first ticket.
const LAYER_GAP = 56;
// Vertical gap between stacked tickets in a column.
const TICKET_GAP = 14;
// Vertical gap between root subtrees.
const SUBTREE_GAP = 80;
// Outer canvas padding.
const PADDING = 32;

// Horizontal slot allocated per opportunity column.
const COL_SLOT = OPP_W + COL_GAP;

// Ticket subtree geometry: a vertical trunk runs down the left side of
// the column, with horizontal stubs branching right into each ticket.
// This avoids the "stacked sequence / 1-2-3 priority" feel a centered
// trunk creates and signals that tickets are siblings.
const TRUNK_INSET  = 24;  // trunk distance from opp's left edge
const TICKET_INSET = 52;  // ticket distance from opp's left edge

// =====================================================================
// Layout types
// =====================================================================

type LaidOutSolution = {
  kind: 'solution';
  ticket: Ticket;
  x: number; y: number; w: number; h: number;
};

type LaidOutOpp = {
  kind: 'opp';
  opp: Opportunity;
  x: number; y: number; w: number; h: number;
  solutions: LaidOutSolution[];
};

type LaidOutRoot = {
  kind: 'root';
  outcome: Outcome;
  x: number; y: number; w: number; h: number;
  opps: LaidOutOpp[];
  // Total bounding box of the subtree (used for stacking + scroll).
  totalWidth: number;
  totalHeight: number;
};

// =====================================================================
// Top-level view
// =====================================================================

export function TreeView({
  outcomes, opportunities, tickets, profiles, onOpenTicket, onSwitchToLista,
}: {
  outcomes: Outcome[];
  opportunities: Opportunity[];
  tickets: Ticket[];
  // observations is unused in v1 but accepted for API parity with FocoView.
  observations: MetricObservation[];
  profiles: Profile[];
  onOpenTicket: (id: string) => void;
  onSwitchToLista?: () => void;
}) {
  const [filter, setFilter] = useState<FilterMode>('all');
  // Tree v1 only opens existing entities for edit, so the "_new" branch
  // never fires today — but we keep the same union shape as FocoView so
  // future "+ from tree" affordances can plug in without changing types.
  const [editingOutcome, setEditingOutcome] = useState<
    Outcome | { _new: true } | null
  >(null);
  const [editingOpportunity, setEditingOpportunity] = useState<
    Opportunity | { _new: true; outcome_id: string } | null
  >(null);

  // ----- Indexes --------------------------------------------------------
  const profileById = useMemo(
    () => new Map(profiles.map(p => [p.id, p])),
    [profiles],
  );

  const oppsByOutcome = useMemo(() => {
    const m = new Map<string, Opportunity[]>();
    outcomes.forEach(o => m.set(o.id, []));
    opportunities.forEach(op => {
      if (!m.has(op.outcome_id)) m.set(op.outcome_id, []);
      m.get(op.outcome_id)!.push(op);
    });
    return m;
  }, [outcomes, opportunities]);

  const ticketsByOpp = useMemo(() => {
    const m = new Map<string, Ticket[]>();
    tickets.forEach(t => {
      if (!t.opportunity_id) return;
      if (!m.has(t.opportunity_id)) m.set(t.opportunity_id, []);
      m.get(t.opportunity_id)!.push(t);
    });
    return m;
  }, [tickets]);

  const orphanCount = useMemo(
    () => tickets.filter(t => !t.opportunity_id).length,
    [tickets],
  );

  // ----- Filter helpers -------------------------------------------------
  function rootMatchesHorizon(o: Outcome): boolean {
    if (filter === 'all') return true;
    return ((o.horizon as OutcomeHorizon | null) ?? 'later') === filter;
  }

  function visibleOpps(o: Outcome): Opportunity[] {
    return oppsByOutcome.get(o.id) ?? [];
  }

  // ----- Layout ---------------------------------------------------------
  function layoutRoot(root: Outcome): LaidOutRoot {
    const directOpps = visibleOpps(root);
    const hasOpps = directOpps.length > 0;
    const colCount = Math.max(1, directOpps.length);
    // Floor the subtree width by the outcome's own width so the root card
    // always fits — a single-column subtree (or a childless outcome) used
    // to clip the outcome on the left because its width exceeded the row.
    const totalWidth = Math.max(OUTCOME_W, colCount * COL_SLOT);

    // Layer Y positions. Outcome row, then opp row, then a vertical stack
    // of tickets under each opp.
    const outcomeY = 0;
    const oppY = OUTCOME_H + LAYER_GAP;
    const firstSolY = oppY + OPP_H + LAYER_GAP;

    const laidDirectOpps: LaidOutOpp[] = directOpps.map((op, colIdx) => {
      const ts = ticketsByOpp.get(op.id) ?? [];
      // Spread opp columns across the (possibly widened) totalWidth so
      // they stay symmetric under a wider outcome card too.
      const colCenterX = ((colIdx + 0.5) / colCount) * totalWidth;
      const oppX = colCenterX - OPP_W / 2;

      // Tickets are offset to the right of a left-side trunk — see the
      // TRUNK_INSET / TICKET_INSET constants above. Each ticket sits flush
      // against the same x so their stubs are uniform.
      const ticketX = oppX + TICKET_INSET;
      const sols: LaidOutSolution[] = ts.map((t, i) => ({
        kind: 'solution',
        ticket: t,
        x: ticketX,
        y: firstSolY + i * (SOL_H + TICKET_GAP),
        w: SOL_W, h: SOL_H,
      }));

      return {
        kind: 'opp',
        opp: op,
        x: oppX,
        y: oppY,
        w: OPP_W, h: OPP_H,
        solutions: sols,
      };
    });

    // Total height depends on the deepest column:
    //   - No opps          → just the outcome card.
    //   - Opps, no tickets → outcome + opp row.
    //   - Has tickets      → opps + the tallest ticket stack.
    const maxTickets = directOpps.reduce(
      (m, op) => Math.max(m, (ticketsByOpp.get(op.id) ?? []).length),
      0,
    );
    const totalHeight = !hasOpps
      ? OUTCOME_H
      : maxTickets === 0
      ? oppY + OPP_H
      : firstSolY + maxTickets * SOL_H + (maxTickets - 1) * TICKET_GAP;

    // Outcome card centered over the whole row of columns.
    const rootCenterX = totalWidth / 2;

    return {
      kind: 'root',
      outcome: root,
      x: rootCenterX - OUTCOME_W / 2,
      y: outcomeY,
      w: OUTCOME_W, h: OUTCOME_H,
      opps: laidDirectOpps,
      totalWidth,
      totalHeight,
    };
  }

  const visibleRoots = useMemo(
    () => outcomes.filter(rootMatchesHorizon),
    // rootMatchesHorizon closes over filter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [outcomes, filter],
  );
  const laidOut = useMemo(
    () => visibleRoots.map(r => layoutRoot(r)),
    // layoutRoot reads from oppsByOutcome / ticketsByOpp which derive from
    // (outcomes, opportunities, tickets); refresh on any of those.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleRoots, outcomes, opportunities, tickets],
  );

  // ----- Empty state ----------------------------------------------------
  if (outcomes.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Header filter={filter} setFilter={setFilter} />
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
          {onSwitchToLista && (
            <button onClick={onSwitchToLista} style={btnPrimary}>
              Ir a la vista Lista para crear
            </button>
          )}
        </div>
      </div>
    );
  }

  // ----- Render ---------------------------------------------------------
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Header filter={filter} setFilter={setFilter} />

      {visibleRoots.length === 0 ? (
        <EmptyHint filter={filter} />
      ) : (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: SUBTREE_GAP,
          background: 'var(--surface-2)', borderRadius: 14, padding: PADDING,
          border: '1px solid var(--line)',
        }}>
          {laidOut.map(root => (
            <SubtreeSVG
              key={root.outcome.id}
              root={root}
              profileById={profileById}
              onOpenOutcome={(o) => setEditingOutcome(o)}
              onOpenOpportunity={(op) => setEditingOpportunity(op)}
              onOpenTicket={onOpenTicket}
            />
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14, color: 'var(--ink-3)' }}>
        <div>Para agregar nuevos elementos, usa la vista Lista.</div>
        {orphanCount > 0 && filter === 'all' && (
          <div>
            {orphanCount} ticket{orphanCount === 1 ? '' : 's'} sin oportunidad —{' '}
            <button
              onClick={() => onSwitchToLista?.()}
              style={{
                background: 'transparent', border: 0, padding: 0,
                color: 'var(--coral)', fontWeight: 700, cursor: 'pointer',
                textDecoration: 'underline', fontSize: 14,
              }}
            >
              ábrelos desde la vista Lista para asociarlos.
            </button>
          </div>
        )}
      </div>

      {/* Modals — same shape as FocoView. ------------------------------- */}
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
    </div>
  );
}

// =====================================================================
// Header — filter pills only (Lista/Árbol toggle lives in Workspace).
// =====================================================================

function Header({ filter, setFilter }: {
  filter: FilterMode;
  setFilter: (f: FilterMode) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {FILTERS.map(f => (
        <FilterPill
          key={f.mode}
          label={f.label}
          active={filter === f.mode}
          onClick={() => setFilter(f.mode)}
        />
      ))}
    </div>
  );
}

function EmptyHint({ filter }: { filter: FilterMode }) {
  const text = filter === 'now'
    ? 'No hay outcomes en "Now". Cambiá el horizonte de un outcome desde su tarjeta en la vista Lista.'
    : filter === 'next'
    ? 'No hay outcomes en "Next". Cambiá el horizonte de un outcome desde su tarjeta en la vista Lista.'
    : filter === 'later'
    ? 'No hay outcomes en "Later". Cambiá el horizonte de un outcome desde su tarjeta en la vista Lista.'
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
// Subtree SVG — one root + its children. Connectors are drawn as SVG
// paths underneath, nodes are rendered as absolutely-positioned HTML on
// top so we get rich text/avatars without fighting foreignObject quirks.
// =====================================================================

function SubtreeSVG({
  root, profileById, onOpenOutcome, onOpenOpportunity, onOpenTicket,
}: {
  root: LaidOutRoot;
  profileById: Map<string, Profile>;
  onOpenOutcome: (o: Outcome) => void;
  onOpenOpportunity: (op: Opportunity) => void;
  onOpenTicket: (id: string) => void;
}) {
  const width = root.totalWidth;
  const height = root.totalHeight;

  // Outcome → Opp connector: standard right-angle elbow with rounded
  // corners through the midline.
  function elbowPath(px: number, py: number, cx: number, cy: number): string {
    const midY = (py + cy) / 2;
    const r = 6;
    if (Math.abs(px - cx) < 0.5) {
      return `M ${px} ${py} L ${cx} ${cy}`;
    }
    const cornerSign = cx > px ? 1 : -1;
    return [
      `M ${px} ${py}`,
      `L ${px} ${midY - r}`,
      `Q ${px} ${midY} ${px + cornerSign * r} ${midY}`,
      `L ${cx - cornerSign * r} ${midY}`,
      `Q ${cx} ${midY} ${cx} ${midY + r}`,
      `L ${cx} ${cy}`,
    ].join(' ');
  }

  const connectors: { d: string; key: string }[] = [];
  const rootBottomX = root.x + root.w / 2;
  const rootBottomY = root.y + root.h;

  root.opps.forEach(op => {
    connectors.push({
      key: `r-o-${op.opp.id}`,
      d: elbowPath(rootBottomX, rootBottomY, op.x + op.w / 2, op.y),
    });
    // Ticket subtree: a single trunk drops from the opp's bottom-center,
    // elbows left to a left-aligned trunk line, then runs down past each
    // ticket. Each ticket gets a short horizontal stub branching right.
    // This is the "folder tree" idiom — siblings, not a chain.
    if (op.solutions.length > 0) {
      const oppCx = op.x + op.w / 2;
      const oppBottomY = op.y + op.h;
      const trunkX = op.x + TRUNK_INSET;
      const lastTicket = op.solutions[op.solutions.length - 1];
      const lastTicketCy = lastTicket.y + lastTicket.h / 2;
      // Elbow horizontal arm sits 14px below the opp — close enough to
      // read as "the opp's child connector," with room for the corner
      // radius without clipping.
      const elbowY = oppBottomY + 14;
      const r = 6;
      const sign = trunkX < oppCx ? -1 : 1;
      connectors.push({
        key: `o-trunk-${op.opp.id}`,
        d: [
          `M ${oppCx} ${oppBottomY}`,
          `L ${oppCx} ${elbowY - r}`,
          `Q ${oppCx} ${elbowY} ${oppCx + sign * r} ${elbowY}`,
          `L ${trunkX - sign * r} ${elbowY}`,
          `Q ${trunkX} ${elbowY} ${trunkX} ${elbowY + r}`,
          `L ${trunkX} ${lastTicketCy}`,
        ].join(' '),
      });
      op.solutions.forEach(sol => {
        const cy = sol.y + sol.h / 2;
        connectors.push({
          key: `o-stub-${sol.ticket.id}`,
          d: `M ${trunkX} ${cy} L ${sol.x} ${cy}`,
        });
      });
    }
  });

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ position: 'relative', width, height, minWidth: width }}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{
            display: 'block', position: 'absolute', inset: 0,
            pointerEvents: 'none',
          }}
        >
          <g fill="none" stroke="var(--line-2)" strokeWidth={1.5}>
            {connectors.map(c => <path key={c.key} d={c.d} />)}
          </g>
        </svg>

        {/* Root outcome */}
        <OutcomeNode
          x={root.x} y={root.y} w={root.w} h={root.h}
          outcome={root.outcome}
          profileById={profileById}
          onClick={() => onOpenOutcome(root.outcome)}
        />

        {/* Opps + their vertically-stacked solutions */}
        {root.opps.map(op => (
          <div key={op.opp.id}>
            <OpportunityNode
              x={op.x} y={op.y} w={op.w} h={op.h}
              opp={op.opp}
              profileById={profileById}
              onClick={() => onOpenOpportunity(op.opp)}
            />
            {op.solutions.map(sol => (
              <SolutionNode
                key={sol.ticket.id}
                x={sol.x} y={sol.y} w={sol.w} h={sol.h}
                ticket={sol.ticket}
                profileById={profileById}
                onClick={() => onOpenTicket(sol.ticket.id)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================================
// Node shells & content — absolutely positioned HTML inside the subtree.
// HTML (not foreignObject) keeps avatars, hover, and text rendering
// behaving exactly like the rest of the app.
// =====================================================================

const NODE_RADIUS = 14;

function NodeShell({
  x, y, w, h, fill, accentLeft, onClick, ariaLabel, children,
}: {
  x: number; y: number; w: number; h: number;
  fill: string;
  // Optional left-edge accent stripe (color token). Used to give the
  // opportunity node a recognizable color identity distinct from tickets.
  accentLeft?: string;
  onClick: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      role="button"
      aria-label={ariaLabel}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'absolute',
        left: x, top: y, width: w, height: h,
        background: fill,
        border: '1px solid var(--line)',
        borderLeft: accentLeft ? `4px solid ${accentLeft}` : '1px solid var(--line)',
        borderRadius: NODE_RADIUS,
        boxShadow: hover ? 'var(--shadow-1)' : '0 1px 2px rgba(27,27,27,0.06)',
        cursor: 'pointer',
        transition: 'box-shadow 80ms ease-out, transform 80ms ease-out',
        transform: hover ? 'translateY(-1px)' : 'translateY(0)',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

// Small "Expected outcome" / "Opportunity" / "Ticket" tag that sits in
// the top-left corner of every node and tells the reader which layer
// they're looking at.
function TypeLabel({ text }: { text: string }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
      textTransform: 'uppercase', color: 'var(--ink-3)',
    }}>
      {text}
    </div>
  );
}

// =====================================================================
// Outcome node
// =====================================================================

function OutcomeNode({ x, y, w, h, outcome, profileById, onClick }: {
  x: number; y: number; w: number; h: number;
  outcome: Outcome;
  profileById: Map<string, Profile>;
  onClick: () => void;
}) {
  const horizon = (outcome.horizon as OutcomeHorizon | null) ?? 'later';
  const tone = HORIZON_COLOR[horizon];
  const owner = outcome.owner_id ? profileById.get(outcome.owner_id) : null;
  return (
    <NodeShell
      x={x} y={y} w={w} h={h}
      fill="var(--coral-100)"
      onClick={onClick}
      ariaLabel={`Outcome: ${outcome.name}`}
    >
      <div style={{
        padding: '12px 14px', display: 'flex', flexDirection: 'column',
        height: '100%', boxSizing: 'border-box', gap: 6,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <TypeLabel text="Expected outcome" />
          <span style={{
            background: tone.bg, color: tone.fg,
            borderRadius: 999, padding: '2px 8px',
            fontSize: 11, fontWeight: 800, letterSpacing: '-0.01em',
            textTransform: 'capitalize', flexShrink: 0,
          }}>{horizon}</span>
        </div>
        <div style={{
          fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em',
          lineHeight: 1.25, color: 'var(--ink)',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{outcome.name}</div>
        {outcome.description && (
          <div style={{
            fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.45,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{outcome.description}</div>
        )}
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{
            fontSize: 14, color: 'var(--ink-2)', fontWeight: 700,
            display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
              {fmtMetric(outcome.current_value)}
            </span>
            <span style={{ color: 'var(--ink-3)' }}>{DIRECTION_ARROW[outcome.direction as OutcomeDirection]}</span>
            <span>{fmtMetric(outcome.target_value)}</span>
            {outcome.metric_unit && <span style={{ color: 'var(--ink-3)' }}>{outcome.metric_unit}</span>}
          </div>
          {owner && <Avatar name={owner.name} initials={owner.initials} color={owner.color} size={24} />}
        </div>
      </div>
    </NodeShell>
  );
}

// =====================================================================
// Opportunity node
// =====================================================================

function OpportunityNode({ x, y, w, h, opp, profileById, onClick }: {
  x: number; y: number; w: number; h: number;
  opp: Opportunity;
  profileById: Map<string, Profile>;
  onClick: () => void;
}) {
  const confidence = (opp.confidence ?? 'Medium') as Confidence;
  const tone = CONFIDENCE_COLOR[confidence];
  const owner = opp.owner_id ? profileById.get(opp.owner_id) : null;
  return (
    <NodeShell
      x={x} y={y} w={w} h={h}
      fill="var(--surface)"
      accentLeft="var(--coral)"
      onClick={onClick}
      ariaLabel={`Opportunity: ${opp.title}`}
    >
      <div style={{
        padding: '12px 14px', display: 'flex', flexDirection: 'column',
        height: '100%', boxSizing: 'border-box', gap: 6,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <TypeLabel text="Opportunity" />
          <span style={{
            background: tone.bg, color: tone.fg,
            borderRadius: 999, padding: '2px 8px',
            fontSize: 11, fontWeight: 800, letterSpacing: '-0.01em',
            flexShrink: 0,
          }}>{confidence}</span>
        </div>
        <div style={{
          fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em',
          lineHeight: 1.3, color: 'var(--ink)',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{opp.title}</div>
        {opp.description && (
          <div style={{
            fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.45,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{opp.description}</div>
        )}
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {opp.impact_estimate ? (
            <div style={{
              fontSize: 12, color: 'var(--ink-3)', fontWeight: 600,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              Impact: {opp.impact_estimate}
            </div>
          ) : <span />}
          {owner && <Avatar name={owner.name} initials={owner.initials} color={owner.color} size={24} />}
        </div>
      </div>
    </NodeShell>
  );
}

// =====================================================================
// Solution (ticket) node
// =====================================================================

function SolutionNode({ x, y, w, h, ticket, profileById, onClick }: {
  x: number; y: number; w: number; h: number;
  ticket: Ticket;
  profileById: Map<string, Profile>;
  onClick: () => void;
}) {
  const tone = STATUS_COLOR[ticket.status as TicketStatus];
  const owner = ticket.owner_id ? profileById.get(ticket.owner_id) : null;
  return (
    <NodeShell
      x={x} y={y} w={w} h={h}
      fill="var(--surface)"
      onClick={onClick}
      ariaLabel={`Ticket: ${ticket.item}`}
    >
      <div style={{
        padding: '10px 12px', display: 'flex', flexDirection: 'column',
        height: '100%', boxSizing: 'border-box', gap: 4,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <TypeLabel text="Ticket" />
          <span style={{
            background: tone.bg, color: tone.fg,
            borderRadius: 999, padding: '2px 8px',
            fontSize: 11, fontWeight: 800, letterSpacing: '-0.01em',
            flexShrink: 0,
          }}>{ticket.status}</span>
        </div>
        <div style={{
          fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em',
          lineHeight: 1.3, color: 'var(--ink)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{ticket.item}</div>
        {ticket.description && (
          <div style={{
            fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.4,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{ticket.description}</div>
        )}
        {owner && (
          <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
            <Avatar name={owner.name} initials={owner.initials} color={owner.color} size={22} />
          </div>
        )}
      </div>
    </NodeShell>
  );
}
