# Database schema

## Overview

`toteat-backlog` es un OST (Outcome → Opportunity → Solution) backlog: el equipo declara los **outcomes** que persigue (North Stars), bajo cada outcome cuelgan **opportunities** (pain points en la voz del usuario), y cada opportunity se implementa con uno o más **tickets**. El esquema en Supabase (`public`) tiene 7 tablas user-facing — `outcomes`, `opportunities`, `tickets`, `metric_observations`, `comments`, `activity`, `profiles` — más la plumbing de `auth.users` y un par de funciones SQL para audit log y autorización.

## Modelo conceptual

```
outcomes (horizon = now/next/later)
  ├── opportunities (cascade delete desde outcome)
  │     └── tickets (FK opportunity_id, set null on delete; soft-deleted via deleted_at)
  │           ├── comments (cascade delete desde ticket)
  │           └── activity (cascade delete; append-only via trigger)
  └── metric_observations (cascade delete; append-only history de la métrica)

profiles  — extiende auth.users (sin FK; ver nota en la sección profiles)
```

## Tablas

### `outcomes`

North Stars que el equipo prioriza por horizonte.

| Columna | Tipo | Constraints | Notas |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `name` | `text` | NOT NULL | |
| `description` | `text` | | |
| `metric_unit` | `text` | | `'horas/mes'`, `'CLP'`, `'%'`, etc. |
| `baseline_value` | `numeric` | | Valor inicial cuando se empezó a medir |
| `current_value` | `numeric` | | Último valor observado (denormalizado desde `metric_observations`) |
| `target_value` | `numeric` | | Meta |
| `cadence` | `text` | CHECK in (`weekly`,`monthly`,`quarterly`), default `'monthly'` | |
| `direction` | `text` | NOT NULL, CHECK in (`up`,`down`), default `'up'` | `'up'` = subir es bueno (revenue); `'down'` = bajar es bueno (cycle time) |
| `horizon` | `text` | NOT NULL, CHECK in (`now`,`next`,`later`), default `'later'` | Now/Next/Later del roadmap |
| `owner_id` | `uuid` | FK → `profiles(id)` ON DELETE SET NULL | |
| `sort_order` | `int` | NOT NULL, default `0` | |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Auto-actualizado por `trg_outcomes_touch` |

### `opportunities`

Pain points / unmet needs en la voz del usuario, colgando de un outcome.

| Columna | Tipo | Constraints | Notas |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `outcome_id` | `uuid` | NOT NULL, FK → `outcomes(id)` ON DELETE CASCADE | |
| `title` | `text` | NOT NULL | |
| `description` | `text` | | Pain en la voz del usuario |
| `evidence_url` | `text` | | Link a notas de entrevista, Slack, doc |
| `impact_estimate` | `text` | | Texto libre, p.ej. `"~12h/mes ahorro estimado"` |
| `confidence` | `text` | CHECK in (`Low`,`Medium`,`High`), default `'Medium'` | |
| `owner_id` | `uuid` | FK → `profiles(id)` ON DELETE SET NULL | |
| `sort_order` | `int` | NOT NULL, default `0` | |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Auto-actualizado por `trg_opportunities_touch` |

**Índices:** `opportunities_outcome_idx (outcome_id)`.

> Nota: la columna `status` que existió originalmente fue droppeada — `confidence` + el status de los tickets que la implementan capturan la señal.

### `tickets`

Unidad de trabajo. Implementa una opportunity (FK opcional). Soft-deleted vía `deleted_at`.

