# CLAUDE.md

Guía rápida para trabajar en este repo sin tener que re-explorarlo cada vez.

**Mantené este archivo al día vos mismo, sin que se te pida cada vez.** Cuando un cambio hace que algo acá quede desactualizado o incompleto de una forma que le costaría tokens a la próxima sesión (un archivo que dividiste, un módulo nuevo, una convención que cambió, un comando que ya no aplica), actualizá el párrafo correspondiente como parte del mismo cambio — no lo dejes pendiente ni esperes a que te lo pidan. La idea es que cada sesión futura arranque con el mapa real del repo en vez de tener que redescubrirlo grepeando o leyendo archivos enteros.

## Stack

- **Backend**: Node.js + Express 4.21. Sin TypeScript.
- **DB**: PostgreSQL vía `pg` 8.13, **sin ORM** — SQL directo con parámetros posicionales (`$1, $2...`). Pool único en [src/config/database.js](src/config/database.js).
- **Auth**: JWT (`jsonwebtoken`) + `bcryptjs`. Middlewares en [src/middleware/auth.js](src/middleware/auth.js): `authMiddleware` (valida el Bearer token y adjunta `req.user`) y `adminMiddleware` (requiere `req.user.role === 'admin'`), encadenados en las rutas que los necesitan.
- **Email**: Nodemailer por SMTP, con fallback a Microsoft Graph (`MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`) — ver `src/services/`. Relevante porque DigitalOcean suele bloquear los puertos SMTP salientes.
- **Frontend**: HTML/CSS/JS vanilla servido como estático desde `public/`. Tailwind vía CDN (`<script src="cdn.tailwindcss.com">`), **sin bundler ni build step**.
- **Sin test runner ni linter configurados.** No busques ni propongas `npm test` / `npm run lint` — no existen en `package.json`. No los agregues salvo que se pida explícitamente.

## Comandos

- `npm start` — arranca `src/server.js` con node (producción).
- `npm run dev` — igual, con nodemon (recarga automática).
- `npm run init-db` — crea el esquema (`scripts/init-db.js`) — úsalo para entender las tablas, **no** `scripts/db-backup.sql`.
- `npm run seed` — datos de prueba (`scripts/seed.js`).
- `npm run setup` — setup inicial (`scripts/setup.js`).
- `npm run db:restore` — restaura la BD (`scripts/restore-db.js`).
- No hay `build`: el frontend se sirve tal cual desde `public/`, sin compilación.
- **Cambios de esquema en producción**: `scripts/init-db.js` solo sabe crear (`CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`), nunca `DROP` — y el deploy es un `git pull` sin paso de migración automático. Cualquier `DROP`/rename/backfill que tenga que llegar a la base productiva va como un `.sql` nuevo en `scripts/migrations/` (ver el `README.md` de esa carpeta) y se corre a mano con `psql`, nunca solo editando `init-db.js`.

## Arquitectura ([src/server.js](src/server.js))

Entry point único. Sirve `public/` como estático (sin caché para html/css/js) y monta las rutas API:

| Prefijo | Archivo | Dominio |
|---|---|---|
| `/api/auth` | `src/routes/auth.routes.js` | login/registro |
| `/api/credits` | `src/routes/credit.routes.js` | sistema de créditos |
| `/api/admin` | `src/routes/admin.routes.js` | administración |
| `/api/hr` | `src/routes/hr.routes.js` | RRHH |
| `/api/board` | `src/routes/board/` | tablero Kanban del CRM |
| `/api/prospectos` | `src/routes/prospectos/` | CRM de prospectos |
| `/api/humanizer` | `src/routes/humanizer.routes.js` | humanizador de texto/docx |
| `/api/timbrado` | `src/routes/timbrado.routes.js` | timbrado de jornada |

Cualquier ruta no-API que no matchee un archivo estático cae a `public/index.html` (fallback tipo SPA). No hay carpeta `controllers/`: la lógica de negocio vive directamente en cada módulo de rutas.

`board` y `prospectos` son los únicos dominios divididos en carpeta (el resto sigue siendo un solo `*.routes.js`): cada una tiene un `index.js` que monta los sub-routers (no lo toques al agregar un endpoint — andá directo al sub-router del recurso), `constants.js` (datos puros, sin lógica) y `helpers.js`. `board/integration.js` es el único puente permitido entre los dos dominios (prospectos nunca debe escribir tablas de board directamente). El middleware "solo colaboradores/admin" compartido por ambos vive en `src/middleware/collaborator.js`.

