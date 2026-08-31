#!/usr/bin/env bash
#
# init-iniciar.sh  —  despliegue de la base + arranque del servidor (Ubuntu / DigitalOcean).
#
#   bash scripts/init-iniciar.sh              # recrea la base y levanta el servidor
#   bash scripts/init-iniciar.sh --no-server  # solo la base, no toca el servidor
#   bash scripts/init-iniciar.sh --keep-db    # no borra la base, solo re-carga el snapshot
#
# Qué hace:
#   1. Lee las variables DB_* del .env (en la raíz del proyecto).
#   2. ELIMINA la base y la vuelve a crear de cero.
#   3. Carga esquema + TODOS los datos desde scripts/db-backup.sql
#      (usuarios/login, prospectos, tablero, RRHH, créditos/Turingcoins, config).
#   4. npm install (solo dependencias de producción).
#   5. Reinicia el servidor (pm2 si está disponible, si no nohup).
#
set -euo pipefail

# --- ubicarse en la raíz del proyecto ---
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

KEEP_DB=0
START_SERVER=1
for arg in "$@"; do
  case "$arg" in
    --keep-db)   KEEP_DB=1 ;;
    --no-server) START_SERVER=0 ;;
    *) echo "Opción desconocida: $arg"; exit 1 ;;
  esac
done

# --- cargar .env ---
if [ ! -f "$ROOT/.env" ]; then
  echo "ERROR: no existe $ROOT/.env"
  echo "Crea el .env con DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD."
  exit 1
fi
set -a
# shellcheck disable=SC1091
. "$ROOT/.env"
set +a

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-turingtech}"
DB_USER="${DB_USER:-postgres}"
: "${DB_PASSWORD:?Falta DB_PASSWORD en el .env}"

if ! [[ "$DB_NAME" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
  echo "ERROR: DB_NAME no válido: $DB_NAME"; exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: falta 'psql'. Instálalo con:  sudo apt-get install -y postgresql-client"
  exit 1
fi

export PGPASSWORD="$DB_PASSWORD"
PSQL=(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -v ON_ERROR_STOP=1 -X -q)

DUMP="$ROOT/scripts/db-backup.sql"
if [ ! -f "$DUMP" ]; then
  echo "ERROR: no existe $DUMP"; exit 1
fi

echo ""
echo "==> Base \"$DB_NAME\" en $DB_HOST:$DB_PORT (usuario $DB_USER)"

if [ "$KEEP_DB" -eq 0 ]; then
  echo "==> Cortando conexiones y recreando la base de cero"
  "${PSQL[@]}" -d postgres -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB_NAME' AND pid<>pg_backend_pid();" >/dev/null
  "${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\";"
  "${PSQL[@]}" -d postgres -c "CREATE DATABASE \"$DB_NAME\";"
else
  echo "==> --keep-db: no se elimina la base, solo se re-carga el snapshot"
  "${PSQL[@]}" -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
    || "${PSQL[@]}" -d postgres -c "CREATE DATABASE \"$DB_NAME\";"
fi

echo "==> Cargando esquema + datos desde scripts/db-backup.sql"
# transaction_timeout solo existe en Postgres 17; se quita por si el server es más viejo.
sed -E '/^SET transaction_timeout /d' "$DUMP" | "${PSQL[@]}" -d "$DB_NAME"

USERS=$("${PSQL[@]}" -d "$DB_NAME" -tAc "SELECT count(*) FROM users")
PROS=$("${PSQL[@]}" -d "$DB_NAME" -tAc "SELECT count(*) FROM prospectos")
TASKS=$("${PSQL[@]}" -d "$DB_NAME" -tAc "SELECT count(*) FROM board_tasks")
echo "    usuarios=$USERS  prospectos=$PROS  tareas=$TASKS"

echo "==> npm install (producción)"
npm install --omit=dev --no-audit --no-fund

if [ "$START_SERVER" -eq 1 ]; then
  echo "==> Reiniciando el servidor"
  if command -v pm2 >/dev/null 2>&1; then
    pm2 delete turingtech >/dev/null 2>&1 || true
    pm2 start "$ROOT/src/server.js" --name turingtech --cwd "$ROOT"
    pm2 save || true
  else
    pkill -f "node .*src/server.js" 2>/dev/null || true
    sleep 1
    nohup node "$ROOT/src/server.js" > "$ROOT/server.log" 2>&1 &
    echo "    servidor en background; logs en $ROOT/server.log"
  fi
else
  echo "==> --no-server: no se toca el servidor"
fi

echo ""
echo "===================================================="
echo "  Base lista."
echo "  Admin:  admin@turingtech.com.ec / turingtech2026"
[ "$START_SERVER" -eq 0 ] && echo "  Arranca el servidor con:  npm start"
echo "===================================================="