| Columna | Tipo | Constraints | Notas |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `code` | `text` | UNIQUE | Código corto user-visible |
| `item` | `text` | NOT NULL | Título del ticket |
| `description` | `text` | | |
| `opportunity_id` | `uuid` | FK → `opportunities(id)` ON DELETE SET NULL | Opcional; tickets huérfanos son válidos |
| `prioridad` | `text` | CHECK in (`Alta`,`Media`,`Baja`) | |
| `impacto` | `text` | CHECK in (`Alto`,`Medio`,`Bajo`) | |
| `esfuerzo` | `text` | CHECK in (`XS`,`S`,`M`,`L`,`XL`) | |
| `status` | `text` | NOT NULL, CHECK in (`Backlog`,`Discovery`,`In Progress`,`Blocked`,`In Review`,`Done`), default `'Backlog'` | |
| `owner_id` | `uuid` | FK → `profiles(id)` ON DELETE SET NULL | |
| `progress` | `int` | NOT NULL, CHECK between 0 and 100, default `0` | |
| `deleted_at` | `timestamptz` | | Soft delete; las queries vivas filtran `deleted_at is null` |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `created_by` | `uuid` | FK → `profiles(id)` ON DELETE SET NULL | Set por trigger desde `auth.uid()` |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Set por trigger |
| `updated_by` | `uuid` | FK → `profiles(id)` ON DELETE SET NULL | Set por trigger desde `auth.uid()` |

**Índices:**
- `tickets_status_idx (status)`
- `tickets_owner_idx (owner_id)`
- `tickets_updated_at_idx (updated_at desc)`
- `tickets_alive_updated_at_idx (updated_at desc) where deleted_at is null` — partial, optimiza queries vivas
- `tickets_opportunity_idx (opportunity_id) where opportunity_id is not null` — partial

### `metric_observations`

Append-only history de valores por outcome. Sirve para sparklines y retros.

| Columna | Tipo | Constraints | Notas |
|---|---|---|---|
| `id` | `bigserial` | PK | |
| `outcome_id` | `uuid` | NOT NULL, FK → `outcomes(id)` ON DELETE CASCADE | |
| `value` | `numeric` | NOT NULL | |
| `captured_at` | `timestamptz` | NOT NULL, default `now()` | |
| `source` | `text` | CHECK in (`manual`,`query`,`sample`,`imported`), default `'manual'` | |
| `note` | `text` | | |
| `actor_id` | `uuid` | FK → `profiles(id)` ON DELETE SET NULL | Quién registró la observación |

**Índices:** `metric_observations_outcome_captured_idx (outcome_id, captured_at desc)`.

### `comments`

Hilo de comentarios por ticket.

| Columna | Tipo | Constraints | Notas |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `ticket_id` | `uuid` | NOT NULL, FK → `tickets(id)` ON DELETE CASCADE | |
| `author_id` | `uuid` | FK → `profiles(id)` ON DELETE SET NULL | |
| `body` | `text` | NOT NULL | |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

**Índices:** `comments_ticket_idx (ticket_id, created_at)`.

### `activity`

Audit log append-only para tickets. Cada acción (`created` / `updated` / `deleted` / `restored` / `commented`) deja una fila. Solo se escribe vía triggers `SECURITY DEFINER`; la RLS bloquea inserts directos.

| Columna | Tipo | Constraints | Notas |
|---|---|---|---|
| `id` | `bigserial` | PK | |
| `ticket_id` | `uuid` | NOT NULL, FK → `tickets(id)` ON DELETE CASCADE | |
| `actor_id` | `uuid` | FK → `profiles(id)` ON DELETE SET NULL | `auth.uid()` al momento del trigger |
| `action` | `text` | NOT NULL | `'created'`, `'updated'`, `'deleted'`, `'restored'`, `'commented'` |
| `field` | `text` | | Columna afectada cuando `action='updated'` |
| `old_value` | `jsonb` | | |
| `new_value` | `jsonb` | | |
| `at` | `timestamptz` | NOT NULL, default `now()` | |

**Índices:** `activity_ticket_idx (ticket_id, at desc)`.

### `profiles`

Extiende `auth.users` con metadata de UI (nombre, iniciales, color).

