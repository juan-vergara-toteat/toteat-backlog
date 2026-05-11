import { useState } from 'react';
import { useAuth } from '../lib/auth';

type Mode = 'signin' | 'signup';
type Status =
  | { kind: 'form' }
  | { kind: 'magic-sent'; email: string }
  | { kind: 'confirm-sent'; email: string };

export function Login() {
  const { signInWithPassword, signUpWithPassword, signInWithMagicLink } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [status, setStatus] = useState<Status>({ kind: 'form' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'submit' | 'magic' | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setBusy('submit');
    const res = mode === 'signin'
      ? await signInWithPassword(email, password)
      : await signUpWithPassword(email, password, name);
    setBusy(null);
    if (res.error) { setError(res.error); return; }
    if (mode === 'signup' && 'needsConfirmation' in res && res.needsConfirmation) {
      setStatus({ kind: 'confirm-sent', email });
    }
    // si signIn fue OK o signUp devolvió session, AuthProvider redirige solo
  };

  const sendMagicLink = async () => {
    if (!email) { setError('Ingresa tu email primero'); return; }
    setError(null); setBusy('magic');
    const res = await signInWithMagicLink(email);
    setBusy(null);
    if (res.error) { setError(res.error); return; }
    setStatus({ kind: 'magic-sent', email });
  };

  const reset = () => { setStatus({ kind: 'form' }); setPassword(''); setError(null); };

  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center',
      background: 'radial-gradient(1200px 600px at 80% -10%, #FFE7E2 0%, transparent 60%), var(--bg)',
      padding: 24,
    }}>
      <div style={{
        width: 420, background: 'var(--surface)', border: '1px solid var(--line)',
        borderRadius: 16, padding: 32, boxShadow: 'var(--shadow-2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <Isotype />
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em' }}>Toteat · Roadmap</div>
        </div>

        {status.kind === 'magic-sent' && (
          <SentNotice
            title="Revisa tu correo"
            body={<>Te mandamos un magic link a <strong>{status.email}</strong>. Es de un solo uso y expira en 1 hora.</>}
            onBack={reset}
          />
        )}

        {status.kind === 'confirm-sent' && (
          <SentNotice
            title="Confirma tu correo"
            body={<>Mandamos un link de confirmación a <strong>{status.email}</strong>. Confírmalo y vuelve a iniciar sesión.</>}
            onBack={reset}
          />
        )}

        {status.kind === 'form' && (
          <>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 8px' }}>
              {mode === 'signin' ? 'Entra al Roadmap' : 'Crea tu cuenta'}
            </h1>
            <p style={{ color: 'var(--ink-2)', fontSize: 16, lineHeight: 1.55, margin: '0 0 18px' }}>
              Acceso solo para emails <strong>@toteat.com</strong>.
            </p>

            {/* Tabs */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4,
              background: 'var(--surface-2)', borderRadius: 999, padding: 4, marginBottom: 18,
            }}>
              <TabBtn active={mode === 'signin'} onClick={() => setMode('signin')}>Iniciar sesión</TabBtn>
              <TabBtn active={mode === 'signup'} onClick={() => setMode('signup')}>Crear cuenta</TabBtn>
            </div>

            <form onSubmit={submit}>
              {mode === 'signup' && (
                <>
                  <label style={lbl}>Nombre</label>
                  <input
                    required value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tu nombre" style={{ ...inp, marginBottom: 12 }}
                  />
                </>
              )}

              <label style={lbl}>Email corporativo</label>
              <input
                type="email" required autoFocus value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu.nombre@toteat.com"
                style={{ ...inp, marginBottom: 12 }}
              />

              <label style={lbl}>Contraseña</label>
              <input
                type="password" required value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'Mínimo 8 caracteres' : '••••••••'}
                style={inp}
              />

              {error && (
                <div style={{ color: 'var(--red)', fontSize: 14, marginTop: 10 }}>{error}</div>
              )}

              <button type="submit" disabled={busy !== null} style={{ ...btnPrimary, marginTop: 16 }}>
                {busy === 'submit'
                  ? (mode === 'signin' ? 'Entrando…' : 'Creando cuenta…')
                  : (mode === 'signin' ? 'Iniciar sesión' : 'Crear cuenta')}
              </button>
            </form>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 14px', color: 'var(--muted)' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' }}>o</span>
              <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            </div>

            <button type="button" onClick={sendMagicLink} disabled={busy !== null} style={btnSecondary}>
              {busy === 'magic' ? 'Enviando…' : '✉  Enviar magic link'}
            </button>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
              ¿Olvidaste tu contraseña? Usa el magic link.
            </p>
          </>
        )}

        <div style={{ marginTop: 24, fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
          Equipo Finanzas · Toteat
        </div>
      </div>
    </div>
  );
}

