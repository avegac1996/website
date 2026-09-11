# Migraciones manuales

El proyecto no tiene un framework de migraciones: `scripts/init-db.js` solo
sabe crear cosas nuevas (`CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD
COLUMN IF NOT EXISTS`), nunca `DROP`. Y el deploy a producción es un `git
pull` en el droplet — no hay ningún paso automático que aplique cambios de
esquema a la base ya corriendo.

Por eso, cualquier cambio de esquema que tenga que llegar a producción
(borrar/renombrar columnas, backfills de datos, etc.) se agrega acá como un
archivo `.sql` nuevo, y se corre a mano.

## Convención

- Un archivo por cambio, nombrado `NNN_descripcion_corta.sql` con prefijo
  numérico secuencial (`001_...`, `002_...`).
- El archivo empieza con un comentario que explica qué hace y por qué.
- El SQL va guardado con `IF EXISTS`/`IF NOT EXISTS` donde aplique, para que
  correrlo dos veces no rompa nada.
- Una vez que un archivo ya se corrió en producción **no se edita más** — si
  hace falta un ajuste, se agrega un archivo nuevo con el siguiente número.

## Cómo correr uno

```bash
psql "$DATABASE_URL" -f scripts/migrations/001_drop_proxima_gestion_columns.sql
```

Probalo primero contra una copia local/staging de la base antes de correrlo
en producción.
