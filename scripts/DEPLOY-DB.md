# Base de datos en el servidor

## 1. Variables de entorno (`.env` en el servidor)

El `.env` **no está en git**. En el servidor crea `/ruta/al/proyecto/.env` con:

```
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=turingtech
DB_USER=postgres
DB_PASSWORD=<la contraseña real del Postgres del servidor>
```

(más `JWT_SECRET`, `SMTP_*`, `APP_URL=https://turingtech.com.ec`, etc. — ver `.env.example`)

## 2. Crear y cargar la base — un solo comando

```bash
npm run init:iniciar
```

Hace todo automáticamente con las variables `DB_*` del `.env`:
1. crea la base `turingtech` si no existe
2. carga el esquema + **todos los datos** (usuarios/login, prospectos, tablero, RRHH…) desde `scripts/db-backup.sql`

No necesita `psql` (usa el cliente `pg`). Es idempotente: se puede correr en una base
nueva o para re-sincronizar una existente.

### Alternativas
```bash
npm run db:restore        # igual, pero vía psql (requiere psql en el PATH)
npm run init-db && npm run seed   # base vacía: solo esquema + admin inicial
```

## 3. Arrancar

```bash
npm start     # o pm2 / systemd
```

> `scripts/db-backup.sql` es un snapshot completo (esquema + usuarios + prospectos + tablero + etc.).
> Regenerarlo desde local: `pg_dump ... --clean --if-exists --inserts -f scripts/db-backup.sql`
