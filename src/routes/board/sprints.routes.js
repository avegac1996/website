const express = require('express');
const db = require('../../config/database');
const { ESTADO_FINAL, SPRINT_ESTADOS } = require('./constants');
const { puedeProyecto, proyectosVisibles } = require('./helpers');
const { sprintConProyecto, cleanSprint } = require('./sprints-shared');

const router = express.Router();

/* ===================== SPRINTS ===================== */

// GET /api/board/sprints  -> sprints de los proyectos visibles
router.get('/sprints', async (req, res) => {
  try {
    const ids = await proyectosVisibles(req);
    const rows = ids.length
      ? (await db.query(
          `SELECT s.id, s.project_id, s.nombre, s.objetivo, s.fecha_inicio, s.fecha_fin, s.estado,
                  s.created_at,
                  (SELECT COUNT(*) FROM board_tasks t WHERE t.sprint_id = s.id) AS total_tareas,
                  (SELECT COUNT(*) FROM board_tasks t WHERE t.sprint_id = s.id AND t.estado = $2) AS tareas_finalizadas,
                  (SELECT COALESCE(SUM(t.puntos),0) FROM board_tasks t WHERE t.sprint_id = s.id) AS total_puntos,
                  (SELECT COALESCE(SUM(t.puntos),0) FROM board_tasks t WHERE t.sprint_id = s.id AND t.estado = $2) AS puntos_finalizados
           FROM board_sprints s
           WHERE s.project_id = ANY($1)
           ORDER BY s.project_id, (s.estado = 'activo') DESC, s.fecha_inicio NULLS LAST, s.id`,
          [ids, ESTADO_FINAL])).rows
      : [];
    res.json({ sprints: rows });
  } catch (err) {
    console.error('Error en board sprints:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/board/sprints
router.post('/sprints', async (req, res) => {
  try {
    const project_id = Number(req.body.project_id) || null;
    if (!(await puedeProyecto(req, project_id))) return res.status(403).json({ error: 'No perteneces a ese proyecto' });
    const s = cleanSprint(req.body);
    if (!s.nombre) return res.status(400).json({ error: 'El nombre del sprint es obligatorio' });

    const row = (await db.query(
      `INSERT INTO board_sprints (project_id, nombre, objetivo, fecha_inicio, fecha_fin, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [project_id, s.nombre, s.objetivo, s.fecha_inicio, s.fecha_fin, req.user.id]
    )).rows[0];
    res.status(201).json({ sprint: row });
  } catch (err) {
    console.error('Error creando sprint:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/board/sprints/:id
router.put('/sprints/:id', async (req, res) => {
  try {
    const cur = await sprintConProyecto(req.params.id);
    if (!cur) return res.status(404).json({ error: 'Sprint no encontrado' });
    if (!(await puedeProyecto(req, cur.project_id))) return res.status(403).json({ error: 'No perteneces a ese proyecto' });

    const s = cleanSprint(req.body);
    if (!s.nombre) return res.status(400).json({ error: 'El nombre del sprint es obligatorio' });
    const row = (await db.query(
      `UPDATE board_sprints SET nombre=$1, objetivo=$2, fecha_inicio=$3, fecha_fin=$4, updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [s.nombre, s.objetivo, s.fecha_inicio, s.fecha_fin, req.params.id]
    )).rows[0];
    res.json({ sprint: row });
  } catch (err) {
    console.error('Error actualizando sprint:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PATCH /api/board/sprints/:id/estado  -> activar | cerrar | reabrir(planificado)
router.patch('/sprints/:id/estado', async (req, res) => {
  try {
    const estado = SPRINT_ESTADOS.includes(req.body.estado) ? req.body.estado : null;
    if (!estado) return res.status(400).json({ error: 'Estado de sprint no válido' });
    const cur = await sprintConProyecto(req.params.id);
    if (!cur) return res.status(404).json({ error: 'Sprint no encontrado' });
    if (!(await puedeProyecto(req, cur.project_id))) return res.status(403).json({ error: 'No perteneces a ese proyecto' });

    if (estado === 'activo') {
      const otro = await db.query(
        "SELECT id, nombre FROM board_sprints WHERE project_id = $1 AND estado = 'activo' AND id <> $2",
        [cur.project_id, cur.id]
      );
      if (otro.rows.length) {
        return res.status(400).json({ error: `Ya hay un sprint activo ("${otro.rows[0].nombre}"); ciérralo primero.` });
      }
    }

    await db.query('BEGIN');
    await db.query('UPDATE board_sprints SET estado=$1, updated_at=NOW() WHERE id=$2', [estado, cur.id]);
    let devueltas = 0;
    if (estado === 'cerrado') {
      // las tareas sin terminar vuelven al Backlog
      const r = await db.query(
        'UPDATE board_tasks SET sprint_id = NULL, updated_at = NOW() WHERE sprint_id = $1 AND estado <> $2 RETURNING id',
        [cur.id, ESTADO_FINAL]
      );
      devueltas = r.rows.length;
    }
    await db.query('COMMIT');
    res.json({ id: cur.id, estado, tareas_devueltas_al_backlog: devueltas });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Error cambiando estado de sprint:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/board/sprints/:id  -> las tareas quedan en el Backlog
router.delete('/sprints/:id', async (req, res) => {
  try {
    const cur = await sprintConProyecto(req.params.id);
    if (!cur) return res.status(404).json({ error: 'Sprint no encontrado' });
    if (!(await puedeProyecto(req, cur.project_id))) return res.status(403).json({ error: 'No perteneces a ese proyecto' });
    // FK ON DELETE SET NULL manda las tareas al backlog automáticamente
    await db.query('DELETE FROM board_sprints WHERE id = $1', [cur.id]);
    res.json({ message: 'Sprint eliminado' });
  } catch (err) {
    console.error('Error eliminando sprint:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
