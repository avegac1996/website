const express = require('express');
const db = require('../../config/database');
const { ACT_TIPOS } = require('./constants');

const router = express.Router();

/* ===================== ACTIVIDADES DEL PROSPECTO ===================== */

// GET /api/prospectos/:id/actividades
router.get('/:id/actividades', async (req, res) => {
  try {
    const rows = (await db.query(
      `SELECT a.id, a.tipo, a.titulo, a.deadline, a.hecha, a.hecha_at, a.created_at, u.name AS usuario
       FROM prospecto_actividades a LEFT JOIN users u ON u.id = a.created_by
       WHERE a.prospecto_id = $1 ORDER BY a.hecha, a.deadline NULLS LAST, a.id`, [req.params.id]
    )).rows;
    res.json({ actividades: rows });
  } catch (err) {
    console.error('Error listando actividades:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/prospectos/:id/actividades   { tipo, titulo, deadline }
router.post('/:id/actividades', async (req, res) => {
  try {
    const cur = (await db.query('SELECT id FROM prospectos WHERE id = $1', [req.params.id])).rows[0];
    if (!cur) return res.status(404).json({ error: 'Prospecto no encontrado' });
    const tipo = ACT_TIPOS.includes(req.body.tipo) ? req.body.tipo : 'llamada';
    const titulo = req.body.titulo ? String(req.body.titulo).slice(0, 200) : null;
    const deadline = /^\d{4}-\d{2}-\d{2}$/.test(req.body.deadline || '') ? req.body.deadline : null;
    if (!deadline) return res.status(400).json({ error: 'Poné una fecha límite para la actividad' });
    const row = (await db.query(
      `INSERT INTO prospecto_actividades (prospecto_id, tipo, titulo, deadline, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, tipo, titulo, deadline, hecha, hecha_at, created_at`,
      [req.params.id, tipo, titulo, deadline, req.user.id]
    )).rows[0];
    res.status(201).json({ actividad: row });
  } catch (err) {
    console.error('Error creando actividad:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PATCH /api/prospectos/:id/actividades/:aid   { hecha?, tipo?, titulo?, deadline? }
router.patch('/:id/actividades/:aid', async (req, res) => {
  try {
    const cur = (await db.query('SELECT * FROM prospecto_actividades WHERE id = $1 AND prospecto_id = $2', [req.params.aid, req.params.id])).rows[0];
    if (!cur) return res.status(404).json({ error: 'Actividad no encontrada' });
    const tipo = ACT_TIPOS.includes(req.body.tipo) ? req.body.tipo : cur.tipo;
    const titulo = req.body.titulo !== undefined ? (req.body.titulo ? String(req.body.titulo).slice(0, 200) : null) : cur.titulo;
    const deadline = req.body.deadline !== undefined
      ? (/^\d{4}-\d{2}-\d{2}$/.test(req.body.deadline || '') ? req.body.deadline : null)
      : cur.deadline;
    const hecha = req.body.hecha !== undefined ? !!req.body.hecha : cur.hecha;
    const row = (await db.query(
      `UPDATE prospecto_actividades
         SET tipo = $1, titulo = $2, deadline = $3, hecha = $4,
             hecha_at = CASE WHEN $4 AND NOT $5 THEN NOW() WHEN NOT $4 THEN NULL ELSE hecha_at END
       WHERE id = $6 RETURNING id, tipo, titulo, deadline, hecha, hecha_at, created_at`,
      [tipo, titulo, deadline, hecha, cur.hecha, req.params.aid]
    )).rows[0];
    res.json({ actividad: row });
  } catch (err) {
    console.error('Error actualizando actividad:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/prospectos/:id/actividades/:aid
router.delete('/:id/actividades/:aid', async (req, res) => {
  try {
    const r = await db.query('DELETE FROM prospecto_actividades WHERE id = $1 AND prospecto_id = $2 RETURNING id', [req.params.aid, req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Actividad no encontrada' });
    res.json({ message: 'Actividad eliminada' });
  } catch (err) {
    console.error('Error eliminando actividad:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
