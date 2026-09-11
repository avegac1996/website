const express = require('express');
const db = require('../../config/database');
const { isAdmin, proyectosVisibles } = require('./helpers');

const router = express.Router();

/* ===================== PROYECTOS ===================== */

// GET /api/board/projects  -> proyectos visibles + sus miembros
router.get('/projects', async (req, res) => {
  try {
    const ids = await proyectosVisibles(req);
    const projects = ids.length
      ? (await db.query('SELECT id, nombre, descripcion, created_at FROM board_projects WHERE id = ANY($1) ORDER BY nombre', [ids])).rows
      : [];
    const mem = ids.length
      ? (await db.query(
          `SELECT m.project_id, u.id, u.name, u.email, u.position
           FROM board_project_members m JOIN users u ON u.id = m.user_id
           WHERE m.project_id = ANY($1) ORDER BY u.name`, [ids])).rows
      : [];
    const byProj = {};
    mem.forEach((r) => { (byProj[r.project_id] = byProj[r.project_id] || []).push({ id: r.id, name: r.name, email: r.email, position: r.position }); });
    projects.forEach((p) => { p.members = byProj[p.id] || []; });
    res.json({ projects });
  } catch (err) {
    console.error('Error en board projects:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/board/projects  (solo admin)
router.post('/projects', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Solo un administrador puede crear proyectos' });
  try {
    const nombre = String(req.body.nombre || '').trim();
    const descripcion = req.body.descripcion ? String(req.body.descripcion).trim() : null;
    const miembros = Array.isArray(req.body.miembros) ? req.body.miembros.map(Number).filter(Boolean) : [];
    if (!nombre) return res.status(400).json({ error: 'El nombre del proyecto es obligatorio' });

    const p = (await db.query(
      'INSERT INTO board_projects (nombre, descripcion, created_by) VALUES ($1,$2,$3) RETURNING *',
      [nombre, descripcion, req.user.id]
    )).rows[0];
    for (const uid of miembros) {
      await db.query('INSERT INTO board_project_members (project_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [p.id, uid]);
    }
    res.status(201).json({ project: p });
  } catch (err) {
    console.error('Error creando proyecto:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/board/projects/:id  (solo admin) -> renombrar + reasignar miembros
router.put('/projects/:id', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Solo un administrador puede editar proyectos' });
  try {
    const nombre = String(req.body.nombre || '').trim();
    const descripcion = req.body.descripcion ? String(req.body.descripcion).trim() : null;
    const miembros = Array.isArray(req.body.miembros) ? req.body.miembros.map(Number).filter(Boolean) : [];
    if (!nombre) return res.status(400).json({ error: 'El nombre del proyecto es obligatorio' });

    const p = (await db.query(
      'UPDATE board_projects SET nombre=$1, descripcion=$2 WHERE id=$3 RETURNING *', [nombre, descripcion, req.params.id]
    )).rows;
    if (!p.length) return res.status(404).json({ error: 'Proyecto no encontrado' });

    await db.query('DELETE FROM board_project_members WHERE project_id = $1', [req.params.id]);
    for (const uid of miembros) {
      await db.query('INSERT INTO board_project_members (project_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.params.id, uid]);
    }
    // limpiar assignees que ya no son miembros
    await db.query(
      `UPDATE board_tasks SET assignee_id = NULL, responsable = NULL
       WHERE project_id = $1 AND assignee_id IS NOT NULL
         AND assignee_id NOT IN (SELECT user_id FROM board_project_members WHERE project_id = $1)`,
      [req.params.id]
    );
    res.json({ project: p[0] });
  } catch (err) {
    console.error('Error actualizando proyecto:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/board/projects/:id  (solo admin)
router.delete('/projects/:id', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Solo un administrador puede eliminar proyectos' });
  try {
    const t = await db.query('SELECT COUNT(*) c FROM board_tasks WHERE project_id = $1', [req.params.id]);
    if (Number(t.rows[0].c) > 0) return res.status(400).json({ error: 'El proyecto tiene actividades; muévelas o elimínalas primero' });
    await db.query('DELETE FROM board_sprints WHERE project_id = $1', [req.params.id]);
    const r = await db.query('DELETE FROM board_projects WHERE id = $1 RETURNING id', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Proyecto no encontrado' });
    res.json({ message: 'Proyecto eliminado' });
  } catch (err) {
    console.error('Error eliminando proyecto:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
