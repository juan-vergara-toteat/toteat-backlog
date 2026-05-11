// =====================================================================
// Retro export — genera un markdown con el estado actual del roadmap
// (outcomes + sus oportunidades activas + última observación).
// Pura: no toca clipboard ni DOM. La UI llama a `buildRetroMarkdown` y
// se encarga del navigator.clipboard.writeText.
// =====================================================================

import type {
  Outcome, Opportunity, MetricObservation, OutcomeDirection, OutcomeCadence,
} from '../../lib/database.types';
import { DIRECTION_ARROW, CADENCE_LABEL, fmtRel, fmtMetric } from '../atoms';

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function fmtSignedDelta(n: number): string {
  if (n === 0) return '0';
  // Format |n| once and prepend the sign, so positive and negative values
  // render symmetrically (previously the negative branch's Number() round-
  // trip dropped trailing zeros — "+0.50" vs "-0.5").
  const abs = Math.abs(n);
  const formatted = abs < 1
    ? abs.toFixed(2)
    : (Number.isInteger(abs) ? String(abs) : abs.toFixed(1));
  return (n > 0 ? '+' : '-') + formatted;
}

export function buildRetroMarkdown({
  outcomes,
  opportunities,
  observations,
  solutionCounts,
  now = new Date(),
}: {
  outcomes: Outcome[];
  opportunities: Opportunity[];
  observations: MetricObservation[];
  // Map<opportunity_id, ticket count>. Las soluciones en este modelo son
  // tickets atados a oportunidades.
  solutionCounts: Map<string, number>;
  now?: Date;
}): string {
  const monthName = MONTHS_ES[now.getMonth()];
  const year = now.getFullYear();

  // Pre-agrupar para no recorrer todo en cada outcome.
  const obsByOutcome = new Map<string, MetricObservation[]>();
  observations.forEach(o => {
    if (!obsByOutcome.has(o.outcome_id)) obsByOutcome.set(o.outcome_id, []);
    obsByOutcome.get(o.outcome_id)!.push(o);
  });

  const oppsByOutcome = new Map<string, Opportunity[]>();
  opportunities.forEach(op => {
    if (!oppsByOutcome.has(op.outcome_id)) oppsByOutcome.set(op.outcome_id, []);
    oppsByOutcome.get(op.outcome_id)!.push(op);
  });

  const lines: string[] = [];
  lines.push(`# Estado del Roadmap — ${monthName} ${year}`);
  lines.push('');

  let printedAnything = false;

  for (const o of outcomes) {
    // Skip outcomes sin current_value para no llenar el doc de ruido.
    if (o.current_value === null || o.current_value === undefined) continue;
    printedAnything = true;

    const unit = o.metric_unit ? ` ${o.metric_unit}` : '';
    const arrow = DIRECTION_ARROW[(o.direction ?? 'down') as OutcomeDirection];
    const cadence = CADENCE_LABEL[(o.cadence ?? 'monthly') as OutcomeCadence];

    const allObs = (obsByOutcome.get(o.id) ?? []).slice().sort(
      (a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime(),
    );
    // Observaciones del mes actual (mismo año + mes que `now`).
    const obsThisMonth = allObs.filter(ob => {
      const d = new Date(ob.captured_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    const lastObs = allObs.length > 0 ? allObs[allObs.length - 1] : null;

    let deltaText = '';
    if (o.baseline_value !== null && o.baseline_value !== undefined) {
      const delta = (o.current_value as number) - (o.baseline_value as number);
      deltaText = ` (${arrow}${fmtSignedDelta(delta)})`;
    } else {
      deltaText = ` (${arrow})`;
    }

    lines.push(`## ${o.name}`);
    if (o.description && o.description.trim()) {
      lines.push(o.description.trim());
    }
    lines.push('');
    lines.push(`- **Baseline:** ${fmtMetric(o.baseline_value)}${unit}`);
    lines.push(`- **Actual:** ${fmtMetric(o.current_value)}${unit}${deltaText}`);
    lines.push(`- **Target:** ${fmtMetric(o.target_value)}${unit}`);
    lines.push(`- **Cadencia:** ${cadence}`);
    lines.push(`- **Observaciones este mes:** ${obsThisMonth.length}`);
    if (lastObs) {
      lines.push(`- **Última observación:** ${fmtMetric(lastObs.value)} (${fmtRel(lastObs.captured_at)})`);
    } else {
      lines.push(`- **Última observación:** —`);
    }
    lines.push('');

    // Lista todas las oportunidades vinculadas al outcome. El usuario puede
    // editar el markdown después de copiarlo si quiere filtrar manualmente.
    const opps = oppsByOutcome.get(o.id) ?? [];
    if (opps.length > 0) {
      lines.push('### Oportunidades');
      for (const op of opps) {
        const n = solutionCounts.get(op.id) ?? 0;
        const conf = op.confidence ? ` (${op.confidence})` : '';
        const impact = op.impact_estimate ? ` · ${op.impact_estimate}` : '';
        const solutions = `${n} solu${n === 1 ? 'ción' : 'ciones'}`;
        lines.push(`- **${op.title}**${conf} — ${solutions}${impact}`);
      }
      lines.push('');
    }
  }

  if (!printedAnything) {
    lines.push('_Aún no hay outcomes con `current_value` para reportar._');
    lines.push('');
  }

  return lines.join('\n').trim() + '\n';
}
