import { useEffect, useState } from 'react';
import type { Ticket, Profile, Outcome, Opportunity, Activity, TicketStatus, TicketPriority, TicketImpact, TicketEffort } from '../lib/database.types';
import { STATUS, Avatar, Pill, STATUS_COLOR, fmtRel } from './atoms';
import { useTicketDetail, updateTicket, deleteTicket, addComment } from '../lib/data';
import { useAuth } from '../lib/auth';

const FIELD_LABEL: Record<string, string> = {
  item: 'título', description: 'descripción',
  tipo: 'Tipo', prioridad: 'Prioridad', impacto: 'Impacto',
  esfuerzo: 'Esfuerzo', status: 'Status',
  owner_id: 'Owner', progress: 'Progreso',
  opportunity_id: 'Oportunidad',
};

function formatActivityValue(
  field: string | null,
  value: unknown,
  profiles: Profile[], opportunities: Opportunity[],
): string {
  if (value === null || value === undefined || value === '') return '∅';
  switch (field) {
    case 'owner_id':  return profiles.find(p => p.id === value)?.name ?? String(value);
    case 'opportunity_id': return opportunities.find(o => o.id === value)?.title ?? String(value);
    case 'progress':  return `${value}%`;
    default: return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
}

function describeActivity(
  a: Activity,
  profiles: Profile[], opportunities: Opportunity[],
): React.ReactNode {
  if (a.action === 'created')   return <>creó el ticket</>;
  if (a.action === 'deleted')   return <>eliminó el ticket</>;
  if (a.action === 'restored')  return <>restauró el ticket</>;
  if (a.action === 'commented') return <>comentó</>;
  if (a.action === 'updated' && a.field) {
    const label = FIELD_LABEL[a.field] ?? a.field;
    const from = formatActivityValue(a.field, a.old_value, profiles, opportunities);
    const to = formatActivityValue(a.field, a.new_value, profiles, opportunities);
    return (
      <>
        cambió <strong style={{ color: 'var(--ink)' }}>{label}</strong>
        {' de '}<em style={{ color: 'var(--ink-2)' }}>{from}</em>
        {' a '}<em style={{ color: 'var(--ink)' }}>{to}</em>
      </>
    );
  }
  return <>{a.action}{a.field ? ` ${a.field}` : ''}</>;
}

export function SidePanel({
  ticket, profiles, outcomes, opportunities, onClose,
}: {
  ticket: Ticket;
  profiles: Profile[];
  outcomes: Outcome[]; opportunities: Opportunity[];
  onClose: () => void;
}) {
  const { profile } = useAuth();
  const { comments, activity } = useTicketDetail(ticket.id);
  const [newComment, setNewComment] = useState('');

  // Buffer local. Solo se persiste al hacer click en "Guardar".
  // Reset al abrir un ticket distinto. Realtime updates del mismo ticket
  // se reflejan vía `merged` (ticket prop fresco + draft encima).
  const [draft, setDraft] = useState<Partial<Ticket>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDraft({}); }, [ticket.id]);

  const merged = { ...ticket, ...draft };
  const isDirty = Object.keys(draft).length > 0;
  const editor = merged.updated_by ? profiles.find(p => p.id === merged.updated_by) : null;

  const set = <K extends keyof Ticket>(k: K, v: Ticket[K]) =>
    setDraft(d => ({ ...d, [k]: v }));

  const save = async () => {
    if (!isDirty || saving) return;
    setSaving(true);
    const { error } = await updateTicket(ticket.id, draft);
    setSaving(false);
    if (error) { alert(`No pude guardar: ${error.message}`); return; }
    setDraft({});
    onClose();
  };

  const closeWithGuard = () => {
    if (isDirty && !confirm('Tienes cambios sin guardar. ¿Salir igual?')) return;
    onClose();
  };

  const submitComment = async () => {
    if (!newComment.trim() || !profile) return;
    await addComment(ticket.id, newComment.trim(), profile.id);
    setNewComment('');
  };

  return (
    <>
      <div onClick={closeWithGuard} style={{ position: 'fixed', inset: 0, background: 'rgba(27,27,27,.18)', zIndex: 40, animation: 'fadeIn .15s ease-out' }} />
      <aside style={{
        position: 'fixed', top: 0, right: 0, height: '100vh', width: 520, zIndex: 50,
        background: 'var(--surface)', borderLeft: '1px solid var(--line)',
        boxShadow: '-12px 0 32px rgba(27,27,27,.08)', display: 'flex', flexDirection: 'column',
        animation: 'slideIn .18s ease-out',
      }}>
        <header style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontFamily: 'ui-monospace, Menlo, monospace', color: 'var(--ink-3)' }}>
            {ticket.code ?? ticket.id.slice(0, 6)}
          </span>
          <Pill tone={STATUS_COLOR[merged.status as TicketStatus]}>{merged.status}</Pill>
          {isDirty && <span style={{ fontSize: 13, color: 'var(--coral)', fontWeight: 700 }}>· sin guardar</span>}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button onClick={async () => {
                      if (!confirm('¿Eliminar ticket?')) return;
                      const { error } = await deleteTicket(ticket.id);
                      if (error) { alert(`No pude eliminar: ${error.message}`); return; }
                      onClose();
                    }}
                    style={iconBtn}>🗑</button>
            <button onClick={closeWithGuard} style={iconBtn}>✕</button>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 18 }}>
          <input value={merged.item} onChange={(e) => set('item', e.target.value)}
                 style={{ width: '100%', border: 0, outline: 'none', fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', padding: '4px 0', background: 'transparent' }} />

          <div style={{ marginTop: 10 }}>
            <Lbl>Descripción</Lbl>
            <textarea value={merged.description ?? ''} onChange={(e) => set('description', e.target.value)}
                      placeholder="Descripción…" rows={3}
                      onFocus={(e) => { e.currentTarget.style.background = 'var(--surface)'; }}
                      onBlur={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                      style={{
                        width: '100%', marginTop: 8,
                        border: '1px solid var(--line-2)', borderRadius: 8,
                        padding: '8px 10px',
                        fontSize: 15, lineHeight: 1.5, color: 'var(--ink-2)',
                        background: 'var(--surface-2)',
                        outline: 'none', resize: 'vertical', fontFamily: 'inherit',
                        transition: 'background 80ms ease-out',
                        boxSizing: 'border-box',
                      }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', rowGap: 10, columnGap: 14, marginTop: 18, fontSize: 15 }}>
            <Lbl>Status</Lbl>
            <select value={merged.status} onChange={(e) => set('status', e.target.value as TicketStatus)} style={fld}>
              {STATUS.map(s => <option key={s}>{s}</option>)}
            </select>

            <Lbl>Owner</Lbl>
            <select value={merged.owner_id ?? ''} onChange={(e) => set('owner_id', e.target.value || null)} style={fld}>
              <option value="">Sin asignar</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            <Lbl>Oportunidad</Lbl>
            <select value={merged.opportunity_id ?? ''} onChange={(e) => set('opportunity_id', e.target.value || null)} style={fld}>
              <option value="">Sin oportunidad</option>
              {opportunities.map(o => {
                const outcomeName = outcomes.find(oc => oc.id === o.outcome_id)?.name ?? '—';
                return (
                  <option key={o.id} value={o.id}>{o.title} — {outcomeName}</option>
                );
              })}
            </select>

            <Lbl>Prioridad</Lbl>
            <select value={merged.prioridad ?? ''} onChange={(e) => set('prioridad', (e.target.value || null) as TicketPriority | null)} style={fld}>
              <option value="">—</option><option>Alta</option><option>Media</option><option>Baja</option>
            </select>

            <Lbl>Impacto</Lbl>
            <select value={merged.impacto ?? ''} onChange={(e) => set('impacto', (e.target.value || null) as TicketImpact | null)} style={fld}>
              <option value="">—</option><option>Alto</option><option>Medio</option><option>Bajo</option>
            </select>

            <Lbl>Esfuerzo</Lbl>
            <select value={merged.esfuerzo ?? ''} onChange={(e) => set('esfuerzo', (e.target.value || null) as TicketEffort | null)} style={fld}>
              <option value="">—</option><option>XS</option><option>S</option><option>M</option><option>L</option><option>XL</option>
            </select>

            <Lbl>Progreso</Lbl>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="range" min={0} max={100} value={merged.progress}
                     onChange={(e) => set('progress', +e.target.value)} style={{ flex: 1 }} />
              <span style={{ fontSize: 14, fontWeight: 700, minWidth: 38, textAlign: 'right' }}>{merged.progress}%</span>
            </div>
          </div>

          <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-3)' }}>
            {editor && <Avatar name={editor.name} initials={editor.initials} color={editor.color} size={20} />}
            Última edición {editor ? `por ${editor.name}` : ''} · {fmtRel(merged.updated_at)}
          </div>

          <Section title={`Comentarios (${comments.length})`}>
            {comments.map(c => {
              const a = profiles.find(p => p.id === c.author_id);
              return (
                <div key={c.id} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  {a && <Avatar name={a.name} initials={a.initials} color={a.color} size={26} />}
                  <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 10, padding: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{a?.name ?? 'Anónimo'} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· {fmtRel(c.created_at)}</span></div>
                    <div style={{ fontSize: 15, marginTop: 4, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{c.body}</div>
                  </div>
                </div>
              );
            })}
            <div style={{ display: 'flex', gap: 8 }}>
              <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Escribe un comentario…" rows={2}
                        style={{ flex: 1, border: '1px solid var(--line-2)', borderRadius: 10, padding: 10, fontSize: 15, outline: 'none', fontFamily: 'inherit', resize: 'vertical' }} />
              <button onClick={submitComment} disabled={!newComment.trim()}
                      style={{ alignSelf: 'flex-end', height: 36, border: 0, borderRadius: 999, background: 'var(--coral)', color: '#fff', fontWeight: 700, fontSize: 14, padding: '0 18px', cursor: 'pointer' }}>
                Enviar
              </button>
            </div>
          </Section>

          <Section title="Actividad">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activity.map(a => {
                const actor = profiles.find(p => p.id === a.actor_id);
                return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                    {actor
                      ? <Avatar name={actor.name} initials={actor.initials} color={actor.color} size={20} />
                      : <div style={{ width: 20, height: 20, borderRadius: 999, background: 'var(--line-2)', flexShrink: 0 }} />}
                    <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>
                      <strong style={{ color: 'var(--ink)' }}>{actor?.name ?? '—'}</strong>{' '}
                      {describeActivity(a, profiles, opportunities)}
                    </span>
                    <span style={{ flexShrink: 0 }}>{fmtRel(a.at)}</span>
                  </div>
                );
              })}
              {activity.length === 0 && <div style={{ fontSize: 14, color: 'var(--muted)' }}>Sin actividad aún.</div>}
            </div>
          </Section>
        </div>

        <footer style={{
          padding: '12px 18px', borderTop: '1px solid var(--line)',
          background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 13, color: isDirty ? 'var(--coral)' : 'var(--muted)', fontWeight: isDirty ? 700 : 400 }}>
            {isDirty ? `${Object.keys(draft).length} cambio(s) sin guardar` : 'Todo guardado'}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={() => setDraft({})} disabled={!isDirty || saving}
                    style={{ ...btnSecondary, opacity: !isDirty || saving ? 0.4 : 1, cursor: !isDirty || saving ? 'default' : 'pointer' }}>
              Descartar
            </button>
            <button onClick={save} disabled={!isDirty || saving}
                    style={{ ...btnPrimary, opacity: !isDirty || saving ? 0.5 : 1, cursor: !isDirty || saving ? 'default' : 'pointer' }}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
}

const fld: React.CSSProperties = { height: 32, width: '100%', minWidth: 0, border: '1px solid var(--line-2)', borderRadius: 8, padding: '0 8px', fontSize: 15, outline: 'none', background: 'var(--surface)', boxSizing: 'border-box' };
const iconBtn: React.CSSProperties = { width: 32, height: 32, border: 0, background: 'transparent', borderRadius: 8, cursor: 'pointer', fontSize: 16, color: 'var(--ink-2)' };
const btnPrimary: React.CSSProperties = { height: 36, border: 0, borderRadius: 999, background: 'var(--coral)', color: '#fff', fontWeight: 700, fontSize: 15, padding: '0 22px' };
const btnSecondary: React.CSSProperties = { height: 36, border: '1px solid var(--line-2)', borderRadius: 999, background: 'var(--surface)', color: 'var(--ink-2)', fontWeight: 600, fontSize: 15, padding: '0 16px' };

function Lbl({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.04em', textTransform: 'uppercase', alignSelf: 'center' }}>{children}</div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 26 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}
