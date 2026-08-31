/**
 * Restaura la base `turingtech` desde scripts/db-backup.sql
 * (snapshot completo: esquema + datos — usuarios, prospectos, tablero, etc.).
 *
 * Uso:  npm run db:restore
 * Requiere `psql` en el PATH y las variables DB_* del .env.
 * OJO: el backup usa DROP ... IF EXISTS, así que reemplaza el contenido actual.
 */
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const SQL = path.join(__dirname, 'db-backup.sql');
if (!fs.existsSync(SQL)) {
  console.error('No se encontró', SQL);
  process.exit(1);
}

const host = process.env.DB_HOST || 'localhost';
const port = process.env.DB_PORT || '5432';
const user = process.env.DB_USER || 'postgres';
const db = process.env.DB_NAME || 'turingtech';

console.log(`Restaurando ${db} en ${host}:${port} desde db-backup.sql ...`);
try {
  execFileSync('psql', ['-h', host, '-p', String(port), '-U', user, '-d', db, '-v', 'ON_ERROR_STOP=1', '-f', SQL], {
    stdio: 'inherit',
    env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD || '' },
  });
  console.log('\nRestauración completada.');
} catch (err) {
  console.error('\nFalló la restauración. ¿Está `psql` en el PATH y la base creada?');
  process.exit(1);
}
