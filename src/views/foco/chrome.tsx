// =====================================================================
// Form chrome — shared by OutcomeForm / OpportunityForm / ObservationForm.
// Modal + Field + Row + FormFooter, plus the input/button styles each form
// reuses. Lifted out of FocoView so the tree view stays focused on layout.
// =====================================================================

import type { CSSProperties } from 'react';

export function Modal({ title, onClose, children }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(27,27,27,.18)', zIndex: 40,
        animation: 'fadeIn .15s ease-out',
      }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, height: '100vh', width: 520, zIndex: 50,
        background: 'var(--surface)', borderLeft: '1px solid var(--line)',
        boxShadow: '-12px 0 32px rgba(27,27,27,.08)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideIn .18s ease-out',
      }}>
        <header style={{
          padding: '14px 18px', borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em' }}>{title}</div>
          <button onClick={onClose} style={{
            width: 32, height: 32, border: 0, background: 'transparent', borderRadius: 8,
            cursor: 'pointer', fontSize: 16, color: 'var(--ink-2)',
          }}>✕</button>
        </header>
        <div style={{ flex: 1, overflow: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {children}
        </div>
      </div>
    </>
  );
}

export function Field({ label, children, flex }: {
  label: string;
  children: React.ReactNode;
  flex?: boolean;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: flex ? 1 : undefined, minWidth: 0 }}>
      <span style={{
        fontSize: 13, fontWeight: 700, color: 'var(--ink-3)',
        letterSpacing: '.04em', textTransform: 'uppercase',
      }}>{label}</span>
      {children}
    </label>
  );
}

export function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 10 }}>{children}</div>;
}

export function FormFooter({ onCancel, onSave, saving, onDelete }: {
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  onDelete?: () => void;
}) {
  return (
    <footer style={{
      marginTop: 'auto', paddingTop: 14, borderTop: '1px solid var(--line)',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      {onDelete && (
        <button onClick={onDelete} style={{
          height: 36, border: '1px solid var(--line-2)', background: 'transparent',
          color: 'var(--red)', borderRadius: 999, padding: '0 14px',
          fontWeight: 700, fontSize: 14, cursor: 'pointer',
        }}>Eliminar</button>
      )}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={btnSecondary}>Cancelar</button>
        <button onClick={onSave} disabled={saving} style={{
          ...btnPrimary, opacity: saving ? 0.6 : 1, cursor: saving ? 'default' : 'pointer',
        }}>{saving ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </footer>
  );
}

// Shared input/button styles used inside the three forms.
export const input: CSSProperties = {
  height: 36, border: '1px solid var(--line-2)', borderRadius: 12,
  padding: '0 12px', fontSize: 15, outline: 'none', background: 'var(--surface)',
  width: '100%',
};

export const textarea: CSSProperties = {
  border: '1px solid var(--line-2)', borderRadius: 12,
  padding: 12, fontSize: 15, outline: 'none', background: 'var(--surface)',
  width: '100%', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5,
};

export const btnPrimary: CSSProperties = {
  height: 36, border: 0, borderRadius: 999, background: 'var(--coral)', color: '#fff',
  fontWeight: 700, fontSize: 14, padding: '0 18px', cursor: 'pointer',
};

export const btnSecondary: CSSProperties = {
  height: 36, border: '1px solid var(--line-2)', background: 'var(--surface)', color: 'var(--ink-2)',
  fontWeight: 700, fontSize: 14, padding: '0 14px', borderRadius: 999, cursor: 'pointer',
};
