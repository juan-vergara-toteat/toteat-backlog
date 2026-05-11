import { useAuth } from './lib/auth';
import { Login } from './views/Login';
import { Workspace } from './views/Workspace';

export function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh', color: 'var(--muted)' }}>
        Cargando…
      </div>
    );
  }
  if (!session) return <Login />;
  return <Workspace />;
}
