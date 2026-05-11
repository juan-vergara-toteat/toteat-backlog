import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Profile } from './database.types';
import { useAuth } from './auth';

export interface PresenceUser { id: string; name: string; initials: string; color: string; online_at: string; }

export function usePresence(profile: Profile | null) {
  const { session } = useAuth();
  const [users, setUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!profile || !session) return;
    const ch = supabase.channel('roadmap-presence', { config: { presence: { key: profile.id } } });
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState<PresenceUser>();
      const flat = Object.values(state).flat() as PresenceUser[];
      // Same user open in multiple tabs → multiple presence entries with the
      // same id. Dedupe so React keys stay unique and the avatar shows once.
      const unique = Array.from(new Map(flat.map(u => [u.id, u])).values());
      setUsers(unique);
    });
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({
          id: profile.id, name: profile.name, initials: profile.initials,
          color: profile.color, online_at: new Date().toISOString(),
        });
      }
    });
    return () => { supabase.removeChannel(ch); };
  }, [profile, session]);

  return users;
}
