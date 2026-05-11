import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, TOTEAT_DOMAIN } from './supabase';
import type { Profile } from './database.types';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithPassword: (email: string, password: string, name: string) => Promise<{ error?: string; needsConfirmation?: boolean }>;
  signInWithMagicLink: (email: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) { setProfile(null); return; }
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setProfile((data as Profile | null) ?? null));
  }, [session?.user?.id]);

  const guardDomain = (email: string): { lower: string; error?: string } => {
    const lower = email.trim().toLowerCase();
    if (!lower.endsWith(TOTEAT_DOMAIN)) {
      return { lower, error: `Solo se permiten emails ${TOTEAT_DOMAIN}` };
    }
    return { lower };
  };

  const signInWithPassword = async (email: string, password: string) => {
    const { lower, error: domainErr } = guardDomain(email);
    if (domainErr) return { error: domainErr };
    const { error } = await supabase.auth.signInWithPassword({ email: lower, password });
    return error ? { error: error.message } : {};
  };

  const signUpWithPassword = async (email: string, password: string, name: string) => {
    const { lower, error: domainErr } = guardDomain(email);
    if (domainErr) return { error: domainErr };
    const trimmedName = name.trim();
    if (!trimmedName) return { error: 'Ingresa tu nombre' };
    if (password.length < 8) return { error: 'La contraseña necesita al menos 8 caracteres' };
    const { data, error } = await supabase.auth.signUp({
      email: lower,
      password,
      options: {
        data: { name: trimmedName },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) return { error: error.message };
    // Cuando email confirmations están activadas en el dashboard, Supabase
    // crea el user pero no devuelve session — el usuario debe confirmar el
    // email primero. Cuando están desactivadas, viene session de inmediato.
    return { needsConfirmation: !data.session };
  };

  const signInWithMagicLink = async (email: string) => {
    const { lower, error: domainErr } = guardDomain(email);
    if (domainErr) return { error: domainErr };
    const { error } = await supabase.auth.signInWithOtp({
      email: lower,
      options: { emailRedirectTo: window.location.origin },
    });
    return error ? { error: error.message } : {};
  };

  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <AuthContext.Provider value={{ session, profile, loading, signInWithPassword, signUpWithPassword, signInWithMagicLink, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside <AuthProvider>');
  return ctx;
}
