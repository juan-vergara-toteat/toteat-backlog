# Toteat · Roadmap Finanzas

App colaborativa para gestionar el backlog del equipo Finanzas. Tabla, timeline,
tablero Kanban y dashboard, todo sobre una base relacional en Supabase con auth
por magic link (solo `@toteat.com`), realtime y audit log.

## Stack

- **Vite + React 18 + TypeScript**
- **Supabase**: Postgres + Auth + Realtime + RLS
- **CSS** plain (design system Toteat: Manrope, coral `#FF4B33`)

## Setup local (primera vez)

```bash
# 1. Instalar deps
npm install

# 2. Copiar variables de entorno
cp .env.example .env
# (los valores ya están con tu proyecto Supabase de prod;
#  si quieres usar uno local, cambia VITE_SUPABASE_URL/ANON_KEY)

# 3. Loguearse en Supabase CLI y linkear el proyecto remoto
supabase login
supabase link --project-ref kbqqypyipqdnedenkwqj

# 4. Aplicar migrations al proyecto remoto
supabase db push

# 5. (Opcional) Regenerar tipos TypeScript desde el schema real
npm run types:gen

# 6. Levantar dev server
npm run dev
# → http://localhost:5173
```

## Estructura

```
toteat-backlog/
├── src/
│   ├── lib/
│   │   ├── supabase.ts        # cliente
│   │   ├── auth.tsx           # AuthProvider + useAuth (magic link)
│   │   ├── data.ts            # hooks: useTickets, useCatalogs, useTicketDetail
│   │   ├── presence.ts        # usePresence (quién está online)
│   │   ├── csv.ts             # import/export CSV
│   │   └── database.types.ts  # tipos generados (regenerar con `npm run types:gen`)
│   ├── views/
│   │   ├── Login.tsx          # pantalla de login
│   │   ├── Workspace.tsx      # shell: topbar, tabs, filtros
│   │   ├── TableView.tsx
│   │   ├── TimelineView.tsx
│   │   ├── BoardView.tsx      # Kanban con drag & drop
│   │   ├── DashboardView.tsx
│   │   ├── SidePanel.tsx      # detalle ticket: edit + comments + activity
│   │   └── atoms.tsx          # Pill, Avatar, fmtMonth/fmtRel, paletas
│   ├── styles.css
│   ├── App.tsx
│   └── main.tsx
└── supabase/
    ├── config.toml
    ├── templates/magic_link.html
    └── migrations/
        ├── 0001_init.sql       # schema, triggers, RLS
        └── 0002_seed_catalogos.sql
```

## Schema relacional

- `profiles` — extiende `auth.users`, tiene `name`, `initials`, `color`, `role`.
- `ejes`, `temas`, `bloques` — catálogos editables.
- `tickets` — tabla principal. `created_by` y `updated_by` se llenan automáticamente
  con `auth.uid()` vía trigger.
- `comments` — 1:N por ticket.
- `activity` — audit log append-only (qué campo cambió, valor viejo, valor nuevo).
- `saved_views` — vistas con filtros JSON, opcionalmente compartidas con el equipo.

### Realtime

Las cuatro vistas se suscriben a `postgres_changes` sobre `tickets`. Si alguien
mueve una card en el Kanban, todos lo ven en vivo. Lo mismo para comentarios y
activity log dentro del side panel.

### Seguridad (RLS)

Toda escritura/lectura requiere `auth.jwt() ->> 'email' ilike '%@toteat.com'`.
Auth está restringida a magic link y el provider Google está deshabilitado.

## Deploy a Vercel (cuando quieras)

1. Pushear este folder a `https://github.com/juan-vergara-toteat/toteat-backlog`.
2. En Vercel: **New Project** → importar el repo.
3. Variables de entorno:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Build Command: `npm run build` · Output: `dist`.
5. En Supabase → Auth → URL Configuration: agregar el dominio de Vercel a
   `Site URL` y `Redirect URLs` para que el magic link redirija bien.

## Workflow para subir al repo

```bash
cd toteat-backlog
git init
git add .
git commit -m "feat: initial Vite + Supabase scaffold"
git branch -M main
git remote add origin https://github.com/juan-vergara-toteat/toteat-backlog.git
git push -u origin main
```

## Próximas iteraciones sugeridas

- Drag de barras en Timeline para cambiar fechas (UX está, falta wiring de
  `mousemove` → `updateTicket`).
- @menciones en comentarios + notificaciones email.
- Vistas guardadas con UI completa (CRUD desde topbar).
- Export del dashboard como PDF/imagen.
- Roles `admin` vs `member` (hoy todos son admin).
