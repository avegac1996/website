const express = require('express');
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const ESTADOS = ['Tareas por hacer', 'En curso', 'Client Review', 'Control de calidad', 'Finalizada', 'Bloqueado'];
const TIPOS = ['Tarea', 'Reunión', 'Desarrollo', 'Configuración', 'Soporte', 'Investigación'];

const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || null;

// Solo colaboradores TURINGTECH y admins
router.use(authMiddleware, (req, res, next) => {
  if (req.user.role === 'admin' || req.user.account_type === 'colaborador') return next();
  return res.status(403).json({ error: 'Acceso solo para colaboradores TURINGTECH' });
});

const isAdmin = (req) => req.user.role === 'admin';

// ¿el usuario es miembro del proyecto? (admin siempre)
async function puedeProyecto(req, projectId) {
  if (!projectId) return false;
  if (isAdmin(req)) return true;
  const r = await db.query('SELECT 1 FROM board_project_members WHERE project_id = $1 AND user_id = $2', [projectId, req.user.id]);
  return r.rows.length > 0;
}

async function proyectosVisibles(req) {
  if (isAdmin(req)) {
    return (await db.query('SELECT id FROM board_projects')).rows.map((r) => r.id);
  }
  return (await db.query('SELECT project_id FROM board_project_members WHERE user_id = $1', [req.user.id])).rows.map((r) => r.project_id);
}

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
    const r = await db.query('DELETE FROM board_projects WHERE id = $1 RETURNING id', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Proyecto no encontrado' });
    res.json({ message: 'Proyecto eliminado' });
  } catch (err) {
    console.error('Error eliminando proyecto:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* ===================== TAREAS ===================== */

// GET /api/board/tasks  -> tareas de los proyectos visibles + meta
router.get('/tasks', async (req, res) => {
  try {
    const ids = await proyectosVisibles(req);
    const rows = ids.length
      ? (await db.query(
          `SELECT t.id, t.titulo, t.tipo, t.estado, t.fecha, t.fecha_fin, t.horas, t.observaciones, t.orden,
                  t.project_id, bp.nombre AS proyecto, t.assignee_id,
                  u.name AS assignee_nombre, COALESCE(t.responsable, split_part(u.name,' ',1)) AS responsable,
                  t.created_at, t.updated_at
           FROM board_tasks t
           LEFT JOIN board_projects bp ON bp.id = t.project_id
           LEFT JOIN users u ON u.id = t.assignee_id
           WHERE t.project_id = ANY($1)
           ORDER BY bp.nombre NULLS LAST, t.fecha NULLS LAST, t.orden, t.id`, [ids])).rows
      : [];

    // meta: proyectos visibles con miembros (para el editor)
    const projects = ids.length
      ? (await db.query('SELECT id, nombre FROM board_projects WHERE id = ANY($1) ORDER BY nombre', [ids])).rows
      : [];
    const mem = ids.length
      ? (await db.query(
          `SELECT m.project_id, u.id, u.name FROM board_project_members m JOIN users u ON u.id = m.user_id
           WHERE m.project_id = ANY($1) ORDER BY u.name`, [ids])).rows
      : [];
    const membersByProject = {};
    mem.forEach((r) => { (membersByProject[r.project_id] = membersByProject[r.project_id] || []).push({ id: r.id, name: r.name }); });

    let colaboradores = [];
    if (isAdmin(req)) {
      colaboradores = (await db.query(
        "SELECT id, name, position FROM users WHERE account_type = 'colaborador' AND active = true ORDER BY name"
      )).rows;
    }

    res.json({
      tasks: rows,
      meta: {
        estados: ESTADOS,
        tipos: TIPOS,
        isAdmin: isAdmin(req),
        projects,
        membersByProject,
        colaboradores,
      },
    });
  } catch (err) {
    console.error('Error en board tasks:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

function cleanTask(body) {
  const estado = ESTADOS.includes(body.estado) ? body.estado : 'Tareas por hacer';
  const horas = body.horas === '' || body.horas == null ? null : Number(body.horas);
  return {
    titulo: String(body.titulo || '').trim(),
    project_id: body.project_id ? Number(body.project_id) : null,
    assignee_id: body.assignee_id ? Number(body.assignee_id) : null,
    tipo: body.tipo ? String(body.tipo).trim() : 'Tarea',
    estado,
    fecha: body.fecha || null,
    fecha_fin: body.fecha_fin || null,
    horas: Number.isFinite(horas) ? horas : null,
    observaciones: body.observaciones ? String(body.observaciones).trim() : null,
  };
}

// valida proyecto + que el assignee sea miembro
async function validarTarea(req, t) {
  if (!t.project_id) return 'Elige un proyecto';
  if (!(await puedeProyecto(req, t.project_id))) return 'No perteneces a ese proyecto';
  if (t.assignee_id) {
    const m = await db.query('SELECT 1 FROM board_project_members WHERE project_id=$1 AND user_id=$2', [t.project_id, t.assignee_id]);
    if (!m.rows.length) return 'El responsable no pertenece a ese proyecto';
  }
  return null;
}

async function nombreAsignado(assignee_id) {
  if (!assignee_id) return null;
  const r = await db.query('SELECT name FROM users WHERE id = $1', [assignee_id]);
  return r.rows.length ? firstName(r.rows[0].name) : null;
}

// POST /api/board/tasks
router.post('/tasks', async (req, res) => {
  try {
    const t = cleanTask(req.body);
    if (!t.titulo) return res.status(400).json({ error: 'El título es obligatorio' });
    const err = await validarTarea(req, t);
    if (err) return res.status(400).json({ error: err });

    const ord = await db.query('SELECT COALESCE(MAX(orden), 0) + 1 AS n FROM board_tasks WHERE estado = $1', [t.estado]);
    const resp = await nombreAsignado(t.assignee_id);
    const result = await db.query(
      `INSERT INTO board_tasks (titulo, project_id, assignee_id, responsable, tipo, estado, fecha, fecha_fin, horas, observaciones, orden, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [t.titulo, t.project_id, t.assignee_id, resp, t.tipo, t.estado, t.fecha, t.fecha_fin, t.horas, t.observaciones, ord.rows[0].n, req.user.id]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    console.error('Error creando board task:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/board/tasks/:id
router.put('/tasks/:id', async (req, res) => {
  try {
    const cur = await db.query('SELECT project_id FROM board_tasks WHERE id = $1', [req.params.id]);
    if (!cur.rows.length) return res.status(404).json({ error: 'Tarea no encontrada' });
    if (!(await puedeProyecto(req, cur.rows[0].project_id))) return res.status(403).json({ error: 'No perteneces a ese proyecto' });

    const t = cleanTask(req.body);
    if (!t.titulo) return res.status(400).json({ error: 'El título es obligatorio' });
    const err = await validarTarea(req, t);
    if (err) return res.status(400).json({ error: err });

    const resp = await nombreAsignado(t.assignee_id);
    const result = await db.query(
      `UPDATE board_tasks SET titulo=$1, project_id=$2, assignee_id=$3, responsable=$4, tipo=$5, estado=$6, fecha=$7, fecha_fin=$8,
              horas=$9, observaciones=$10, updated_at=NOW()
       WHERE id=$11 RETURNING id`,
      [t.titulo, t.project_id, t.assignee_id, resp, t.tipo, t.estado, t.fecha, t.fecha_fin, t.horas, t.observaciones, req.params.id]
    );
    res.json({ id: result.rows[0].id });
  } catch (err) {
    console.error('Error actualizando board task:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PATCH /api/board/tasks/:id/estado
router.patch('/tasks/:id/estado', async (req, res) => {
  try {
    const estado = ESTADOS.includes(req.body.estado) ? req.body.estado : null;
    if (!estado) return res.status(400).json({ error: 'Estado no válido' });
    const cur = await db.query('SELECT project_id FROM board_tasks WHERE id = $1', [req.params.id]);
    if (!cur.rows.length) return res.status(404).json({ error: 'Tarea no encontrada' });
    if (!(await puedeProyecto(req, cur.rows[0].project_id))) return res.status(403).json({ error: 'No perteneces a ese proyecto' });

    const ord = await db.query('SELECT COALESCE(MAX(orden), 0) + 1 AS n FROM board_tasks WHERE estado = $1', [estado]);
    await db.query('UPDATE board_tasks SET estado=$1, orden=$2, updated_at=NOW() WHERE id=$3', [estado, ord.rows[0].n, req.params.id]);
    res.json({ id: Number(req.params.id), estado });
  } catch (err) {
    console.error('Error moviendo board task:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/board/tasks/:id
router.delete('/tasks/:id', async (req, res) => {
  try {
    const cur = await db.query('SELECT project_id FROM board_tasks WHERE id = $1', [req.params.id]);
    if (!cur.rows.length) return res.status(404).json({ error: 'Tarea no encontrada' });
    if (!(await puedeProyecto(req, cur.rows[0].project_id))) return res.status(403).json({ error: 'No perteneces a ese proyecto' });
    await db.query('DELETE FROM board_tasks WHERE id = $1', [req.params.id]);
    res.json({ message: 'Tarea eliminada' });
  } catch (err) {
    console.error('Error eliminando board task:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
