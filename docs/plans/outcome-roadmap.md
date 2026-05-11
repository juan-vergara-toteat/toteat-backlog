# Outcome-driven Roadmap — Implementation Plan

Restructure the backlog from a project-by-time model (`bloque`, `eje`, deadlines) to an outcome-by-impact model. Existing tickets stay valid; we add three new entities (outcomes, opportunities, metric_observations) and a new top-level UI surface ("Foco") that organizes work via Opportunity Solution Trees and a Now / Next / Later view.

Reference: see context shared with Claude on outcome-driven roadmaps (Teresa Torres, Marty Cagan, John Cutler) — the user already endorsed the direction.

## Conceptual model

| Concept | Where it lives |
|---|---|
| **Outcome** (metric: "horas operativas/mes") | New `outcomes` table |
| **Opportunity** (pain point in user voice) | New `opportunities` table, FK to outcome |
| **Solution** | Existing `tickets` table, gains `opportunity_id` FK |
| **Metric observation** | New `metric_observations` table, append-only per outcome |

## Decisions locked in

- `ejes` / `temas` / `bloques` stay untouched — orthogonal taxonomy, no disruption to existing UI
- `tickets.opportunity_id` is nullable — existing 65 tickets remain valid, attached gradually
- Now / Next / Later derived from data, not stored: Now = in-progress tickets, Next = opportunities being explored, Later = outcomes
- All new tables follow existing RLS pattern (`is_toteat_user()`)
- All new tables added to `supabase_realtime` publication

## Phases

### Phase 1 — Schema foundation (1 task)

Single migration `0007_outcome_model.sql`:
- `outcomes` table (flat — North Star metrics)
- `opportunities` table with FK to outcome
- `metric_observations` table for append-only metric history
- `tickets.opportunity_id` (nullable FK)
- RLS policies, realtime publication
- Regenerate types, add domain aliases

**Output:** Three new tables visible in Supabase Studio. No UI change yet. Existing UI keeps working.

### Phase 2 — Outcome-first UI (3 tasks)

**Task 2A — Data layer**: `useOutcomes`, `useOpportunities`, `useMetricObservations` hooks + CRUD functions in `data.ts`. Pure data plumbing, no UI.

**Task 2B — Foco views**: New `Foco` top-level tab in `Workspace.tsx`. Three sub-views:
- Outcomes tree (cards, current vs. target)
- Opportunities board (per outcome, with linked solution tickets)
- Now / Next / Later auto-derived layout

**Task 2C — Ticket ↔ Opportunity link**: Add opportunity selector to `SidePanel.tsx` so existing tickets can be attached to an opportunity over time.

### Phase 3 — Measurement loop (1 task)

**Task 3A — Metric observations + sparklines**: Form to log a metric observation against an outcome. Sparkline renders historic observations on each outcome card. Simple monthly retro export (HTML/markdown copy-to-clipboard).

## Out of scope (for now)

- Automated metric capture (cron jobs pulling from MongoDB / Supabase queries) — manual entry first
- Outcome detail page with full timeline / activity log — keep it simple
- Soft delete of outcomes/opportunities — not needed at this volume
- Renaming `ejes` to `outcome_categories` — defer until we know if it makes sense

## Detailed task specs

Each task spec is the full text passed to the implementer subagent. See in-conversation dispatch for full text — this file is the index and design doc.

| # | Task | Files touched (primary) |
|---|---|---|
| 1 | Schema foundation | `supabase/migrations/0007_outcome_model.sql`, `src/lib/database.types.ts` |
| 2A | Data layer | `src/lib/data.ts` |
| 2B | Foco views | `src/views/FocoView.tsx` (new), `src/views/Workspace.tsx` |
| 2C | Ticket ↔ Opportunity | `src/views/SidePanel.tsx` |
| 3A | Observations + sparklines | `src/views/FocoView.tsx`, `src/lib/data.ts` |

---

## Phase 4 — Radical simplification (the OST paradigm purge)

After Phases 1-3 layered the OST model **on top of** the old project-by-time taxonomy, this phase **removes the taxonomy** so the OST tree is the only paradigm in the system. The product becomes one tab, one tree: **Outcome → Opportunity → Solution (ticket)**.

### Decisions locked in

- **Drop tables**: `ejes`, `temas`, `bloques` — replaced by outcomes + opportunities
- **Drop ticket columns**: `bloque_id`, `eje_id`, `tema_id`, `epic`, `start_month`, `deadline_month` — Gantt thinking gone
- **Three tiers only** (Outcome → Opportunity → Solution). No experiments table; spike-style work goes into a regular ticket with `tipo='Spike'`.
- **Drop CSV import** — was tied to old fields, breaks anyway
- **Existing 65 tickets survive** with their core fields (item, description, status, owner, opportunity_id). They start as orphans visible in a "Sin oportunidad" section; user re-attaches over time.
- **One tab** (Foco). No more Tabla / Timeline / Tablero / Dashboard. The topbar search adapts or moves into the tree.
- **Now / Next / Later** is a filter on opportunities, not a separate layout

### Phase tasks

| # | Task | Files touched (primary) |
|---|---|---|
| 4A | Schema purge — migration `0008_purge_obsolete_taxonomy.sql` drops three tables + six ticket columns, updates activity trigger `v_cols`. Types regen. | `supabase/migrations/0008_purge_obsolete_taxonomy.sql`, `src/lib/database.types.ts` |
| 4B | UI purge — delete `TimelineView`, `TableView`, `BoardView`, `DashboardView`, `csv.ts`. Strip `useCatalogs`, `Eje`/`Tema`/`Bloque` types. SidePanel loses Eje/Tema/Bloque/Inicio/Deadline rows. Workspace becomes thin shell with single Foco. | `src/views/Workspace.tsx`, `src/views/SidePanel.tsx`, `src/lib/data.ts`, `src/lib/database.types.ts`, plus deletions |
| 4C | OST tree rewrite — replace FocoView's three-section layout with a true tree. Outcomes top-level cards, opportunities nested, solutions nested under opportunities, orphan-tickets section at bottom. Now/Next/Later filter pills. Extract forms to `src/views/foco/`. | `src/views/FocoView.tsx`, `src/views/foco/*.tsx` (new) |
| 4D | Sweep — verify no dead imports / unused types / orphan references. Final types regen + build + browser smoke test. | All files (audit only) |

### What gets simpler

After Phase 4:
- 3 entity tables in the public schema (excluding profiles + audit log): `outcomes`, `opportunities`, `tickets`. Plus `metric_observations`, `comments`, `activity`, `ticket_owners`, `profiles`.
- 1 top-level UI surface: FocoView (the tree)
- 1 entity edit panel: SidePanel for tickets, modal forms for outcomes/opportunities/observations (extracted into separate files)
- 0 Gantt-like time fields on tickets

Every table in the schema can be explained in one sentence. Every UI surface answers a single question. The system is the OST tree plus its supporting plumbing — nothing more.
