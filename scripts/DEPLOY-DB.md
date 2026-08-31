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

## 2. Crear y cargar la base

```bash
# crear la base (una sola vez)
psql -h 127.0.0.1 -U postgres -c "CREATE DATABASE turingtech;"

# opción A — esquema + datos actuales (recomendado): restaura el snapshot
npm run db:restore                 # usa scripts/db-backup.sql y las DB_* del .env

# opción B — base vacía: solo esquema + admin inicial
npm run init-db
npm run seed
```

## 3. Arrancar

```bash
npm start     # o pm2 / systemd
```

> `scripts/db-backup.sql` es un snapshot completo (esquema + usuarios + prospectos + tablero + etc.).
> Regenerarlo desde local: `pg_dump ... --clean --if-exists --inserts -f scripts/db-backup.sql`
