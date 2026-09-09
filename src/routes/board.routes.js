const express = require('express');
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const ESTADOS = ['Tareas por hacer', 'En curso', 'Client Review', 'Control de calidad', 'Finalizada', 'Bloqueado'];
const TIPOS = ['Tarea', 'Reunión', 'Desarrollo', 'Configuración', 'Soporte', 'Investigación'];
const PRIORIDADES = ['baja', 'media', 'alta', 'urgente'];
const SPRINT_ESTADOS = ['planificado', 'activo', 'cerrado'];
const ESTADO_FINAL = 'Finalizada';

// Turingcoins por cumplimiento de fechas
const COIN_PREMIO = 2;   // terminar a tiempo
const COIN_CASTIGO = 3;  // extender la fecha de fin sin haber terminado

// Adjuntos de tareas (data URL en la BD)
const FILE_MIMES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'application/pdf'];
const FILE_MAX = 5 * 1024 * 1024; // 5 MB (tamaño del binario decodificado)

const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || null;
// Ecuador es UTC-5 todo el año (sin horario de verano)
const hoyISO = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
const soloFecha = (d) => (d ? String(d).slice(0, 10) : null);

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
    await db.query('DELETE FROM board_sprints WHERE project_id = $1', [req.params.id]);
    const r = await db.query('DELETE FROM board_projects WHERE id = $1 RETURNING id', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Proyecto no encontrado' });
    res.json({ message: 'Proyecto eliminado' });
  } catch (err) {
    console.error('Error eliminando proyecto:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* ===================== SPRINTS ===================== */

async function sprintConProyecto(sprintId) {
  const r = await db.query('SELECT id, project_id, nombre, estado FROM board_sprints WHERE id = $1', [sprintId]);
  return r.rows[0] || null;
}

function cleanSprint(body) {
  return {
    nombre: String(body.nombre || '').trim(),
    objetivo: body.objetivo ? String(body.objetivo).trim() : null,
    fecha_inicio: body.fecha_inicio || null,
    fecha_fin: body.fecha_fin || null,
  };
}

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

/* ===================== TAREAS ===================== */

// GET /api/board/tasks  -> tareas de los proyectos visibles + meta
router.get('/tasks', async (req, res) => {
  try {
    const ids = await proyectosVisibles(req);
    const rows = ids.length
      ? (await db.query(
          `SELECT t.id, t.titulo, t.tipo, t.estado, t.fecha, t.fecha_fin, t.horas, t.observaciones, t.orden,
                  t.project_id, bp.nombre AS proyecto, t.assignee_id, t.sprint_id, t.puntos, t.prioridad,
                  t.parent_id, t.recompensa_dada,
                  u.name AS assignee_nombre, COALESCE(t.responsable, split_part(u.name,' ',1)) AS responsable,
                  (SELECT COUNT(*) FROM board_task_files f WHERE f.task_id = t.id)::int AS files_count,
                  t.created_at, t.updated_at
           FROM board_tasks t
           LEFT JOIN board_projects bp ON bp.id = t.project_id
           LEFT JOIN users u ON u.id = t.assignee_id
           WHERE t.project_id = ANY($1)
           ORDER BY bp.nombre NULLS LAST, t.orden, t.id`, [ids])).rows
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

    const sprints = ids.length
      ? (await db.query(
          `SELECT id, project_id, nombre, objetivo, fecha_inicio, fecha_fin, estado
           FROM board_sprints WHERE project_id = ANY($1)
           ORDER BY project_id, (estado = 'activo') DESC, fecha_inicio NULLS LAST, id`, [ids])).rows
      : [];

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
        prioridades: PRIORIDADES,
        estadoFinal: ESTADO_FINAL,
        isAdmin: isAdmin(req),
        projects,
        membersByProject,
        sprints,
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
  const prioridad = PRIORIDADES.includes(body.prioridad) ? body.prioridad : 'media';
  const horas = body.horas === '' || body.horas == null ? null : Number(body.horas);
  const puntos = body.puntos === '' || body.puntos == null ? null : parseInt(body.puntos, 10);
  return {
    titulo: String(body.titulo || '').trim(),
    project_id: body.project_id ? Number(body.project_id) : null,
    assignee_id: body.assignee_id ? Number(body.assignee_id) : null,
    sprint_id: body.sprint_id ? Number(body.sprint_id) : null,
    parent_id: body.parent_id ? Number(body.parent_id) : null,
    tipo: body.tipo ? String(body.tipo).trim() : 'Tarea',
    estado,
    prioridad,
    fecha: body.fecha || null,
    fecha_fin: body.fecha_fin || null,
    horas: Number.isFinite(horas) ? horas : null,
    puntos: Number.isFinite(puntos) && puntos >= 0 ? puntos : null,
    observaciones: body.observaciones ? String(body.observaciones).trim() : null,
  };
}

// valida proyecto + que el assignee, el sprint y la tarea padre pertenezcan a ese proyecto
async function validarTarea(req, t, selfId) {
  if (!t.project_id) return 'Elige un proyecto';
  if (!(await puedeProyecto(req, t.project_id))) return 'No perteneces a ese proyecto';
  if (t.assignee_id) {
    const m = await db.query('SELECT 1 FROM board_project_members WHERE project_id=$1 AND user_id=$2', [t.project_id, t.assignee_id]);
    if (!m.rows.length) return 'El responsable no pertenece a ese proyecto';
  }
  if (t.sprint_id) {
    const s = await db.query('SELECT 1 FROM board_sprints WHERE id=$1 AND project_id=$2', [t.sprint_id, t.project_id]);
    if (!s.rows.length) return 'El sprint no pertenece a ese proyecto';
  }
  if (t.parent_id) {
    if (selfId && Number(t.parent_id) === Number(selfId)) return 'Una tarea no puede ser subtarea de sí misma';
    const p = await db.query('SELECT project_id, parent_id FROM board_tasks WHERE id=$1', [t.parent_id]);
    if (!p.rows.length) return 'La tarea principal no existe';
    if (p.rows[0].project_id !== t.project_id) return 'La tarea principal es de otro proyecto';
    if (p.rows[0].parent_id) return 'No se puede anidar una subtarea dentro de otra subtarea';
  }
  return null;
}

async function nombreAsignado(assignee_id) {
  if (!assignee_id) return null;
  const r = await db.query('SELECT name FROM users WHERE id = $1', [assignee_id]);
  return r.rows.length ? firstName(r.rows[0].name) : null;
}

/* ---- Turingcoins por cumplimiento de fechas ---- */

// ajusta el saldo del usuario + registra transacción + notificación
async function ajustarTuringcoins(userId, delta, tipo, descripcion, notifTitulo, notifMensaje) {
  await db.query(
    'UPDATE users SET credits = credits + $1, handycoins = credits + $1, updated_at = NOW() WHERE id = $2',
    [delta, userId]
  );
  await db.query(
    `INSERT INTO credit_transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)`,
    [userId, delta, tipo, descripcion]
  );
  await db.query(
    `INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)`,
    [userId, notifTitulo, notifMensaje, delta >= 0 ? 'reward' : 'penalty']
  );
}

// Aplica las reglas de turingcoins dada la tarea ANTES del cambio (old) y los valores nuevos.
//   +COIN_PREMIO  : la tarea pasa a "Finalizada" en o antes de fecha_fin (una sola vez, marca recompensa_dada)
//   -COIN_CASTIGO : se mueve fecha_fin a una posterior sin haber finalizado (cada vez)
// Solo aplica a tareas con responsable + fecha inicio + fecha fin.
async function reglaTuringcoins(old, nuevoEstado, nuevaFechaFin) {
  if (!old || !old.assignee_id || !old.fecha || !old.fecha_fin) return;
  const finPrevio = soloFecha(old.fecha_fin);
  const finNuevo = nuevaFechaFin ? soloFecha(nuevaFechaFin) : finPrevio;
  const eraFinal = old.estado === ESTADO_FINAL;
  const esFinal = nuevoEstado === ESTADO_FINAL;

  if (esFinal && !eraFinal && !old.recompensa_dada && hoyISO() <= finNuevo) {
    await ajustarTuringcoins(
      old.assignee_id, COIN_PREMIO, 'reward',
      `Reto cumplido: ${old.titulo}`,
      'Reto cumplido 🎉',
      `Terminaste "${old.titulo}" en fecha. Ganaste +${COIN_PREMIO} Turingcoins.`
    );
    await db.query('UPDATE board_tasks SET recompensa_dada = true WHERE id = $1', [old.id]);
  }

  if (finNuevo > finPrevio && !esFinal && !eraFinal) {
    await ajustarTuringcoins(
      old.assignee_id, -COIN_CASTIGO, 'penalty',
      `Extensión de fecha: ${old.titulo}`,
      'No lo lograste a tiempo',
      `Se movió la fecha de fin de "${old.titulo}". Perdiste -${COIN_CASTIGO} Turingcoins.`
    );
  }
}

// trae la tarea con todo lo que necesita reglaTuringcoins
async function tareaParaRegla(id) {
  const r = await db.query(
    'SELECT id, titulo, estado, fecha, fecha_fin, assignee_id, recompensa_dada, project_id, sprint_id FROM board_tasks WHERE id = $1',
    [id]
  );
  return r.rows[0] || null;
}

// siguiente orden dentro del bucket (proyecto + sprint + estado)
async function siguienteOrden(project_id, sprint_id, estado) {
  const r = await db.query(
    `SELECT COALESCE(MAX(orden), 0) + 1 AS n FROM board_tasks
     WHERE project_id = $1 AND sprint_id IS NOT DISTINCT FROM $2 AND estado = $3`,
    [project_id, sprint_id, estado]
  );
  return r.rows[0].n;
}

// POST /api/board/tasks
router.post('/tasks', async (req, res) => {
  try {
    const t = cleanTask(req.body);
    if (!t.titulo) return res.status(400).json({ error: 'El título es obligatorio' });
    const err = await validarTarea(req, t);
    if (err) return res.status(400).json({ error: err });

    // una subtarea hereda el sprint de la tarea principal
    if (t.parent_id) {
      const p = await db.query('SELECT sprint_id FROM board_tasks WHERE id = $1', [t.parent_id]);
      if (p.rows.length) t.sprint_id = p.rows[0].sprint_id;
    }

    const ord = await siguienteOrden(t.project_id, t.sprint_id, t.estado);
    const resp = await nombreAsignado(t.assignee_id);
    const result = await db.query(
      `INSERT INTO board_tasks
         (titulo, project_id, assignee_id, responsable, sprint_id, parent_id, tipo, estado, prioridad, fecha, fecha_fin, horas, puntos, observaciones, orden, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
      [t.titulo, t.project_id, t.assignee_id, resp, t.sprint_id, t.parent_id, t.tipo, t.estado, t.prioridad,
       t.fecha, t.fecha_fin, t.horas, t.puntos, t.observaciones, ord, req.user.id]
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
    const old = await tareaParaRegla(req.params.id);
    if (!old) return res.status(404).json({ error: 'Tarea no encontrada' });
    if (!(await puedeProyecto(req, old.project_id))) return res.status(403).json({ error: 'No perteneces a ese proyecto' });

    const t = cleanTask(req.body);
    if (!t.titulo) return res.status(400).json({ error: 'El título es obligatorio' });
    const err = await validarTarea(req, t, req.params.id);
    if (err) return res.status(400).json({ error: err });

    const resp = await nombreAsignado(t.assignee_id);
    const result = await db.query(
      `UPDATE board_tasks SET titulo=$1, project_id=$2, assignee_id=$3, responsable=$4, sprint_id=$5, parent_id=$6, tipo=$7, estado=$8,
              prioridad=$9, fecha=$10, fecha_fin=$11, horas=$12, puntos=$13, observaciones=$14, updated_at=NOW()
       WHERE id=$15 RETURNING id`,
      [t.titulo, t.project_id, t.assignee_id, resp, t.sprint_id, t.parent_id, t.tipo, t.estado, t.prioridad,
       t.fecha, t.fecha_fin, t.horas, t.puntos, t.observaciones, req.params.id]
    );

    await reglaTuringcoins(old, t.estado, t.fecha_fin);

    res.json({ id: result.rows[0].id });
  } catch (err) {
    console.error('Error actualizando board task:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PATCH /api/board/tasks/:id/estado  -> mover de columna (compat.: sin reordenar la lista)
router.patch('/tasks/:id/estado', async (req, res) => {
  try {
    const estado = ESTADOS.includes(req.body.estado) ? req.body.estado : null;
    if (!estado) return res.status(400).json({ error: 'Estado no válido' });
    const old = await tareaParaRegla(req.params.id);
    if (!old) return res.status(404).json({ error: 'Tarea no encontrada' });
    if (!(await puedeProyecto(req, old.project_id))) return res.status(403).json({ error: 'No perteneces a ese proyecto' });

    const ord = await siguienteOrden(old.project_id, old.sprint_id, estado);
    await db.query('UPDATE board_tasks SET estado=$1, orden=$2, updated_at=NOW() WHERE id=$3', [estado, ord, req.params.id]);
    await reglaTuringcoins(old, estado, old.fecha_fin);
    res.json({ id: Number(req.params.id), estado });
  } catch (err) {
    console.error('Error moviendo board task:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PATCH /api/board/tasks/:id/mover  -> mueve la tarea a (sprint_id, estado) y reordena el bucket destino
// body: { sprint_id: number|null, estado: string, orden_ids: number[] }  (orden_ids = todas las tarjetas del destino, en orden final)
router.patch('/tasks/:id/mover', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const old = await tareaParaRegla(id);
    if (!old) return res.status(404).json({ error: 'Tarea no encontrada' });
    const projectId = old.project_id;
    if (!(await puedeProyecto(req, projectId))) return res.status(403).json({ error: 'No perteneces a ese proyecto' });

    const estado = ESTADOS.includes(req.body.estado) ? req.body.estado : null;
    if (!estado) return res.status(400).json({ error: 'Estado no válido' });

    let sprint_id = req.body.sprint_id ? Number(req.body.sprint_id) : null;
    if (sprint_id) {
      const s = await db.query('SELECT 1 FROM board_sprints WHERE id=$1 AND project_id=$2', [sprint_id, projectId]);
      if (!s.rows.length) return res.status(400).json({ error: 'El sprint no pertenece a ese proyecto' });
    }

    const ordenIds = Array.isArray(req.body.orden_ids) ? req.body.orden_ids.map(Number).filter(Boolean) : [];

    await db.query('BEGIN');
    if (ordenIds.length > 1) {
      // reordenamiento explícito de todo el bucket destino
      if (ordenIds.indexOf(id) === -1) ordenIds.push(id);
      await db.query(
        'UPDATE board_tasks SET sprint_id = $1, estado = $2, updated_at = NOW() WHERE id = $3',
        [sprint_id, estado, id]
      );
      const posiciones = ordenIds.map((_, i) => i + 1);
      // reordena solo tarjetas del mismo proyecto (defensa ante ids ajenos)
      await db.query(
        `UPDATE board_tasks AS bt
         SET orden = v.ord, updated_at = NOW()
         FROM (SELECT * FROM unnest($1::int[], $2::int[]) AS x(tid, ord)) v
         WHERE bt.id = v.tid AND bt.project_id = $3`,
        [ordenIds, posiciones, projectId]
      );
    } else {
      // mover simple: al final del bucket destino
      const ord = await siguienteOrden(projectId, sprint_id, estado);
      await db.query(
        'UPDATE board_tasks SET sprint_id = $1, estado = $2, orden = $3, updated_at = NOW() WHERE id = $4',
        [sprint_id, estado, ord, id]
      );
    }
    await db.query('COMMIT');
    await reglaTuringcoins(old, estado, old.fecha_fin);
    res.json({ id, sprint_id, estado });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Error moviendo board task (mover):', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/board/tasks/:id  (borra también subtareas y adjuntos en disco)
router.delete('/tasks/:id', async (req, res) => {
  try {
    const cur = await db.query('SELECT project_id FROM board_tasks WHERE id = $1', [req.params.id]);
    if (!cur.rows.length) return res.status(404).json({ error: 'Tarea no encontrada' });
    if (!(await puedeProyecto(req, cur.rows[0].project_id))) return res.status(403).json({ error: 'No perteneces a ese proyecto' });

    // CASCADE borra subtareas y sus adjuntos
    await db.query('DELETE FROM board_tasks WHERE id = $1', [req.params.id]);
    res.json({ message: 'Tarea eliminada' });
  } catch (err) {
    console.error('Error eliminando board task:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* ===================== ADJUNTOS DE TAREAS ===================== */

async function tareaConProyecto(id) {
  const r = await db.query('SELECT id, project_id FROM board_tasks WHERE id = $1', [id]);
  return r.rows[0] || null;
}

// GET /api/board/tasks/:id/files  -> incluye el data URL para render directo
router.get('/tasks/:id/files', async (req, res) => {
  try {
    const t = await tareaConProyecto(req.params.id);
    if (!t) return res.status(404).json({ error: 'Tarea no encontrada' });
    if (!(await puedeProyecto(req, t.project_id))) return res.status(403).json({ error: 'No perteneces a ese proyecto' });
    const files = (await db.query(
      `SELECT f.id, f.nombre, f.mime, f.tamano, f.data, f.created_at, u.name AS subido_por
       FROM board_task_files f LEFT JOIN users u ON u.id = f.uploaded_by
       WHERE f.task_id = $1 ORDER BY f.created_at`, [req.params.id]
    )).rows;
    res.json({ files });
  } catch (err) {
    console.error('Error listando adjuntos:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/board/tasks/:id/files   body: { nombre, data }  (data = data URL base64)
router.post('/tasks/:id/files', async (req, res) => {
  try {
    const t = await tareaConProyecto(req.params.id);
    if (!t) return res.status(404).json({ error: 'Tarea no encontrada' });
    if (!(await puedeProyecto(req, t.project_id))) return res.status(403).json({ error: 'No perteneces a ese proyecto' });

    const nombre = req.body.nombre;
    const data = String(req.body.data || '');
    const m = data.match(/^data:([^;]+);base64,(.*)$/s);
    if (!m) return res.status(400).json({ error: 'Formato de archivo inválido' });
    const mime = m[1].toLowerCase();
    if (!FILE_MIMES.includes(mime)) {
      return res.status(400).json({ error: 'Solo se permiten imágenes (PNG, JPG, WEBP, GIF) o PDF' });
    }
    const bytes = Buffer.byteLength(m[2], 'base64');
    if (!bytes) return res.status(400).json({ error: 'Archivo vacío o inválido' });
    if (bytes > FILE_MAX) return res.status(400).json({ error: 'El archivo supera los 5 MB' });

    const row = (await db.query(
      `INSERT INTO board_task_files (task_id, nombre, mime, tamano, data, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, nombre, mime, tamano, data, created_at`,
      [t.id, String(nombre || 'adjunto').slice(0, 255), mime, bytes, data, req.user.id]
    )).rows[0];
    res.status(201).json({ file: row });
  } catch (err) {
    console.error('Error subiendo adjunto:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/board/files/:id
router.delete('/files/:id', async (req, res) => {
  try {
    const f = (await db.query(
      `SELECT f.id, t.project_id
       FROM board_task_files f JOIN board_tasks t ON t.id = f.task_id
       WHERE f.id = $1`, [req.params.id]
    )).rows[0];
    if (!f) return res.status(404).json({ error: 'Adjunto no encontrado' });
    if (!(await puedeProyecto(req, f.project_id))) return res.status(403).json({ error: 'Sin acceso' });
    await db.query('DELETE FROM board_task_files WHERE id = $1', [req.params.id]);
    res.json({ message: 'Adjunto eliminado' });
  } catch (err) {
    console.error('Error eliminando adjunto:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
