const { Pool } = require('pg');
const path = require('path');
// carga el .env de la raíz del proyecto sin importar desde qué carpeta se ejecute
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

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