**Estados CRM consolidados** (sept 2024): 5 estados únicos (`por_prospectar`, `prospectando`, `propuesta`, `exitoso`, `rechazado`) definidos en `src/routes/prospectos/constants.js` (`PROSPECTO_ESTADOS_LIST`, `PROSPECTO_ESTADO_BOARD_MAPPING`). El mapeo a los 6 estados del board es determinístico (no editable por admin). El cambio incluye una migration en `scripts/migrations/001_consolidate_prospect_states.sql` que remapea prospectos existentes y desactiva estados secundarios.

Nota de datos: las columnas `DATE` de Postgres se devuelven como texto plano `'YYYY-MM-DD'` (ver `types.setTypeParser` en `src/config/database.js`) para evitar corrimientos de zona horaria — no asumas que llegan como objeto `Date` del lado del servidor.

## Convenciones

- Comentarios y mensajes de error en español; nombres de variables/funciones en inglés.
- SQL a mano, sin query builder ni migraciones versionadas más allá de `scripts/init-db.js`.

## Archivos grandes — evita leerlos completos si la tarea no los toca directamente

`public/app.html`, `public/css/app.css`, `src/routes/board.routes.js` y `src/routes/prospectos.routes.js` (todos monolíticos) se dividieron en Fase 2. **`app.html` ya no tiene JS/CSS inline** — hoy son 85 líneas de markup + `<script>`/`<link>` apuntando a los archivos de abajo. Localiza el módulo relevante antes de leer nada completo:

- **JS de `app.html`** → `public/js/app-modules/` (ES modules reales, con `import`/`export`). `core.js` = estado global + utilidades (`el`, `esc`, `chipEstado`, `state`, ...) + las vistas más simples del shell. `routes.js` = tabla `ROUTES` + `router()` (importa TODAS las vistas; es el único lugar que las conoce a todas). Un módulo por dominio de vista: `board.js`, `prospectos.js`, `crmdash.js` (dashboard CRM), `crmkanban.js`, `proydash.js`, `timbrado.js`, `humanizador.js`, `creditos.js` (portal cliente), `admin.js`, `hr.js`. `main.js` es el entry point (`<script type="module">`): verifica sesión y arranca el router. `board.js`↔`prospectos.js` comparten `boardState` y `pasteState` (éste último vive en `core.js` porque es una variable mutable compartida — no se puede reasignar un binding importado, solo mutar sus propiedades); hay imports circulares entre `prospectos.js`/`board.js`/`crmkanban.js`, son seguros porque solo involucran `function` (hoisted) invocadas en runtime.
  - `public/js/api-bridge.js` expone `API` (definida como `const` en `public/js/app.js`, un script clásico) como `export` real para que los módulos puedan importarla — `app.js` la cuelga de `window.API` para esto. `app.js` es compartido también por `login.html`/`register.html`/`verify-email.html` como script clásico normal; no lo conviertas en módulo sin revisar esas tres páginas.
- **CSS de `app.html`** → `public/css/`: `base.css` (reset, `:root`, y todo lo genérico: botones, forms, tablas, chips, auth pages — lo usan también `login.html`/`register.html`/`verify-email.html`) + `app-shell.css` (sidebar/topbar) + un archivo por feature: `board-kanban.css`, `board-sprint.css`, `board-gantt.css`, `prospectos-crm.css` (incluye CRM Kanban y actividades), `admin-catalogo.css`, `timbrado.css`, `admin-resumen.css`, `humanizer.css`.
- **`public/index.html`** (~1500 líneas) — landing page; su JS ya no es inline, está en `public/js/particles.js`, `public/js/landing-ui.js` y `public/js/credit-widget.js`.
- **`src/routes/board/`** y **`src/routes/prospectos/`** — ver la nota en Arquitectura arriba; localiza el sub-router del recurso antes de leer nada.
- **`src/humanizer/dictionary.js`** — es un **diccionario de datos** (objeto JS gigante en una sola línea, sinónimos), no contiene lógica. La lógica real del humanizador está en `src/humanizer/index.js` y `src/humanizer/docx.js`.
- **`scripts/db-backup.sql`** — dump de base de datos, no representa el esquema vigente ni es código a mantener; para el esquema usa `scripts/init-db.js`.

## Dominio

Proyecto de TURINGTECH Ecuador: landing + sistema de créditos + CRM interno (prospectos, tablero Kanban, RRHH, timbrado de jornada, humanizador de texto/docx). Se despliega a un droplet de DigitalOcean vía `git pull` (detalle operativo en `BITACORA-DEPLOY.md`, no versionado).
