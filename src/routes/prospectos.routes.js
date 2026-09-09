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

// Pipeline comercial (CRM)
const ESTADOS = ['nuevo', 'contactado', 'en_seguimiento', 'reunion', 'propuesta', 'ganado', 'perdido', 'no_responde'];
const INTER_TIPOS = ['llamada', 'email', 'whatsapp', 'reunion', 'nota'];
const INTER_RESULTADOS = ['contacto', 'no_contesto', 'agendo', 'propuesta', 'descartado', 'otro'];
// estado del prospecto -> estado de la tarea del tablero
const ESTADO_A_BOARD = {
  nuevo: 'Tareas por hacer',
  contactado: 'En curso', en_seguimiento: 'En curso', reunion: 'En curso', propuesta: 'En curso',
  ganado: 'Finalizada', perdido: 'Finalizada', no_responde: 'Finalizada',
};

// Solo colaboradores TURINGTECH y admins
router.use(authMiddleware, (req, res, next) => {
  if (req.user.role === 'admin' || req.user.account_type === 'colaborador') return next();
  return res.status(403).json({ error: 'Acceso solo para colaboradores TURINGTECH' });
});

// proyecto "Prospectos" del tablero (lo crea si no existe, con todos los colaboradores)
async function prospectosProjectId(createdBy) {
  const r = await db.query("SELECT id FROM board_projects WHERE nombre = 'Prospectos'");
  if (r.rows.length) return r.rows[0].id;
  const p = await db.query(
    "INSERT INTO board_projects (nombre, descripcion, created_by) VALUES ('Prospectos', 'Gestión comercial de prospectos B2B', $1) RETURNING id",
    [createdBy]
  );
  const pid = p.rows[0].id;
  await db.query(
    "INSERT INTO board_project_members (project_id, user_id) SELECT $1, id FROM users WHERE account_type = 'colaborador' AND active = true ON CONFLICT DO NOTHING",
    [pid]
  );
  return pid;
}

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
    const result = await db.query(
      `SELECT p.*, u.name AS owner_nombre,
              (SELECT max(created_at) FROM prospecto_interacciones i WHERE i.prospecto_id = p.id) AS ultima_gestion,
              (SELECT count(*) FROM prospecto_interacciones i WHERE i.prospecto_id = p.id)::int AS interacciones,
              t.estado AS task_estado, t.project_id AS task_project_id
       FROM prospectos p
       LEFT JOIN users u ON u.id = p.owner_id
       LEFT JOIN board_tasks t ON t.id = p.task_id
       ORDER BY p.ts DESC, p.id DESC`
    );
    const colaboradores = (await db.query(
      "SELECT id, name FROM users WHERE account_type = 'colaborador' AND active = true ORDER BY name"
    )).rows;
    res.json({
      prospectos: result.rows,
      total: result.rows.length,
      meta: { estados: ESTADOS, tipos: INTER_TIPOS, resultados: INTER_RESULTADOS, colaboradores },
    });
  } catch (err) {
    console.error('Error en prospectos list:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PATCH /api/prospectos/:id/estado
router.patch('/:id/estado', async (req, res) => {
  try {
    const estado = ESTADOS.includes(req.body.estado) ? req.body.estado : null;
    if (!estado) return res.status(400).json({ error: 'Estado no válido' });
    const cur = (await db.query('SELECT id, task_id FROM prospectos WHERE id = $1', [req.params.id])).rows[0];
    if (!cur) return res.status(404).json({ error: 'Prospecto no encontrado' });

    await db.query('UPDATE prospectos SET estado = $1 WHERE id = $2', [estado, req.params.id]);
    if (cur.task_id) {
      await db.query('UPDATE board_tasks SET estado = $1, updated_at = NOW() WHERE id = $2', [ESTADO_A_BOARD[estado], cur.task_id]);
    }
    res.json({ id: Number(req.params.id), estado });
  } catch (err) {
    console.error('Error cambiando estado de prospecto:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PATCH /api/prospectos/:id/owner
router.patch('/:id/owner', async (req, res) => {
  try {
    const owner_id = req.body.owner_id ? Number(req.body.owner_id) : null;
    const cur = (await db.query('SELECT id, task_id FROM prospectos WHERE id = $1', [req.params.id])).rows[0];
    if (!cur) return res.status(404).json({ error: 'Prospecto no encontrado' });
    if (owner_id) {
      const u = await db.query("SELECT 1 FROM users WHERE id = $1 AND account_type = 'colaborador' AND active = true", [owner_id]);
      if (!u.rows.length) return res.status(400).json({ error: 'Responsable no válido' });
    }
    await db.query('UPDATE prospectos SET owner_id = $1 WHERE id = $2', [owner_id, req.params.id]);
    if (cur.task_id) {
      const nombre = owner_id ? (await db.query('SELECT name FROM users WHERE id = $1', [owner_id])).rows[0].name : null;
      const primer = nombre ? String(nombre).trim().split(/\s+/)[0] : null;
      await db.query('UPDATE board_tasks SET assignee_id = $1, responsable = $2, updated_at = NOW() WHERE id = $3', [owner_id, primer, cur.task_id]);
    }
    res.json({ id: Number(req.params.id), owner_id });
  } catch (err) {
    console.error('Error asignando responsable:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/prospectos/:id/interacciones
router.get('/:id/interacciones', async (req, res) => {
  try {
    const rows = (await db.query(
      `SELECT i.id, i.tipo, i.resultado, i.nota, i.created_at, u.name AS usuario
       FROM prospecto_interacciones i LEFT JOIN users u ON u.id = i.user_id
       WHERE i.prospecto_id = $1 ORDER BY i.created_at DESC`, [req.params.id]
    )).rows;
    res.json({ interacciones: rows });
  } catch (err) {
    console.error('Error listando interacciones:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/prospectos/:id/interacciones   body: { tipo, resultado, nota }
router.post('/:id/interacciones', async (req, res) => {
  try {
    const cur = (await db.query('SELECT id FROM prospectos WHERE id = $1', [req.params.id])).rows[0];
    if (!cur) return res.status(404).json({ error: 'Prospecto no encontrado' });
    const tipo = INTER_TIPOS.includes(req.body.tipo) ? req.body.tipo : 'nota';
    const resultado = INTER_RESULTADOS.includes(req.body.resultado) ? req.body.resultado : null;
    const nota = req.body.nota ? String(req.body.nota).trim() : null;
    if (!nota && !resultado) return res.status(400).json({ error: 'Agrega una nota o un resultado' });

    const row = (await db.query(
      `INSERT INTO prospecto_interacciones (prospecto_id, tipo, resultado, nota, user_id)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, tipo, resultado, nota, created_at`,
      [req.params.id, tipo, resultado, nota, req.user.id]
    )).rows[0];
    res.status(201).json({ interaccion: row });
  } catch (err) {
    console.error('Error creando interacción:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/prospectos/:id/interacciones/:iid
router.delete('/:id/interacciones/:iid', async (req, res) => {
  try {
    const r = await db.query('DELETE FROM prospecto_interacciones WHERE id = $1 AND prospecto_id = $2 RETURNING id', [req.params.iid, req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Interacción no encontrada' });
    res.json({ message: 'Interacción eliminada' });
  } catch (err) {
    console.error('Error eliminando interacción:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/prospectos/:id/convertir-tarea  -> crea (o devuelve) la tarea del tablero
router.post('/:id/convertir-tarea', async (req, res) => {
  try {
    const p = (await db.query('SELECT * FROM prospectos WHERE id = $1', [req.params.id])).rows[0];
    if (!p) return res.status(404).json({ error: 'Prospecto no encontrado' });
    if (p.task_id) {
      const existe = await db.query('SELECT id, project_id FROM board_tasks WHERE id = $1', [p.task_id]);
      if (existe.rows.length) return res.json({ task_id: p.task_id, project_id: existe.rows[0].project_id, ya_existia: true });
    }

    const pid = await prospectosProjectId(req.user.id);
    let responsable = null;
    if (p.owner_id) {
      const u = await db.query('SELECT name FROM users WHERE id = $1', [p.owner_id]);
      responsable = u.rows.length ? String(u.rows[0].name).trim().split(/\s+/)[0] : null;
    }
    const contacto = [p.contacto_nombre, p.contacto_apellido].filter(Boolean).join(' ');
    const obs = [
      p.sector_nombre ? 'Sector: ' + p.sector_nombre : null,
      contacto ? 'Contacto: ' + contacto + (p.cargo ? ' (' + p.cargo + ')' : '') : null,
      p.telefono ? 'Tel: ' + p.telefono : null,
      p.email ? 'Email: ' + p.email : null,
      p.pilar ? 'Pilar: ' + p.pilar : null,
    ].filter(Boolean).join('\n');

    const ord = (await db.query(
      "SELECT COALESCE(MAX(orden),0)+1 AS n FROM board_tasks WHERE project_id = $1 AND sprint_id IS NULL AND estado = $2",
      [pid, ESTADO_A_BOARD[p.estado] || 'Tareas por hacer']
    )).rows[0].n;

    const t = (await db.query(
      `INSERT INTO board_tasks (titulo, project_id, assignee_id, responsable, tipo, estado, prioridad, observaciones, orden, created_by)
       VALUES ($1,$2,$3,$4,'Tarea',$5,'media',$6,$7,$8) RETURNING id`,
      ['Prospecto: ' + p.empresa, pid, p.owner_id, responsable, ESTADO_A_BOARD[p.estado] || 'Tareas por hacer', obs, ord, req.user.id]
    )).rows[0];

    await db.query('UPDATE prospectos SET task_id = $1 WHERE id = $2', [t.id, req.params.id]);
    res.status(201).json({ task_id: t.id, project_id: pid });
  } catch (err) {
    console.error('Error convirtiendo prospecto en tarea:', err.message);
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
