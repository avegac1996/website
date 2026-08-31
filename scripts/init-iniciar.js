/**
 * init-iniciar  —  configuración automática de la base en el servidor.
 *
 *   npm run init:iniciar
 *
 * Qué hace (usando las variables DB_* del .env):
 *   1. Crea la base de datos si no existe.
 *   2. Carga el esquema completo + TODOS los datos (usuarios/login, prospectos,
 *      tablero, RRHH, créditos, config...) desde scripts/db-backup.sql.
 *   3. Si no hay snapshot, cae a init-db.js + seed.js (base vacía + admin).
 *
 * No necesita `psql` instalado: usa el cliente `pg`.
 * db-backup.sql se genera con --clean --if-exists, así que es idempotente:
 * puedes correrlo en una base nueva o re-sincronizar una existente.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { Client } = require('pg');

// carga el .env de la raíz del proyecto sin importar desde qué carpeta se ejecute
const ENV_PATH = path.join(__dirname, '..', '.env');
require('dotenv').config({ path: ENV_PATH });

if (!fs.existsSync(ENV_PATH)) {
  console.error(`\nNo existe ${ENV_PATH}`);
  console.error('Crea el .env en la raíz del proyecto con DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD.');
  process.exit(1);
}
if (!process.env.DB_PASSWORD) {
  console.error('\nFalta DB_PASSWORD en el .env (' + ENV_PATH + ').');
  process.exit(1);
}

const cfg = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
};
const DB = (process.env.DB_NAME || 'turingtech').trim();
const DUMP = path.join(__dirname, 'db-backup.sql');

if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(DB)) {
  console.error('DB_NAME no válido:', DB);
  process.exit(1);
}

async function crearBaseSiNoExiste() {
  const admin = new Client({ ...cfg, database: 'postgres' });
  await admin.connect();
  try {
    const r = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [DB]);
    if (r.rows.length) {
      console.log(`[1/2] Base "${DB}" ya existe.`);
    } else {
      await admin.query(`CREATE DATABASE "${DB}"`);
      console.log(`[1/2] Base "${DB}" creada.`);
    }
  } finally {
    await admin.end();
  }
}

async function cargarSnapshot() {
  let sql = fs.readFileSync(DUMP, 'utf8');
  // pg17 mete meta-comandos de psql (\restrict / \unrestrict); el cliente pg no los entiende.
  sql = sql.replace(/^\\(?:un)?restrict\b.*$/gm, '');

  const db = new Client({ ...cfg, database: DB });
  await db.connect();
  try {
    await db.query(sql);
    console.log('[2/2] Esquema + datos cargados desde db-backup.sql.');
  } finally {
    await db.end();
  }
}

function correr(script) {
  execFileSync(process.execPath, [path.join(__dirname, script)], { stdio: 'inherit' });
}

(async () => {
  console.log(`\nConfigurando base "${DB}" en ${cfg.host}:${cfg.port} (usuario ${cfg.user})\n`);
  await crearBaseSiNoExiste();

  if (fs.existsSync(DUMP)) {
    await cargarSnapshot();
  } else {
    console.log('[2/2] No hay db-backup.sql -> creando base vacía (init-db + seed).');
    correr('init-db.js');
    correr('seed.js');
  }

  console.log('\n=========================================');
  console.log('  Base lista.');
  console.log('  Admin:  admin@turingtech.com.ec / turingtech2026');
  console.log('  Arranca el servidor con:  npm start');
  console.log('=========================================\n');
  process.exit(0);
})().catch((err) => {
  console.error('\nError configurando la base:', err.message);
  if (/ECONNREFUSED|password authentication|does not exist/i.test(err.message || '')) {
    console.error('Revisa DB_HOST / DB_PORT / DB_USER / DB_PASSWORD en el .env del servidor.');
  }
  process.exit(1);
});
