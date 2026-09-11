const express = require('express');
const db = require('../../config/database');
const J = require('../../utils/jornada');
const { ESTADOS, TIPOS, PRIORIDADES, ESTADO_FINAL } = require('./constants');
const { firstName, hoyISO, soloFecha, isAdmin, puedeProyecto, proyectosVisibles } = require('./helpers');
const { reglaTuringcoins, tareaParaRegla } = require('./turingcoins');
const { asegurarSprintsSemanales } = require('./auto-sprint');

const router = express.Router();

/* ===================== TAREAS ===================== */

// GET /api/board/tasks  -> tareas de los proyectos visibles + meta
router.get('/tasks', async (req, res) => {
  try {
    await asegurarSprintsSemanales();

    const ids = await proyectosVisibles(req);
    const admin = isAdmin(req);
    // no-admin: solo sus tareas (asignadas a él o sin asignar). admin: todas.
    const filtroMio = admin ? '' : ' AND (t.assignee_id = $2 OR t.assignee_id IS NULL)';
    const params = admin ? [ids] : [ids, req.user.id];
    const rows = ids.length
      ? (await db.query(
          `SELECT t.id, t.titulo, t.tipo, t.estado, t.fecha, t.fecha_fin, t.horas, t.observaciones, t.orden,
                  t.project_id, bp.nombre AS proyecto, t.assignee_id, t.sprint_id, t.puntos, t.prioridad,
                  t.parent_id, t.recompensa_dada, t.recompensa_revertida, t.en_backlog,
                  t.fecha_fin_set_at,
                  (t.fecha_fin IS NOT NULL AND t.fecha_fin_set_at IS NOT NULL
                     AND t.fecha_fin_set_at < NOW() - INTERVAL '24 hours') AS fin_bloqueada,
                  u.name AS assignee_nombre, COALESCE(t.responsable, split_part(u.name,' ',1)) AS responsable,
                  (SELECT COUNT(*) FROM board_task_files f WHERE f.task_id = t.id)::int AS files_count,
                  t.created_at, t.updated_at
           FROM board_tasks t
           LEFT JOIN board_projects bp ON bp.id = t.project_id
           LEFT JOIN users u ON u.id = t.assignee_id
           WHERE t.project_id = ANY($1)${filtroMio}
           ORDER BY bp.nombre NULLS LAST, t.orden, t.id`, params)).rows
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
        isAdmin: admin,
        miId: req.user.id,
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

// GET /api/board/resumen  -> dashboard de Proyecto (quién trabajó, tareas, timbrado). Solo admin.
router.get('/resumen', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Solo administradores' });
    const hoy = hoyISO();
    const lunes = J.lunesDeSemana(hoy);

    const proyectos = (await db.query(
      `SELECT bp.nombre AS proyecto,
              count(*) FILTER (WHERE t.estado <> 'Finalizada')::int AS abiertas,
              count(*) FILTER (WHERE t.fecha_fin < $1::date AND t.estado <> 'Finalizada')::int AS atrasadas,
              count(*) FILTER (WHERE t.estado = 'Finalizada')::int AS finalizadas
       FROM board_tasks t JOIN board_projects bp ON bp.id = t.project_id
       WHERE t.parent_id IS NULL
       GROUP BY bp.nombre ORDER BY abiertas DESC`, [hoy]
    )).rows;

    const porResponsable = (await db.query(
      `SELECT COALESCE(t.responsable, split_part(u.name,' ',1)) AS responsable,
              count(*) FILTER (WHERE t.estado <> 'Finalizada')::int AS abiertas,
              count(*) FILTER (WHERE t.estado = 'En curso')::int AS en_curso,
              count(*) FILTER (WHERE t.fecha_fin < $1::date AND t.estado <> 'Finalizada')::int AS atrasadas,
              count(*) FILTER (WHERE t.estado = 'Finalizada' AND t.updated_at >= NOW() - interval '7 days')::int AS finalizadas_7d
       FROM board_tasks t LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.parent_id IS NULL
       GROUP BY 1 ORDER BY abiertas DESC NULLS LAST`, [hoy]
    )).rows.filter((r) => r.responsable);

    const tareasAtrasadas = (await db.query(
      `SELECT t.id, t.titulo, t.fecha_fin, t.estado, COALESCE(t.responsable, split_part(u.name,' ',1)) AS responsable, bp.nombre AS proyecto
       FROM board_tasks t LEFT JOIN users u ON u.id = t.assignee_id LEFT JOIN board_projects bp ON bp.id = t.project_id
       WHERE t.parent_id IS NULL AND t.fecha_fin < $1::date AND t.estado <> 'Finalizada'
       ORDER BY t.fecha_fin ASC LIMIT 25`, [hoy]
    )).rows;

    // timbrado de la semana + "trabajó hoy?"
    const users = (await db.query(
      "SELECT id, name, position FROM users WHERE account_type = 'colaborador' AND active = true ORDER BY name"
    )).rows;
    const marcas = (await db.query(
      'SELECT user_id, tipo, ts, dia FROM time_entries WHERE dia BETWEEN $1 AND $2 ORDER BY dia, ts, id', [lunes, hoy]
    )).rows;
    const porU = {};
    marcas.forEach((e) => { (porU[e.user_id] = porU[e.user_id] || []).push(e); });
    const equipo = users.map((u) => {
      const r = J.resumenRango(porU[u.id] || [], lunes, hoy);
      const hoyMarcas = (porU[u.id] || []).filter((m) => String(m.dia).slice(0, 10) === hoy);
      return {
        user_id: u.id, name: u.name, position: u.position || null,
        total_min: r.total_min, total_horas: r.total_horas, dias: r.dias_con_marca,
        trabajo_hoy: hoyMarcas.length > 0,
      };
    });

    res.json({ hoy, semana_desde: lunes, proyectos, por_responsable: porResponsable, tareas_atrasadas: tareasAtrasadas, equipo });
  } catch (err) {
    console.error('Error en board/resumen:', err.message);
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
         (titulo, project_id, assignee_id, responsable, sprint_id, parent_id, tipo, estado, prioridad, fecha, fecha_fin, horas, puntos, observaciones, orden, created_by, fecha_fin_set_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, CASE WHEN $11::date IS NOT NULL THEN NOW() ELSE NULL END) RETURNING id`,
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
    // en_backlog: si se le asigna sprint -> false; si se le QUITA el sprint a propósito -> true; si no, sin cambio
    let enBacklogSql = 'en_backlog';
    if (t.sprint_id) enBacklogSql = 'false';
    else if (old.sprint_id && !t.sprint_id && !t.parent_id) enBacklogSql = 'true';

    // --- Candado de la fecha de Fin -----------------------------------------
    // Se corrige libremente durante 24 h desde que se fijó. Después queda
    // bloqueada: para cambiarla hay que reabrir la tarea (sacarla de "Finalizada"),
    // lo que ya descuenta 1 Turingcoin. Los admins pueden cambiarla siempre.
    const finPrev = soloFecha(old.fecha_fin);
    const finNew = soloFecha(t.fecha_fin);
    const reabriendo = old.estado === ESTADO_FINAL && t.estado !== ESTADO_FINAL;
    let finSetAtSql = 'fecha_fin_set_at';
    if (finPrev !== finNew) {
      if (!finPrev) {
        finSetAtSql = 'NOW()';
      } else {
        const selladoMs = old.fecha_fin_set_at ? new Date(old.fecha_fin_set_at).getTime() : 0;
        const dentroVentana = selladoMs && (Date.now() - selladoMs) <= 24 * 3600 * 1000;
        if (!dentroVentana && !isAdmin(req) && !reabriendo) {
          return res.status(423).json({
            code: 'FIN_LOCKED',
            error: 'La fecha de Fin está bloqueada: pasaron más de 24 h desde que se fijó. Para cambiarla, reabrí la tarea (pasala a "En curso" — eso descuenta 1 Turingcoin) y luego editá la fecha.',
          });
        }
        finSetAtSql = 'NOW()';
      }
    } else if (reabriendo && finPrev) {
      finSetAtSql = 'NOW()';   // al reabrir, la fecha de Fin vuelve a ser editable 24 h
    }

    const result = await db.query(
      `UPDATE board_tasks SET titulo=$1, project_id=$2, assignee_id=$3, responsable=$4, sprint_id=$5, parent_id=$6, tipo=$7, estado=$8,
              prioridad=$9, fecha=$10, fecha_fin=$11, horas=$12, puntos=$13, observaciones=$14, en_backlog=${enBacklogSql},
              fecha_fin_set_at=${finSetAtSql}, updated_at=NOW()
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
    // al reabrir una tarea finalizada, su fecha de Fin vuelve a ser editable 24 h
    const reabreFinSql = (old.estado === ESTADO_FINAL && estado !== ESTADO_FINAL && old.fecha_fin)
      ? ', fecha_fin_set_at=NOW()' : '';
    await db.query(`UPDATE board_tasks SET estado=$1, orden=$2, updated_at=NOW()${reabreFinSql} WHERE id=$3`, [estado, ord, req.params.id]);
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

    // mover a un sprint -> vuelve al flujo automático; sacar a backlog -> queda fija ahí
    const enBacklog = !sprint_id;
    await db.query('BEGIN');
    if (ordenIds.length > 1) {
      if (ordenIds.indexOf(id) === -1) ordenIds.push(id);
      await db.query(
        'UPDATE board_tasks SET sprint_id = $1, estado = $2, en_backlog = $3, updated_at = NOW() WHERE id = $4',
        [sprint_id, estado, enBacklog, id]
      );
      const posiciones = ordenIds.map((_, i) => i + 1);
      await db.query(
        `UPDATE board_tasks AS bt
         SET orden = v.ord, updated_at = NOW()
         FROM (SELECT * FROM unnest($1::int[], $2::int[]) AS x(tid, ord)) v
         WHERE bt.id = v.tid AND bt.project_id = $3`,
        [ordenIds, posiciones, projectId]
      );
    } else {
      const ord = await siguienteOrden(projectId, sprint_id, estado);
      await db.query(
        'UPDATE board_tasks SET sprint_id = $1, estado = $2, orden = $3, en_backlog = $4, updated_at = NOW() WHERE id = $5',
        [sprint_id, estado, ord, enBacklog, id]
      );
    }
    // las subtareas siguen a su tarea principal
    await db.query('UPDATE board_tasks SET sprint_id = $1, en_backlog = $2, updated_at = NOW() WHERE parent_id = $3', [sprint_id, enBacklog, id]);
    // al reabrir una tarea finalizada, su fecha de Fin vuelve a ser editable 24 h
    if (old.estado === ESTADO_FINAL && estado !== ESTADO_FINAL && old.fecha_fin) {
      await db.query('UPDATE board_tasks SET fecha_fin_set_at = NOW() WHERE id = $1', [id]);
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

module.exports = router;
