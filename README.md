# TURINGTECH Ecuador - Website + Sistema de Créditos + CRM interno

Landing page empresarial + sistema de login con roles (admin/user), créditos TURINGTECH, verificación por email, panel de administración y CRM interno (prospectos, tablero Kanban, RRHH, timbrado de jornada, humanizador de texto/docx).

## Stack

- **Backend**: Node.js + Express 4, sin TypeScript
- **Base de datos**: PostgreSQL (`pg`, sin ORM — SQL directo con parámetros posicionales `$1, $2...`)
- **Auth**: JWT + bcryptjs
- **Email**: Nodemailer (SMTP), con fallback a Microsoft Graph (DigitalOcean bloquea puertos SMTP salientes)
- **Frontend**: HTML + Tailwind CSS (vía CDN) + JavaScript vanilla, sin bundler ni build step

## Estructura del proyecto

```
website/
├── public/                     # Sitio público (servido por Express)
│   ├── index.html              # Landing page
│   ├── app.html                # SPA del CRM interno (prospectos, Kanban, RRHH, timbrado)
│   ├── login.html              # Página de login
│   ├── register.html           # Página de registro
│   ├── verify-email.html       # Verificación de email
│   ├── dashboard.html          # Dashboard del usuario (créditos)
│   ├── admin.html              # Panel de administración
│   ├── css/app.css             # Estilos
│   ├── js/                     # API client + utilidades del frontend
│   └── assets/                 # Logos, imágenes
├── src/
│   ├── server.js               # Entry point Express
│   ├── config/database.js      # Conexión PostgreSQL
│   ├── middleware/auth.js      # authMiddleware (JWT) + adminMiddleware (rol admin)
│   ├── routes/
│   │   ├── auth.routes.js          # Registro, login, verificación
│   │   ├── credit.routes.js        # Dashboard, solicitudes, notificaciones
│   │   ├── admin.routes.js         # Gestión de usuarios, créditos, config
│   │   ├── board.routes.js         # Tablero Kanban del CRM (proyectos, sprints, tareas)
│   │   ├── prospectos.routes.js    # CRM de prospectos (interacciones, actividades, catálogos)
│   │   ├── hr.routes.js            # RRHH (perfil, solicitudes)
│   │   ├── timbrado.routes.js      # Timbrado de jornada (marcar entrada/salida, resumen)
│   │   └── humanizer.routes.js     # Humanizador de texto/docx
│   ├── humanizer/
│   │   ├── index.js            # Lógica del humanizador
│   │   ├── docx.js             # Procesamiento de archivos .docx
│   │   └── dictionary.js       # Diccionario de sinónimos (datos, no lógica)
│   ├── services/                   # Email (SMTP + Microsoft Graph)
│   └── utils/jwt.js            # Generación/verificación JWT
├── scripts/
│   ├── init-db.js              # Crear el esquema de tablas
│   ├── seed.js                 # Datos de prueba / admin inicial
│   ├── setup.js                 # Setup inicial (usa .env.example)
│   ├── restore-db.js           # Restaurar la base de datos
│   └── db-backup.sql           # Dump de BD (no trackeado en git, no es el esquema vigente)
├── docs/                       # Notas internas y documentación no operativa
├── dev/                        # Previews/checks de desarrollo (no servidos por HTTP)
├── package.json
├── .env.example                # Copiar a .env y configurar
└── .gitignore
```

## CRM interno

Además de la landing y el sistema de créditos, el repo incluye un CRM interno (SPA en `public/app.html`), con las siguientes áreas bajo `/api`:

- **`/api/board`** — Tablero Kanban del CRM: proyectos, sprints, tareas (con estados, movimiento entre columnas y archivos adjuntos).
- **`/api/prospectos`** — CRM de prospectos: interacciones, actividades con deadline, próxima gestión, catálogos de estados/tipos y exportación.
- **`/api/hr`** — RRHH: perfil y solicitudes del empleado.
- **`/api/timbrado`** — Timbrado de jornada: marcar entrada/salida, resumen individual y de equipo.
- **`/api/humanizer`** — Humanizador de texto y documentos `.docx`.