function SentNotice({ title, body, onBack }: { title: string; body: React.ReactNode; onBack: () => void }) {
  return (
    <>
      <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 8px' }}>{title}</h1>
      <p style={{ color: 'var(--ink-2)', fontSize: 16, lineHeight: 1.55, margin: '0 0 20px' }}>{body}</p>
      <button onClick={onBack} style={btnGhost}>Volver</button>
    </>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{
      height: 34, border: 0, borderRadius: 999, cursor: 'pointer',
      background: active ? 'var(--surface)' : 'transparent',
      color: active ? 'var(--ink)' : 'var(--ink-3)',
      fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em',
      boxShadow: active ? 'var(--shadow-1)' : 'none',
      transition: 'background .12s ease',
    }}>{children}</button>
  );
}

const Isotype = () => (
  <svg width={28} height={28} viewBox="0 0 80 80">
    <g transform="translate(17.329 10)">
      <path d="M 29.999 14.999 L 29.999 0 L 15 0 L 15 14.999 L 0 14.999 L 0 29.999 L 15 29.999 L 15 44.998 L 29.999 44.998 L 29.999 29.999 L 44.998 29.999 L 44.998 14.999 Z" fill="#111"/>
      <path d="M 14.999 29.999 C 14.999 31.969 15.387 33.92 16.14 35.74 C 16.894 37.56 17.999 39.214 19.391 40.607 C 20.784 42 22.438 43.105 24.258 43.859 C 26.077 44.612 28.028 45 29.998 45 L 44.998 45 L 44.998 60.001 L 29.999 60.001 C 28.03 60.001 26.079 59.613 24.259 58.859 C 22.439 58.105 20.785 57 19.393 55.607 C 18 54.214 16.895 52.561 16.141 50.741 C 15.387 48.921 14.999 46.97 14.999 45 L 14.999 45 L 14.999 45 L 14.999 29.999 Z" fill="#FF4B33"/>
    </g>
  </svg>
);

const lbl: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: 'var(--ink-2)', display: 'block', marginBottom: 6 };
const inp: React.CSSProperties = {
  width: '100%', height: 44, border: '1px solid var(--line-2)', borderRadius: 12,
  padding: '0 14px', fontSize: 16, outline: 'none', background: 'var(--surface)',
};
const btnPrimary: React.CSSProperties = {
  width: '100%', height: 46, border: 0, borderRadius: 999, background: 'var(--coral)',
  color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', letterSpacing: '-0.01em',
};
const btnSecondary: React.CSSProperties = {
  width: '100%', height: 42, border: '1px solid var(--line-2)', borderRadius: 999,
  background: 'var(--surface)', color: 'var(--ink)', fontWeight: 700, fontSize: 15,
  cursor: 'pointer', letterSpacing: '-0.01em',
};
const btnGhost: React.CSSProperties = {
  height: 38, border: '1px solid var(--line-2)', borderRadius: 999, background: 'transparent',
  color: 'var(--ink)', padding: '0 18px', fontWeight: 700, fontSize: 15, cursor: 'pointer',
};
