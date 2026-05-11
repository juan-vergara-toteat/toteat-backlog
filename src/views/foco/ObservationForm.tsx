// =====================================================================
// ObservationForm — modal for recording a metric observation against an
// outcome. Lifted out of FocoView verbatim (no UI changes).
// =====================================================================

import { useState } from 'react';
import type { Outcome, ObservationSource } from '../../lib/database.types';
import { addMetricObservation, updateOutcome } from '../../lib/data';
import { Modal, Field, FormFooter, input, textarea } from './chrome';

const OBS_SOURCES: ObservationSource[] = ['manual', 'query', 'sample', 'imported'];

// Convert a Date to a string suitable for <input type="datetime-local">
// in the user's local timezone. Built-in toISOString() returns UTC, which
// the browser then re-renders against local TZ, producing surprises.
function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ObservationForm({ outcome, actorId, onClose }: {
  outcome: Outcome;
  actorId: string;
  onClose: () => void;
}) {
  const [value, setValue] = useState<string>('');
  const [capturedAt, setCapturedAt] = useState<string>(() => toDatetimeLocal(new Date()));
  const [source, setSource] = useState<ObservationSource>('manual');
  const [note, setNote] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const trimmed = value.trim();
    if (!trimmed) { alert('El valor es obligatorio.'); return; }
    const num = Number(trimmed);
    if (!Number.isFinite(num)) { alert('El valor tiene que ser un número.'); return; }
    if (!capturedAt) { alert('La fecha es obligatoria.'); return; }
    const captured = new Date(capturedAt);
    if (Number.isNaN(captured.getTime())) { alert('La fecha no es válida.'); return; }

    setSaving(true);
    const trimmedNote = note.trim();
    const { error: obsErr } = await addMetricObservation({
      outcome_id: outcome.id,
      value: num,
      captured_at: captured.toISOString(),
      source,
      note: trimmedNote ? trimmedNote : null,
      actor_id: actorId,
    });
    if (obsErr) {
      setSaving(false);
      alert(`No pude guardar la observación: ${obsErr.message}`);
      return;
    }
    // Denormalize: keep outcomes.current_value in sync so list views
    // don't have to query observations to render the headline number.
    const { error: updErr } = await updateOutcome(outcome.id, { current_value: num });
    setSaving(false);
    if (updErr) {
      alert(`Observación guardada, pero no pude actualizar el actual del outcome: ${updErr.message}`);
      return;
    }
    onClose();
  };

  return (
    <Modal title={`Nueva observación · ${outcome.name}`} onClose={onClose}>
      <Field label={`Valor${outcome.metric_unit ? ` (${outcome.metric_unit})` : ''}`}>
        <input
          type="number" step="any" inputMode="decimal" autoFocus
          value={value} onChange={e => setValue(e.target.value)}
          placeholder="ej: 24"
          style={input}
        />
      </Field>
      <Field label="Fecha y hora">
        <input
          type="datetime-local"
          value={capturedAt} onChange={e => setCapturedAt(e.target.value)}
          style={input}
        />
      </Field>
      <Field label="Fuente">
        <select value={source} onChange={e => setSource(e.target.value as ObservationSource)} style={input}>
          {OBS_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="Nota (opcional)">
        <textarea
          value={note} onChange={e => setNote(e.target.value)}
          placeholder="Contexto: post Q1 retro, tras automatización del flujo X…"
          rows={3} style={textarea}
        />
      </Field>

      <FormFooter onCancel={onClose} onSave={save} saving={saving} />
    </Modal>
  );
}
