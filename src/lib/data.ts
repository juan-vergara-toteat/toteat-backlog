import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import type { Ticket, Profile, Comment, Activity, Outcome, Opportunity, MetricObservation } from './database.types';

export function useTickets() {
  const [rows, setRows] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('tickets')
      .select('*')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });
    setRows((data ?? []) as Ticket[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const ch = supabase.channel('tickets-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refresh]);

  return { rows, loading, refresh };
}

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  useEffect(() => {
    supabase.from('profiles').select('*').order('name').then(({ data }) => {
      setProfiles((data ?? []) as Profile[]);
    });
  }, []);
  return { profiles };
}

export async function updateTicket(id: string, patch: Partial<Ticket>) {
  return supabase.from('tickets').update(patch).eq('id', id);
}
export async function createTicket(t: Partial<Ticket> & { item: string }) {
  return supabase.from('tickets').insert(t).select().single();
}
export async function deleteTicket(id: string) {
  // Soft delete: ver migration 0006. Hard delete rompía por el trigger
  // de activity (FK violation post-delete).
  return supabase
    .from('tickets')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
}

export function useTicketDetail(id: string | null) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);

  useEffect(() => {
    if (!id) { setComments([]); setActivity([]); return; }
    (async () => {
      const [c, a] = await Promise.all([
        supabase.from('comments').select('*').eq('ticket_id', id).order('created_at'),
        supabase.from('activity').select('*').eq('ticket_id', id).order('at', { ascending: false }).limit(50),
      ]);
      setComments((c.data ?? []) as Comment[]);
      setActivity((a.data ?? []) as Activity[]);
    })();
    const ch = supabase.channel(`ticket-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `ticket_id=eq.${id}` }, async () => {
        const { data } = await supabase.from('comments').select('*').eq('ticket_id', id).order('created_at');
        setComments((data ?? []) as Comment[]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity', filter: `ticket_id=eq.${id}` }, async () => {
        const { data } = await supabase.from('activity').select('*').eq('ticket_id', id).order('at', { ascending: false }).limit(50);
        setActivity((data ?? []) as Activity[]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  return { comments, activity };
}

export async function addComment(ticket_id: string, body: string, author_id: string) {
  return supabase.from('comments').insert({ ticket_id, body, author_id });
}

export function useOutcomes() {
  const [rows, setRows] = useState<Outcome[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('outcomes')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    setRows((data ?? []) as Outcome[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const ch = supabase.channel('outcomes-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outcomes' }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refresh]);

  return { rows, loading, refresh };
}

export function useOpportunities() {
  const [rows, setRows] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('opportunities')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    setRows((data ?? []) as Opportunity[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const ch = supabase.channel('opportunities-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'opportunities' }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refresh]);

  return { rows, loading, refresh };
}

export function useAllMetricObservations() {
  const [rows, setRows] = useState<MetricObservation[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('metric_observations')
      .select('*')
      .order('captured_at', { ascending: true });
    setRows((data ?? []) as MetricObservation[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const ch = supabase.channel('metric-observations-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'metric_observations' }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refresh]);

  return { rows, loading, refresh };
}

export async function createOutcome(o: Partial<Outcome> & { name: string }) {
  return supabase.from('outcomes').insert(o).select().single();
}
export async function updateOutcome(id: string, patch: Partial<Outcome>) {
  return supabase.from('outcomes').update(patch).eq('id', id);
}
export async function deleteOutcome(id: string) {
  return supabase.from('outcomes').delete().eq('id', id);
}

export async function createOpportunity(o: Partial<Opportunity> & { outcome_id: string; title: string }) {
  return supabase.from('opportunities').insert(o).select().single();
}
export async function updateOpportunity(id: string, patch: Partial<Opportunity>) {
  return supabase.from('opportunities').update(patch).eq('id', id);
}
export async function deleteOpportunity(id: string) {
  return supabase.from('opportunities').delete().eq('id', id);
}

export async function addMetricObservation(obs: Partial<MetricObservation> & { outcome_id: string; value: number; actor_id: string }) {
  return supabase.from('metric_observations').insert(obs).select().single();
}