| Columna | Tipo | Constraints | Notas |
|---|---|---|---|
| `id` | `uuid` | PK | **No** tiene FK a `auth.users(id)` (ver nota abajo) |
| `email` | `text` | NOT NULL, UNIQUE | |
| `name` | `text` | NOT NULL | |
| `initials` | `text` | NOT NULL | Calculadas automáticamente por `handle_new_user` para usuarios reales |
| `color` | `text` | NOT NULL, default `'#FF4B33'` | Color del avatar |
| `role` | `text` | NOT NULL, CHECK in (`admin`,`member`), default `'admin'` | |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `last_seen_at` | `timestamptz` | | |

> **Nota sobre `profiles.id`:** la FK `profiles.id → auth.users(id)` se droppeó intencionalmente. La razón histórica: el importador masivo creaba profiles placeholder (con UUID dummy) para owners que aún no se habían autenticado por magic link. Sin esa concesión, el bulk import fallaba con violación de FK. La consecuencia operacional es que un `profiles.id` puede no tener un `auth.users.id` correspondiente; cuando una persona real entra por primera vez, el trigger `handle_new_user` crea un profile fresco con su UUID real, y el "merge" con el placeholder se hace a mano si hace falta.

## Triggers

### `handle_new_user` — `auth.users` AFTER INSERT

`SECURITY DEFINER`, `set search_path = public`. Se dispara cuando Supabase Auth crea un usuario nuevo (post magic link / signup). Calcula `name` desde `raw_user_meta_data.name` o el local-part del email, deriva `initials` (primera letra de las dos primeras palabras), e inserta en `public.profiles` con `on conflict (id) do nothing`. Se enlaza vía `create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();`.

### `touch_updated_at` — `outcomes` y `opportunities` BEFORE UPDATE

`SECURITY INVOKER` (default). Setea `new.updated_at := now()`. Versión genérica usada por `trg_outcomes_touch` y `trg_opportunities_touch`.

### `touch_ticket` — `tickets` BEFORE INSERT OR UPDATE

`SECURITY INVOKER`. Setea `updated_at := now()`, `updated_by := auth.uid()`, y en INSERT también setea `created_by := auth.uid()` si está null. Enlazado por `trg_tickets_touch`.

### `log_ticket_activity` — `tickets` AFTER INSERT OR UPDATE OR DELETE

`SECURITY DEFINER`, `set search_path = public`. Es el corazón del audit log. **Por qué SECURITY DEFINER**: la policy de `activity` es `for insert with check (false)` (deny-all directo). Si la función corriera como INVOKER, la insertaría como el usuario que disparó el trigger y RLS la bloquearía. Al correr como su dueño (`postgres`), bypasea RLS por ser owner de la tabla y el log queda íntegro.

Ramas:

- **INSERT:** loguea `action='created'` con `new_value = to_jsonb(new)`.
- **UPDATE soft-delete** (`old.deleted_at IS NULL AND new.deleted_at IS NOT NULL`): loguea `action='deleted'` con `old_value`. Returns sin diff campo a campo.
- **UPDATE restore** (`old.deleted_at IS NOT NULL AND new.deleted_at IS NULL`): loguea `action='restored'` con `new_value`.
- **UPDATE normal:** itera `v_cols` y, por cada campo donde `old IS DISTINCT FROM new`, inserta una fila `action='updated'` con `field`, `old_value`, `new_value`.
- **Hard DELETE:** retorna `OLD` sin loguear nada. Si se intentara loguear, el `INSERT INTO activity (ticket_id, ...)` violaría la FK (el ticket ya no existe) y la transacción rolaría atrás. La app usa soft delete; el hard delete queda como escape hatch silencioso.

`v_cols` final (post 0010): `['item','description','prioridad','impacto','esfuerzo','status','owner_id','progress','opportunity_id']`.

Enlazado por `trg_tickets_activity`.

### `log_comment_activity` — `comments` AFTER INSERT

