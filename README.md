# TURINGTECH Ecuador - Website + Sistema de Créditos

Landing page empresarial + sistema de login con roles (admin/user), créditos TURINGTECH, verificación por email y panel de administración.

## Stack

- **Backend**: Node.js + Express
- **Base de datos**: PostgreSQL
- **Auth**: JWT + bcrypt
- **Email**: Nodemailer (SMTP)
- **Frontend**: HTML + Tailwind CSS + Style Guide TURINGTECH

## Estructura del proyecto

```
website/
├── public/                 # Sitio público (servido por Express)
│   ├── index.html          # Landing page (con botón Login + sección registro créditos)
│   ├── catalogo.html       # Catálogo de servicios
│   ├── login.html          # Página de login
│   ├── register.html       # Página de registro
│   ├── verify-email.html   # Verificación de email
│   ├── dashboard.html      # Dashboard del usuario
│   ├── admin.html          # Panel de administración
│   ├── css/app.css         # Estilos dark theme (basados en style guide)
│   ├── js/app.js           # API client + utilidades
│   └── assets/             # Logos, imágenes
├── src/
│   ├── server.js           # Entry point Express
│   ├── config/database.js  # Conexión PostgreSQL
│   ├── middleware/auth.js  # JWT + roles middleware
│   ├── routes/
│   │   ├── auth.routes.js      # Registro, login, verificación
│   │   ├── credit.routes.js    # Dashboard, solicitudes, notificaciones
│   │   └── admin.routes.js     # Gestión usuarios, créditos, config
│   ├── services/
│   │   └── email.service.js    # 6 templates de email
│   └── utils/jwt.js        # Generación/verificación JWT
├── scripts/
│   ├── init-db.js          # Crear tablas
│   └── seed.js             # Crear admin inicial + config
├── package.json
├── .env.template           # Copiar a .env y configurar
└── .gitignore
```

## Instalación

### 1. Prerrequisitos

- Node.js 18+
- PostgreSQL 14+

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.template .env
```

Editar `.env` con tus credenciales de PostgreSQL y SMTP.

### 4. Crear base de datos

```sql
CREATE DATABASE turingtech;
```

### 5. Inicializar tablas

```bash
npm run init-db
```

### 6. Ejecutar seed (crea admin inicial)

```bash
npm run seed
```

Esto crea:
- **Admin**: `admin@turingtech.com.ec` / `turingtech2026`
- **Email de notificaciones**: `nicole.flores@turingtech.com.ec`
- **Créditos iniciales**: 2000

### 7. Iniciar servidor

```bash
npm run dev    # desarrollo (con nodemon)
npm start      # producción
```

El servidor corre en `http://localhost:3000`

## Flujos del sistema

### Registro de usuario
1. Usuario completa formulario en `/register.html`
2. Recibe email de verificación
3. Al hacer clic en el link, se verifica y recibe 2000 créditos
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
