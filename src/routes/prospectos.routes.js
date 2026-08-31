const express = require('express');
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Cabeceras del .txt (CSV separado por ; — compatible con Excel ecuatoriano)
const CSV_HEADERS = [
  'timestamp', 'sector_id', 'sector_nombre', 'empresa', 'ruc', 'web',
  'contacto_nombre', 'contacto_apellido', 'cargo', 'email', 'telefono',
  'linkedin', 'fuente', 'pilar', 'fase_sop', 'fecha_fase',
  'extension_pbx', 'horario_preferido', 'notas',
];

const FIELDS = [
  'sector_id', 'sector_nombre', 'empresa', 'ruc', 'web', 'contacto_nombre', 'contacto_apellido',
  'cargo', 'email', 'telefono', 'linkedin', 'fuente', 'pilar', 'fase_sop',
  'fecha_fase', 'extension_pbx', 'horario_preferido', 'notas',
];

// Solo colaboradores TURINGTECH y admins
router.use(authMiddleware, (req, res, next) => {
  if (req.user.role === 'admin' || req.user.account_type === 'colaborador') return next();
  return res.status(403).json({ error: 'Acceso solo para colaboradores TURINGTECH' });
});

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

function clean(body) {
  const out = {};
  FIELDS.forEach((f) => { out[f] = body[f] != null && body[f] !== '' ? String(body[f]).trim() : null; });
  return out;
}

// GET /api/prospectos
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM prospectos ORDER BY ts DESC, id DESC');
    res.json({ prospectos: result.rows, total: result.rows.length });
  } catch (err) {
    console.error('Error en prospectos list:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

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

// POST /api/prospectos
router.post('/', async (req, res) => {
  try {
    const p = clean(req.body);
    if (!p.empresa) return res.status(400).json({ error: 'El nombre de la empresa es obligatorio' });
    const fecha = p.fecha_fase && /^\d{4}-\d{2}-\d{2}$/.test(p.fecha_fase) ? p.fecha_fase : null;

    const result = await db.query(
      `INSERT INTO prospectos (sector_id, sector_nombre, empresa, ruc, web, contacto_nombre, contacto_apellido,
        cargo, email, telefono, linkedin, fuente, pilar, fase_sop, fecha_fase, extension_pbx, horario_preferido, notas, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
      [p.sector_id, p.sector_nombre, p.empresa, p.ruc, p.web, p.contacto_nombre, p.contacto_apellido,
       p.cargo, p.email, p.telefono, p.linkedin, p.fuente, p.pilar, p.fase_sop, fecha,
       p.extension_pbx, p.horario_preferido, p.notas, req.user.id]
    );
    res.status(201).json({ prospecto: result.rows[0] });
  } catch (err) {
    console.error('Error creando prospecto:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/prospectos/:id
router.put('/:id', async (req, res) => {
  try {
    const p = clean(req.body);
    if (!p.empresa) return res.status(400).json({ error: 'El nombre de la empresa es obligatorio' });
    const fecha = p.fecha_fase && /^\d{4}-\d{2}-\d{2}$/.test(p.fecha_fase) ? p.fecha_fase : null;
    const result = await db.query(
      `UPDATE prospectos SET sector_id=$1, sector_nombre=$2, empresa=$3, ruc=$4, web=$5, contacto_nombre=$6,
        contacto_apellido=$7, cargo=$8, email=$9, telefono=$10, linkedin=$11, fuente=$12, pilar=$13, fase_sop=$14,
        fecha_fase=$15, extension_pbx=$16, horario_preferido=$17, notas=$18
       WHERE id=$19 RETURNING *`,
      [p.sector_id, p.sector_nombre, p.empresa, p.ruc, p.web, p.contacto_nombre, p.contacto_apellido,
       p.cargo, p.email, p.telefono, p.linkedin, p.fuente, p.pilar, p.fase_sop, fecha,
       p.extension_pbx, p.horario_preferido, p.notas, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Prospecto no encontrado' });
    res.json({ prospecto: result.rows[0] });
  } catch (err) {
    console.error('Error actualizando prospecto:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/prospectos/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM prospectos WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Prospecto no encontrado' });
    res.json({ message: 'Prospecto eliminado' });
  } catch (err) {
    console.error('Error eliminando prospecto:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
