const express = require('express');
const db = require('../../config/database');
const { CSV_HEADERS } = require('./constants');

const router = express.Router();

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  let s = String(v).replace(/[\r\n]+/g, ' ');
  if (s.indexOf(';') !== -1 || s.indexOf('"') !== -1) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

const p2 = (n) => String(n).padStart(2, '0');
function fmtTs(d) {
  d = new Date(d);
  return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' +
    p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
}
function fmtDate(d) {
  d = new Date(d);
  return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
}
function rowToCsv(r) {
  const map = {
    timestamp: r.ts ? fmtTs(r.ts) : '',
    fecha_fase: r.fecha_fase ? fmtDate(r.fecha_fase) : '',
  };
  return CSV_HEADERS.map((h) => csvEscape(h in map ? map[h] : r[h])).join(';');
}

// GET /api/prospectos/export  -> descarga el .txt (CSV ;) completo
router.get('/export', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM prospectos ORDER BY ts ASC, id ASC');
    const lines = [CSV_HEADERS.join(';')].concat(result.rows.map(rowToCsv));
    const body = lines.join('\n') + '\n';
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="prospeccion_ecuador.txt"');
    res.send(body);
  } catch (err) {
    console.error('Error en prospectos export:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
