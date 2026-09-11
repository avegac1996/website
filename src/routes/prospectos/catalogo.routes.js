const express = require('express');
const db = require('../../config/database');
const { adminMiddleware } = require('../../middleware/auth');
const { BOARD_ESTADOS, KANBAN_COLS } = require('./constants');
const { slugify } = require('./helpers');

const router = express.Router();

/* ===================== CATÁLOGO CONFIGURABLE (estados / tipos) ===================== */

// GET /api/prospectos/catalogo  -> todo (incluye inactivos) para el panel de admin
router.get('/catalogo', async (req, res) => {
  try {
    const estados = (await db.query('SELECT * FROM prospecto_estados ORDER BY orden, id')).rows;
    const tipos = (await db.query('SELECT * FROM prospecto_tipos_interaccion ORDER BY orden, id')).rows;
    res.json({ estados, tipos, board_estados: BOARD_ESTADOS });
  } catch (err) {
    console.error('Error catalogo prospectos:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

function limpiarOrden(v) { return Number.isFinite(Number(v)) ? Number(v) : 0; }

// ---- estados del pipeline ----
router.post('/catalogo/estados', adminMiddleware, async (req, res) => {
  try {
    const label = String(req.body.label || '').trim();
    if (!label) return res.status(400).json({ error: 'El nombre es obligatorio' });
    let slug = slugify(req.body.slug || label);
    if (!slug) return res.status(400).json({ error: 'Nombre no válido' });
    if ((await db.query('SELECT 1 FROM prospecto_estados WHERE slug = $1', [slug])).rows.length) {
      slug = (slug + '_' + Date.now().toString(36).slice(-4)).slice(0, 30);
    }
    const color = /^#[0-9a-fA-F]{6}$/.test(req.body.color) ? req.body.color : '#94a3b8';
    const board_estado = BOARD_ESTADOS.includes(req.body.board_estado) ? req.body.board_estado : 'En curso';
    const kanban = KANBAN_COLS.includes(req.body.kanban) ? req.body.kanban : 'prospectando';
    const orden = Number(req.body.orden) || (await db.query('SELECT COALESCE(MAX(orden),0)+1 n FROM prospecto_estados')).rows[0].n;
    const row = (await db.query(
      'INSERT INTO prospecto_estados (slug,label,color,board_estado,kanban,orden) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [slug, label, color, board_estado, kanban, orden]
    )).rows[0];
    res.status(201).json({ estado: row });
  } catch (err) {
    console.error('Error creando estado:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.put('/catalogo/estados/:eid', adminMiddleware, async (req, res) => {
  try {
    const label = String(req.body.label || '').trim();
    if (!label) return res.status(400).json({ error: 'El nombre es obligatorio' });
    const color = /^#[0-9a-fA-F]{6}$/.test(req.body.color) ? req.body.color : '#94a3b8';
    const board_estado = BOARD_ESTADOS.includes(req.body.board_estado) ? req.body.board_estado : 'En curso';
    const cur = (await db.query('SELECT kanban FROM prospecto_estados WHERE id = $1', [req.params.eid])).rows[0];
    const kanban = KANBAN_COLS.includes(req.body.kanban) ? req.body.kanban : (cur ? cur.kanban : 'prospectando');
    const row = (await db.query(
      'UPDATE prospecto_estados SET label=$1,color=$2,board_estado=$3,kanban=$4,activo=$5,orden=$6 WHERE id=$7 RETURNING *',
      [label, color, board_estado, kanban, req.body.activo !== false, limpiarOrden(req.body.orden), req.params.eid]
    )).rows[0];
    if (!row) return res.status(404).json({ error: 'Estado no encontrado' });
    res.json({ estado: row });
  } catch (err) {
    console.error('Error actualizando estado:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/catalogo/estados/:eid', adminMiddleware, async (req, res) => {
  try {
    const e = (await db.query('SELECT slug FROM prospecto_estados WHERE id = $1', [req.params.eid])).rows[0];
    if (!e) return res.status(404).json({ error: 'Estado no encontrado' });
    if ((await db.query('SELECT 1 FROM prospectos WHERE estado = $1 LIMIT 1', [e.slug])).rows.length) {
      return res.status(400).json({ error: 'Hay prospectos con este estado; desactívalo en vez de borrarlo.' });
    }
    await db.query('DELETE FROM prospecto_estados WHERE id = $1', [req.params.eid]);
    res.json({ message: 'Estado eliminado' });
  } catch (err) {
    console.error('Error eliminando estado:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ---- tipos de interacción ----
router.post('/catalogo/tipos', adminMiddleware, async (req, res) => {
  try {
    const label = String(req.body.label || '').trim();
    if (!label) return res.status(400).json({ error: 'El nombre es obligatorio' });
    let slug = slugify(req.body.slug || label);
    if (!slug) return res.status(400).json({ error: 'Nombre no válido' });
    if ((await db.query('SELECT 1 FROM prospecto_tipos_interaccion WHERE slug = $1', [slug])).rows.length) {
      slug = (slug + '_' + Date.now().toString(36).slice(-4)).slice(0, 30);
    }
    const icono = String(req.body.icono || '').trim() || 'fa-solid fa-note-sticky';
    const orden = Number(req.body.orden) || (await db.query('SELECT COALESCE(MAX(orden),0)+1 n FROM prospecto_tipos_interaccion')).rows[0].n;
    const row = (await db.query(
      'INSERT INTO prospecto_tipos_interaccion (slug,label,icono,orden) VALUES ($1,$2,$3,$4) RETURNING *',
      [slug, label, icono, orden]
    )).rows[0];
    res.status(201).json({ tipo: row });
  } catch (err) {
    console.error('Error creando tipo:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.put('/catalogo/tipos/:tid', adminMiddleware, async (req, res) => {
  try {
    const label = String(req.body.label || '').trim();
    if (!label) return res.status(400).json({ error: 'El nombre es obligatorio' });
    const icono = String(req.body.icono || '').trim() || 'fa-solid fa-note-sticky';
    const row = (await db.query(
      'UPDATE prospecto_tipos_interaccion SET label=$1,icono=$2,activo=$3,orden=$4 WHERE id=$5 RETURNING *',
      [label, icono, req.body.activo !== false, limpiarOrden(req.body.orden), req.params.tid]
    )).rows[0];
    if (!row) return res.status(404).json({ error: 'Tipo no encontrado' });
    res.json({ tipo: row });
  } catch (err) {
    console.error('Error actualizando tipo:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/catalogo/tipos/:tid', adminMiddleware, async (req, res) => {
  try {
    const t = (await db.query('SELECT slug FROM prospecto_tipos_interaccion WHERE id = $1', [req.params.tid])).rows[0];
    if (!t) return res.status(404).json({ error: 'Tipo no encontrado' });
    if ((await db.query('SELECT 1 FROM prospecto_interacciones WHERE tipo = $1 LIMIT 1', [t.slug])).rows.length) {
      return res.status(400).json({ error: 'Hay interacciones de este tipo; desactívalo en vez de borrarlo.' });
    }
    await db.query('DELETE FROM prospecto_tipos_interaccion WHERE id = $1', [req.params.tid]);
    res.json({ message: 'Tipo eliminado' });
  } catch (err) {
    console.error('Error eliminando tipo:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
