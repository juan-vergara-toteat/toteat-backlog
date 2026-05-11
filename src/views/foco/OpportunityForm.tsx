// =====================================================================
// OpportunityForm — modal for creating/editing an opportunity.
// Lifted out of FocoView to keep the tree view focused on layout.
// =====================================================================

import { useEffect, useState } from 'react';
import type { Opportunity, Outcome, Profile } from '../../lib/database.types';
import { createOpportunity, updateOpportunity, deleteOpportunity } from '../../lib/data';
import { Modal, Field, FormFooter, input, textarea } from './chrome';

const CONFIDENCES: Array<'Low' | 'Medium' | 'High'> = ['Low', 'Medium', 'High'];

export function OpportunityForm({ opportunity, defaultOutcomeId, outcomes, profiles, onClose }: {
  opportunity: Opportunity | null;
  defaultOutcomeId: string;
  outcomes: Outcome[];
  profiles: Profile[];
  onClose: () => void;
}) {
  const isNew = opportunity === null;
  const [draft, setDraft] = useState<Partial<Opportunity>>(
    opportunity ?? {
      title: '', description: '', outcome_id: defaultOutcomeId,
      confidence: 'Medium',
    },
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(opportunity ?? {
      title: '', outcome_id: defaultOutcomeId, confidence: 'Medium',
    });
  }, [opportunity, defaultOutcomeId]);

  const set = <K extends keyof Opportunity>(k: K, v: Opportunity[K]) => setDraft(d => ({ ...d, [k]: v }));

  const save = async () => {
    if (!draft.title || !draft.title.trim()) { alert('El título es obligatorio.'); return; }
    if (!draft.outcome_id) { alert('Tenés que asociar la oportunidad a un outcome.'); return; }
    setSaving(true);
    const payload = { ...draft, title: draft.title.trim() };
    const { error } = isNew
      ? await createOpportunity(payload as Partial<Opportunity> & { outcome_id: string; title: string })
      : await updateOpportunity(opportunity!.id, payload);
    setSaving(false);
    if (error) { alert(`No pude guardar: ${error.message}`); return; }
    onClose();
  };

  const remove = async () => {
    if (!opportunity || !confirm('¿Eliminar oportunidad?')) return;
    const { error } = await deleteOpportunity(opportunity.id);
    if (error) { alert(`No pude eliminar: ${error.message}`); return; }
    onClose();
  };

  return (
    <Modal title={isNew ? 'Nueva oportunidad' : 'Editar oportunidad'} onClose={onClose}>
      <Field label="Título">
        <input value={draft.title ?? ''} onChange={e => set('title', e.target.value)}
               placeholder="Cruce manual de planillas para cierre mensual" style={input} />
      </Field>
      <Field label="Descripción (en voz del usuario)">
        <textarea value={draft.description ?? ''} onChange={e => set('description', e.target.value)}
                  placeholder="El equipo pierde 4h/sem cruzando datos…" rows={4} style={textarea} />
      </Field>
      <Field label="Outcome">
        <select value={draft.outcome_id ?? ''} onChange={e => set('outcome_id', e.target.value)} style={input}>
          <option value="">— Elegí un outcome</option>
          {outcomes.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </Field>
      <Field label="Confianza">
        <select value={draft.confidence ?? 'Medium'} onChange={e => set('confidence', e.target.value)} style={input}>
          {CONFIDENCES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Impacto estimado">
        <input value={draft.impact_estimate ?? ''} onChange={e => set('impact_estimate', e.target.value)}
               placeholder="ej: ~6h/mes recuperadas" style={input} />
      </Field>
      <Field label="Evidencia (URL)">
        <input value={draft.evidence_url ?? ''} onChange={e => set('evidence_url', e.target.value)}
               placeholder="link a notas de entrevista, slack, doc…" style={input} />
      </Field>
      <Field label="Owner">
        <select value={draft.owner_id ?? ''} onChange={e => set('owner_id', e.target.value || null)} style={input}>
          <option value="">Sin asignar</option>
          {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>

      <FormFooter
        onCancel={onClose} onSave={save} saving={saving}
        onDelete={isNew ? undefined : remove}
      />
    </Modal>
  );
}
