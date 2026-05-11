import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { useTickets, useProfiles, useOutcomes, useOpportunities, useAllMetricObservations } from '../lib/data';
import { usePresence } from '../lib/presence';
import { FocoView } from './FocoView';
import { TreeView } from './foco/TreeView';
import { SidePanel } from './SidePanel';
import { Avatar, FilterPill } from './atoms';

type WorkspaceView = 'lista' | 'arbol';

export function Workspace() {
  const { profile, signOut } = useAuth();
  const { rows } = useTickets();
  const { profiles } = useProfiles();
  const { rows: outcomes } = useOutcomes();
  const { rows: opportunities } = useOpportunities();
  const { rows: observations } = useAllMetricObservations();
  const presence = usePresence(profile);
  const [openId, setOpenId] = useState<string | null>(null);
  // Workspace-level view toggle. Filter pills (Todo/Now/Next/Later) stay
  // inside each view since they're scope state owned by the view.
  const [view, setView] = useState<WorkspaceView>('lista');

  const opened = openId ? rows.find(r => r.id === openId) ?? null : null;

  return (
    <div style={{ minHeight: '100vh' }}>
      <header style={{ height: 60, background: 'var(--surface)', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 16, position: 'sticky', top: 0, zIndex: 10 }}>
        <Isotype />
        <div style={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: 16 }}>Roadmap Finanzas</div>
        <span style={{ fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', background: 'var(--surface-2)', padding: '3px 8px', borderRadius: 999, fontWeight: 700 }}>Equipo Finanzas</span>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex' }}>
            {presence.slice(0, 5).map((u, i) => (
              <div key={u.id} style={{ marginLeft: i ? -8 : 0, border: '2px solid var(--surface)', borderRadius: 999 }}>
                <Avatar initials={u.initials} color={u.color} name={`${u.name} · en línea`} size={28} />
              </div>
            ))}
          </div>
          {profile && <Avatar initials={profile.initials} color={profile.color} name={profile.name} size={32} />}
          <button onClick={signOut} style={{ height: 32, border: '1px solid var(--line-2)', background: 'transparent', borderRadius: 999, padding: '0 14px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Salir</button>
        </div>
      </header>

      <div style={{ padding: '20px 24px', maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <FilterPill label="Lista" active={view === 'lista'} onClick={() => setView('lista')} />
          <FilterPill label="Árbol" active={view === 'arbol'} onClick={() => setView('arbol')} />
        </div>

        {view === 'lista' ? (
          <FocoView
            outcomes={outcomes}
            opportunities={opportunities}
            tickets={rows}
            observations={observations}
            profiles={profiles}
            onOpenTicket={setOpenId}
          />
        ) : (
          <TreeView
            outcomes={outcomes}
            opportunities={opportunities}
            tickets={rows}
            observations={observations}
            profiles={profiles}
            onOpenTicket={setOpenId}
            onSwitchToLista={() => setView('lista')}
          />
        )}
      </div>

      {opened && <SidePanel ticket={opened} profiles={profiles} outcomes={outcomes} opportunities={opportunities} onClose={() => setOpenId(null)} />}
    </div>
  );
}

const Isotype = () => (
  <svg width={28} height={28} viewBox="0 0 80 80">
    <g transform="translate(17.329 10)">
      <path d="M 29.999 14.999 L 29.999 0 L 15 0 L 15 14.999 L 0 14.999 L 0 29.999 L 15 29.999 L 15 44.998 L 29.999 44.998 L 29.999 29.999 L 44.998 29.999 L 44.998 14.999 Z" fill="#111"/>
      <path d="M 14.999 29.999 C 14.999 31.969 15.387 33.92 16.14 35.74 C 16.894 37.56 17.999 39.214 19.391 40.607 C 20.784 42 22.438 43.105 24.258 43.859 C 26.077 44.612 28.028 45 29.998 45 L 44.998 45 L 44.998 60.001 L 29.999 60.001 C 28.03 60.001 26.079 59.613 24.259 58.859 C 22.439 58.105 20.785 57 19.393 55.607 C 18 54.214 16.895 52.561 16.141 50.741 C 15.387 48.921 14.999 46.97 14.999 45 L 14.999 45 L 14.999 29.999 Z" fill="#FF4B33"/>
    </g>
  </svg>
);
