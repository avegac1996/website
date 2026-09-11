// Puente entre el dominio de Prospectos y el de Board: crea/localiza la tarea
// de tablero correspondiente a un prospecto. Vive del lado de board porque
// escribe en tablas de board (board_projects, board_project_members, board_tasks);
// prospectos/convertir-tarea.routes.js llama a esto en vez de escribir esas
// tablas directamente.
const db = require('../../config/database');

// proyecto "Turingtech" del tablero (lo crea si no existe, con todos los colaboradores).
// Las tareas nacidas de un prospecto son trabajo de Turingtech y van a su cronograma.
async function turingtechProjectId(createdBy) {
  const r = await db.query("SELECT id FROM board_projects WHERE nombre ILIKE 'turingtech'");
  let pid;
  if (r.rows.length) {
    pid = r.rows[0].id;
  } else {
    const p = await db.query(
      "INSERT INTO board_projects (nombre, descripcion, created_by) VALUES ('Turingtech', 'Operación y proyectos internos de Turingtech', $1) RETURNING id",
      [createdBy]
    );
    pid = p.rows[0].id;
  }
  await db.query(
    "INSERT INTO board_project_members (project_id, user_id) SELECT $1, id FROM users WHERE account_type = 'colaborador' AND active = true ON CONFLICT DO NOTHING",
    [pid]
  );
  return pid;
}

// ¿ya existe la tarea de board asociada a un prospecto? (id guardado en prospectos.task_id)
async function tareaBoardExiste(taskId) {
  if (!taskId) return null;
  const r = await db.query('SELECT id, project_id FROM board_tasks WHERE id = $1', [taskId]);
  return r.rows[0] || null;
}

// Crea, en el tablero de Turingtech, la tarea correspondiente a un prospecto.
async function crearTareaDesdeProspecto(prospecto, createdBy) {
  const pid = await turingtechProjectId(createdBy);
  let responsable = null;
  if (prospecto.owner_id) {
    const u = await db.query('SELECT name FROM users WHERE id = $1', [prospecto.owner_id]);
    responsable = u.rows.length ? String(u.rows[0].name).trim().split(/\s+/)[0] : null;
    // el responsable tiene que ser miembro del proyecto Turingtech
    await db.query(
      'INSERT INTO board_project_members (project_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [pid, prospecto.owner_id]
    );
  }
  const contacto = [prospecto.contacto_nombre, prospecto.contacto_apellido].filter(Boolean).join(' ');
  const obs = [
    prospecto.sector_nombre ? 'Sector: ' + prospecto.sector_nombre : null,
    contacto ? 'Contacto: ' + contacto + (prospecto.cargo ? ' (' + prospecto.cargo + ')' : '') : null,
    prospecto.telefono ? 'Tel: ' + prospecto.telefono : null,
    prospecto.email ? 'Email: ' + prospecto.email : null,
    prospecto.pilar ? 'Pilar: ' + prospecto.pilar : null,
  ].filter(Boolean).join('\n');
  // arranca "En curso": es trabajo de Turingtech con responsable asignado
  const estado = 'En curso';
  const hoy = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);

  const ord = (await db.query(
    "SELECT COALESCE(MAX(orden),0)+1 AS n FROM board_tasks WHERE project_id = $1 AND sprint_id IS NULL AND estado = $2",
    [pid, estado]
  )).rows[0].n;

  const t = (await db.query(
    `INSERT INTO board_tasks (titulo, project_id, assignee_id, responsable, tipo, estado, prioridad, fecha, observaciones, orden, created_by)
     VALUES ($1,$2,$3,$4,'Tarea',$5,'media',$6,$7,$8,$9) RETURNING id`,
    ['Prospecto: ' + prospecto.empresa, pid, prospecto.owner_id, responsable, estado, hoy, obs, ord, createdBy]
  )).rows[0];

  return { taskId: t.id, projectId: pid };
}

module.exports = { crearTareaDesdeProspecto, tareaBoardExiste };
