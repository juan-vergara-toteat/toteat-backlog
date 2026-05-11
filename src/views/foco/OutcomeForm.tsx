// =====================================================================
// OutcomeForm — modal for creating/editing an outcome.
// Lifted out of FocoView to keep the tree view focused on layout.
// =====================================================================

import { useEffect, useState } from 'react';
import type { Outcome, Profile, OutcomeDirection, OutcomeCadence, OutcomeHorizon } from '../../lib/database.types';
import { createOutcome, updateOutcome, deleteOutcome } from '../../lib/data';
import { CADENCE_LABEL, DIRECTION_LABEL, HORIZON_OPTIONS } from '../atoms';
import { Modal, Field, Row, FormFooter, input, textarea } from './chrome';

const CADENCES: OutcomeCadence[] = ['weekly', 'monthly', 'quarterly'];

export function OutcomeForm({ outcome, profiles, onClose }: {
  outcome: Outcome | null;
  outcomes: Outcome[];
  profiles: Profile[];
  onClose: () => void;
}) {
  const isNew = outcome === null;
  const [draft, setDraft] = useState<Partial<Outcome>>(outcome ?? {
    name: '', description: '', metric_unit: '',
    direction: 'down', cadence: 'monthly',
    horizon: 'later',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(outcome ?? {
      name: '', direction: 'down', cadence: 'monthly',
      horizon: 'later',
    });
  }, [outcome]);

  const set = <K extends keyof Outcome>(k: K, v: Outcome[K]) => setDraft(d => ({ ...d, [k]: v }));

  const save = async () => {
    if (!draft.name || !draft.name.trim()) { alert('El nombre es obligatorio.'); return; }
    setSaving(true);
    const payload = {
      ...draft,
      name: draft.name.trim(),
      direction: (draft.direction || 'down') as OutcomeDirection,
    };
    const { error } = isNew
      ? await createOutcome(payload as Partial<Outcome> & { name: string })
      : await updateOutcome(outcome!.id, payload);
    setSaving(false);
    if (error) { alert(`No pude guardar: ${error.message}`); return; }
    onClose();
  };

  const remove = async () => {
    if (!outcome || !confirm('¿Eliminar outcome? Las oportunidades y observaciones vinculadas se eliminarán también.')) return;
    const { error } = await deleteOutcome(outcome.id);
    if (error) { alert(`No pude eliminar: ${error.message}`); return; }
    onClose();
  };

  return (
    <Modal title={isNew ? 'Nuevo outcome' : 'Editar outcome'} onClose={onClose}>
      <Field label="Nombre">
        <input value={draft.name ?? ''} onChange={e => set('name', e.target.value)}
               placeholder="Bajar horas operativas/mes a 12"
               style={input} />
      </Field>
      <Field label="Descripción">
        <textarea value={draft.description ?? ''} onChange={e => set('description', e.target.value)}
                  placeholder="¿Por qué importa? ¿A quién afecta?" rows={3} style={textarea} />
      </Field>
      <Row>
        <Field label="Unidad" flex>
          <input value={draft.metric_unit ?? ''} onChange={e => set('metric_unit', e.target.value)}
                 placeholder="horas/mes, %, CLP" style={input} />
        </Field>
        <Field label="Cadencia" flex>
          <select value={draft.cadence ?? 'monthly'} onChange={e => set('cadence', e.target.value as OutcomeCadence)} style={input}>
            {CADENCES.map(c => <option key={c} value={c}>{CADENCE_LABEL[c]}</option>)}
          </select>
        </Field>
      </Row>
      <Row>
        <Field label="Baseline" flex>
          <input type="number" value={draft.baseline_value ?? ''} onChange={e => set('baseline_value', e.target.value === '' ? null : Number(e.target.value))} style={input} />
        </Field>
        <Field label="Actual" flex>
          <input type="number" value={draft.current_value ?? ''} onChange={e => set('current_value', e.target.value === '' ? null : Number(e.target.value))} style={input} />
        </Field>
        <Field label="Objetivo" flex>
          <input type="number" value={draft.target_value ?? ''} onChange={e => set('target_value', e.target.value === '' ? null : Number(e.target.value))} style={input} />
        </Field>
      </Row>
      <Field label="Dirección">
        <select value={draft.direction ?? 'down'} onChange={e => set('direction', e.target.value as OutcomeDirection)} style={input}>
          <option value="up">{DIRECTION_LABEL.up}</option>
          <option value="down">{DIRECTION_LABEL.down}</option>
        </select>
      </Field>
      <Row>
        <Field label="Owner" flex>
          <select value={draft.owner_id ?? ''} onChange={e => set('owner_id', e.target.value || null)} style={input}>
            <option value="">Sin asignar</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Horizonte" flex>
          <select value={(draft.horizon as OutcomeHorizon | undefined) ?? 'later'}
                  onChange={e => set('horizon', e.target.value as OutcomeHorizon)}
                  style={input}>
            {HORIZON_OPTIONS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
          </select>
        </Field>
      </Row>

      <FormFooter
        onCancel={onClose} onSave={save} saving={saving}
        onDelete={isNew ? undefined : remove}
      />
    </Modal>
  );
}
