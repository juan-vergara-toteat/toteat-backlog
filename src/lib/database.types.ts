// =====================================================================
// Re-exporta los tipos auto-generados de Supabase + aliases de dominio
// hechos a mano. El archivo generado vive en `database.gen.ts` y SOLO
// es escrito por `pnpm types:gen`. Los aliases viven aquí, así no se
// pisan al regenerar.
// =====================================================================

export * from './database.gen';
import type { Database } from './database.gen';

// ----- Aliases de filas ------------------------------------------------
export type Ticket = Database['public']['Tables']['tickets']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Comment = Database['public']['Tables']['comments']['Row'];
export type Activity = Database['public']['Tables']['activity']['Row'];
export type Outcome = Database['public']['Tables']['outcomes']['Row'];
export type Opportunity = Database['public']['Tables']['opportunities']['Row'];
export type MetricObservation = Database['public']['Tables']['metric_observations']['Row'];

// ----- Enumeraciones (los CHECK constraints en SQL no se reflejan en
// los tipos generados, así que las repetimos aquí) --------------------
export type TicketStatus = 'Backlog' | 'Discovery' | 'In Progress' | 'Blocked' | 'In Review' | 'Done';
export type TicketPriority = 'Alta' | 'Media' | 'Baja';
export type TicketImpact = 'Alto' | 'Medio' | 'Bajo';
export type TicketEffort = 'XS' | 'S' | 'M' | 'L' | 'XL';

export type OutcomeHorizon = 'now' | 'next' | 'later';
export type OutcomeCadence = 'weekly' | 'monthly' | 'quarterly';
export type OutcomeDirection = 'up' | 'down';
export type ObservationSource = 'manual' | 'query' | 'sample' | 'imported';
