# CLAUDE.md

Guía rápida para trabajar en este repo sin tener que re-explorarlo cada vez.

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

## Arquitectura ([src/server.js](src/server.js))

Entry point único. Sirve `public/` como estático (sin caché para html/css/js) y monta las rutas API:

| Prefijo | Archivo | Dominio |
|---|---|---|
| `/api/auth` | `src/routes/auth.routes.js` | login/registro |
| `/api/credits` | `src/routes/credit.routes.js` | sistema de créditos |
| `/api/admin` | `src/routes/admin.routes.js` | administración |
| `/api/hr` | `src/routes/hr.routes.js` | RRHH |
| `/api/board` | `src/routes/board.routes.js` | tablero Kanban del CRM |
| `/api/prospectos` | `src/routes/prospectos.routes.js` | CRM de prospectos |
| `/api/humanizer` | `src/routes/humanizer.routes.js` | humanizador de texto/docx |
| `/api/timbrado` | `src/routes/timbrado.routes.js` | timbrado de jornada |

Cualquier ruta no-API que no matchee un archivo estático cae a `public/index.html` (fallback tipo SPA). No hay carpeta `controllers/`: la lógica de negocio vive directamente en cada `src/routes/*.routes.js`.

Nota de datos: las columnas `DATE` de Postgres se devuelven como texto plano `'YYYY-MM-DD'` (ver `types.setTypeParser` en `src/config/database.js`) para evitar corrimientos de zona horaria — no asumas que llegan como objeto `Date` del lado del servidor.

## Convenciones

- Comentarios y mensajes de error en español; nombres de variables/funciones en inglés.
- SQL a mano, sin query builder ni migraciones versionadas más allá de `scripts/init-db.js`.

## Archivos grandes — evita leerlos completos si la tarea no los toca directamente

Usa grep/búsqueda por símbolo antes de abrir estos archivos enteros:

- **`public/app.html`** (~3550 líneas) — SPA monolítica del CRM/Kanban/prospectos (HTML+CSS+JS en un solo archivo).
- **`public/index.html`** (~1900 líneas) — landing page.
- **`public/css/app.css`** (~2400 líneas).
- **`src/routes/board.routes.js`** (~970 líneas) y **`src/routes/prospectos.routes.js`** (~765 líneas) — los módulos más grandes del backend; localiza el endpoint relevante antes de leer todo el archivo.
- **`src/humanizer/dictionary.js`** — es un **diccionario de datos** (objeto JS gigante en una sola línea, sinónimos), no contiene lógica. La lógica real del humanizador está en `src/humanizer/index.js` y `src/humanizer/docx.js`.
- **`scripts/db-backup.sql`** — dump de base de datos, no representa el esquema vigente ni es código a mantener; para el esquema usa `scripts/init-db.js`.

## Dominio

Proyecto de TURINGTECH Ecuador: landing + sistema de créditos + CRM interno (prospectos, tablero Kanban, RRHH, timbrado de jornada, humanizador de texto/docx). Se despliega a un droplet de DigitalOcean vía `git pull` (detalle operativo en `BITACORA-DEPLOY.md`, no versionado).
