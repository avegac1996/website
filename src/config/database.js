const { Pool, types } = require('pg');
const path = require('path');
// carga el .env de la raíz del proyecto sin importar desde qué carpeta se ejecute
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// Columnas DATE (OID 1082): devolver el texto 'YYYY-MM-DD' tal cual, sin
// convertirlas a Date. Así el front no sufre corrimientos de ±1 día por zona
// horaria (ej. una fecha guardada como 2026-09-10 se veía como 09-sep en Ecuador).
types.setTypeParser(1082, (v) => v);

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'turingtech',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