`SECURITY DEFINER`, `set search_path = public`. Inserta una fila en `activity` con `action='commented'`, `actor_id = auth.uid()`, `new_value = jsonb_build_object('body', new.body, 'comment_id', new.id)`. Mismo motivo de SECURITY DEFINER que `log_ticket_activity`.

## Row Level Security

Todas las tablas tienen RLS habilitada. La gate común es la función `is_toteat_user()`:

```sql
create or replace function public.is_toteat_user()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((auth.jwt() ->> 'email') ilike '%@toteat.com', false);
$$;
```

Es decir: cualquier usuario autenticado cuyo email termina en `@toteat.com`.

| Tabla | Read | Insert | Update | Delete |
|---|---|---|---|---|
| `outcomes` | toteat user | toteat user | toteat user | toteat user |
| `opportunities` | toteat user | toteat user | toteat user | toteat user |
| `tickets` | toteat user | toteat user | toteat user | toteat user |
| `metric_observations` | toteat user | toteat user | toteat user | toteat user |
| `comments` | toteat user | toteat user **AND `author_id = auth.uid()`** | (no policy → bloqueado) | toteat user **AND `author_id = auth.uid()`** |
| `activity` | toteat user | **deny-all** (`with check (false)`) | (no policy → bloqueado) | (no policy → bloqueado) |
| `profiles` | toteat user | (no policy → bloqueado; el INSERT lo hace el trigger `handle_new_user` con SECURITY DEFINER) | toteat user **AND `id = auth.uid()`** | (no policy → bloqueado) |

Notas:
- `activity` no se puede escribir desde la app: el log se mantiene íntegro pasando 100% por los triggers SECURITY DEFINER.
- `comments` permite borrar y crear solo como autor del comentario; no hay policy de UPDATE (los comentarios son inmutables).
- `profiles` solo se actualiza la propia fila.

## Realtime publication

Tablas en `supabase_realtime`:

- `tickets`
- `comments`
- `activity`
- `profiles`
- `outcomes`
- `opportunities`
- `metric_observations`

## Auth setup

- **Magic link** habilitado (provider externo único — Google, GitHub, etc están deshabilitados en el panel).
- **Email + password** también habilitado.
- **Confirmación de email en signup:** habilitada (template `Confirm signup`).
- **Domain check `@toteat.com`:** enforced doblemente — client-side al pedir el magic link, y server-side vía `is_toteat_user()` en RLS. Aunque alguien lograra autenticarse con otro dominio, no podría leer/escribir ninguna fila.
- **`profiles.id` y `auth.users(id)` están desacoplados** (FK droppeada, ver nota en `profiles`). En la práctica: cuando un usuario real se autentica, el trigger `handle_new_user` crea su profile con su UUID; los profiles placeholder generados por imports masivos siguen vivos y se enlazan a mano si hace falta.

## Re-creating from a fresh Supabase project

La historia de migrations se removió a propósito — Supabase es la fuente de verdad. Para reconstruir el esquema en un proyecto Supabase nuevo, dos caminos:

1. **Pull desde el proyecto existente** (recomendado):
   ```bash
   supabase link --project-ref <new-project-ref>
   supabase db pull --schema public  # apunta al ref del proyecto fuente
   ```
2. **Hand-write** una init migration nueva siguiendo este doc al pie de la letra (incluyendo triggers, RLS, realtime y la función `is_toteat_user`).

## Generating types

`pnpm types:gen` regenera `src/lib/database.gen.ts` desde el esquema remoto vivo (proyecto `kbqqypyipqdnedenkwqj`):

```bash
supabase gen types typescript --project-id kbqqypyipqdnedenkwqj --schema public > src/lib/database.gen.ts
```

Los aliases de dominio escritos a mano (`Ticket`, `Outcome`, `Opportunity`, etc) viven en `src/lib/database.types.ts` y reusan los tipos generados.