Todas estas rutas requieren autenticación (`authMiddleware`); las de administración además requieren `adminMiddleware` (rol `admin`).

## Instalación

### 1. Prerrequisitos

- Node.js 18+
- PostgreSQL 14+ (con `psql` disponible en el PATH)

### 2. Setup automático (recomendado)

```bash
git clone https://github.com/avegac1996/website.git
cd website
npm run setup
```

Esto ejecuta automáticamente:
1. Crea `.env` desde `.env.example` (si no existe)
2. `npm install` - instala dependencias
3. Crea la base de datos `turingtech` en PostgreSQL
4. `npm run init-db` - crea todas las tablas
5. `npm run seed` - crea el admin inicial y configuración

**Importante**: Si es la primera vez, edita `.env` con tus credenciales de PostgreSQL y SMTP antes de ejecutar `npm run setup`.

### 3. Iniciar servidor

```bash
npm run dev    # desarrollo (con nodemon)
npm start      # producción
```

El servidor corre en `http://localhost:3000`

### Setup manual (paso a paso)

Si prefieres hacerlo manualmente:

```bash
npm install
cp .env.example .env       # editar credenciales
psql -U postgres -c "CREATE DATABASE turingtech;"
npm run init-db
npm run seed
npm start
```

### Otros scripts

- `npm run db:restore` — restaura la base `turingtech` desde `scripts/db-backup.sql` (snapshot completo con datos reales; requiere `psql` en el PATH).
- `npm run init:iniciar` — configuración automática de la base en el servidor: crea la BD si no existe y carga el snapshot completo (o cae a `init-db` + `seed` si no hay snapshot); no necesita `psql`, usa el cliente `pg`. Soporta `--fresh` para recrear la base desde cero.

## Flujos del sistema

### Registro de usuario
1. Usuario completa formulario en `/register.html`
2. Recibe email de verificación
3. Al hacer clic en el link, se verifica y recibe 200 créditos
4. Recibe email de bienvenida con créditos asignados

### Solicitud de créditos
1. Usuario llena formulario de proyecto en su dashboard
2. Mensaje: "Tu solicitud será aprobada en los siguientes minutos"
3. Email llega al correo configurado (ej: `nicole.flores@turingtech.com.ec`)
4. Admin revisa en panel → aprueba o rechaza
5. Usuario recibe notificación in-app + email

### Panel de admin
- Ver todos los usuarios y sus créditos
- Aprobar/rechazar solicitudes de créditos
- Modificar créditos de cualquier usuario
- Cambiar email de notificaciones
- Configurar créditos iniciales

## API Endpoints

### Auth
- `POST /api/auth/register` - Registro
- `GET /api/auth/verify?token=xxx` - Verificación email
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Usuario actual

### Créditos (usuario)
- `GET /api/credits/dashboard` - Dashboard completo
- `POST /api/credits/request` - Solicitar créditos
- `GET /api/credits/transactions` - Historial
- `GET /api/credits/notifications` - Notificaciones
- `PUT /api/credits/notifications/:id/read` - Marcar leída

### Admin
- `GET /api/admin/users` - Listar usuarios
- `GET /api/admin/users/:id` - Detalle usuario
- `POST /api/admin/users/:id/credits` - Modificar créditos
- `GET /api/admin/requests?status=pending` - Listar solicitudes
- `POST /api/admin/requests/:id/approve` - Aprobar
- `POST /api/admin/requests/:id/reject` - Rechazar
- `GET /api/admin/config` - Ver configuración
- `PUT /api/admin/config` - Actualizar configuración

## Credenciales por defecto

- **Admin**: `admin@turingtech.com.ec` / `turingtech2026`
- **Email notificaciones**: `nicole.flores@turingtech.com.ec`

## Licencia

© 2026 TURINGTECH Ecuador. Todos los derechos reservados.
