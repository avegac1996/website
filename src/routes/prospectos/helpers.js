const db = require('../../config/database');
const { FIELDS, PROSPECTO_ESTADO_BOARD_MAPPING } = require('./constants');

const isAdmin = (req) => req.user.role === 'admin';

const slugify = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30);

async function tiposActivos() {
  return (await db.query('SELECT slug, label, icono, orden FROM prospecto_tipos_interaccion WHERE activo = true ORDER BY orden, id')).rows;
}
function boardEstadoDe(prospecto) {
  // Mapeo determinístico: estado prospecto → estado board (no variable, no async)
  return PROSPECTO_ESTADO_BOARD_MAPPING[prospecto.estado] || 'En curso';
}

function parseDataUrl(data) {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(String(data || ''));
  if (!m) return null;
  const mime = m[1].toLowerCase();
  const bytes = m[2] ? Math.floor(m[3].length * 3 / 4) : m[3].length;
  return { mime, bytes };
}

function clean(body) {
  const out = {};
  FIELDS.forEach((f) => { out[f] = body[f] != null && body[f] !== '' ? String(body[f]).trim() : null; });
  return out;
}

module.exports = { isAdmin, slugify, tiposActivos, boardEstadoDe, parseDataUrl, clean };
