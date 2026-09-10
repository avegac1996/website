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

// Pipeline comercial (CRM) — resultados fijos; estados y tipos vienen de la BD (catálogo editable)
const INTER_RESULTADOS = ['contacto', 'no_contesto', 'agendo', 'propuesta', 'descartado', 'otro'];
const BOARD_ESTADOS = ['Tareas por hacer', 'En curso', 'Client Review', 'Control de calidad', 'Finalizada', 'Bloqueado'];
const slugify = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30);

async function estadosActivos() {
  return (await db.query('SELECT slug, label, color, board_estado, orden FROM prospecto_estados WHERE activo = true ORDER BY orden, id')).rows;
}
async function tiposActivos() {
  return (await db.query('SELECT slug, label, icono, orden FROM prospecto_tipos_interaccion WHERE activo = true ORDER BY orden, id')).rows;
}
async function boardEstadoDe(slug) {
  const r = await db.query('SELECT board_estado FROM prospecto_estados WHERE slug = $1', [slug]);
  return r.rows.length ? r.rows[0].board_estado : 'En curso';
}

// Solo colaboradores TURINGTECH y admins
router.use(authMiddleware, (req, res, next) => {
  if (req.user.role === 'admin' || req.user.account_type === 'colaborador') return next();
  return res.status(403).json({ error: 'Acceso solo para colaboradores TURINGTECH' });
});
const isAdmin = (req) => req.user.role === 'admin';

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
      meta: {
        estados: await estadosActivos(),
        tipos: await tiposActivos(),
        resultados: INTER_RESULTADOS,
        colaboradores,
      },
    });
  } catch (err) {
    console.error('Error en prospectos list:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PATCH /api/prospectos/:id/estado
router.patch('/:id/estado', async (req, res) => {
  try {
    const e = (await db.query('SELECT slug, board_estado FROM prospecto_estados WHERE slug = $1 AND activo = true', [req.body.estado])).rows[0];
    if (!e) return res.status(400).json({ error: 'Estado no válido' });
    const cur = (await db.query('SELECT id, task_id FROM prospectos WHERE id = $1', [req.params.id])).rows[0];
    if (!cur) return res.status(404).json({ error: 'Prospecto no encontrado' });

    await db.query('UPDATE prospectos SET estado = $1 WHERE id = $2', [e.slug, req.params.id]);
    if (cur.task_id) {
      await db.query('UPDATE board_tasks SET estado = $1, updated_at = NOW() WHERE id = $2', [e.board_estado, cur.task_id]);
    }
    res.json({ id: Number(req.params.id), estado: e.slug });
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
    const tv = (await db.query('SELECT slug FROM prospecto_tipos_interaccion WHERE slug = $1 AND activo = true', [req.body.tipo])).rows[0];
    const tipo = tv ? tv.slug : 'nota';
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

    const pid = await turingtechProjectId(req.user.id);
    let responsable = null;
    if (p.owner_id) {
      const u = await db.query('SELECT name FROM users WHERE id = $1', [p.owner_id]);
      responsable = u.rows.length ? String(u.rows[0].name).trim().split(/\s+/)[0] : null;
      // el responsable tiene que ser miembro del proyecto Turingtech
      await db.query(
        'INSERT INTO board_project_members (project_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [pid, p.owner_id]
      );
    }
    const contacto = [p.contacto_nombre, p.contacto_apellido].filter(Boolean).join(' ');
    const obs = [
      p.sector_nombre ? 'Sector: ' + p.sector_nombre : null,
      contacto ? 'Contacto: ' + contacto + (p.cargo ? ' (' + p.cargo + ')' : '') : null,
      p.telefono ? 'Tel: ' + p.telefono : null,
      p.email ? 'Email: ' + p.email : null,
      p.pilar ? 'Pilar: ' + p.pilar : null,
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
      ['Prospecto: ' + p.empresa, pid, p.owner_id, responsable, estado, hoy, obs, ord, req.user.id]
    )).rows[0];

    await db.query('UPDATE prospectos SET task_id = $1 WHERE id = $2', [t.id, req.params.id]);
    res.status(201).json({ task_id: t.id, project_id: pid, proyecto: 'Turingtech' });
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

/* ===================== CATÁLOGO CONFIGURABLE (estados / tipos) ===================== */

const requiereAdmin = (req, res, next) => (isAdmin(req) ? next() : res.status(403).json({ error: 'Solo un administrador' }));

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
router.post('/catalogo/estados', requiereAdmin, async (req, res) => {
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
    const orden = Number(req.body.orden) || (await db.query('SELECT COALESCE(MAX(orden),0)+1 n FROM prospecto_estados')).rows[0].n;
    const row = (await db.query(
      'INSERT INTO prospecto_estados (slug,label,color,board_estado,orden) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [slug, label, color, board_estado, orden]
    )).rows[0];
    res.status(201).json({ estado: row });
  } catch (err) {
    console.error('Error creando estado:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.put('/catalogo/estados/:eid', requiereAdmin, async (req, res) => {
  try {
    const label = String(req.body.label || '').trim();
    if (!label) return res.status(400).json({ error: 'El nombre es obligatorio' });
    const color = /^#[0-9a-fA-F]{6}$/.test(req.body.color) ? req.body.color : '#94a3b8';
    const board_estado = BOARD_ESTADOS.includes(req.body.board_estado) ? req.body.board_estado : 'En curso';
    const row = (await db.query(
      'UPDATE prospecto_estados SET label=$1,color=$2,board_estado=$3,activo=$4,orden=$5 WHERE id=$6 RETURNING *',
      [label, color, board_estado, req.body.activo !== false, limpiarOrden(req.body.orden), req.params.eid]
    )).rows[0];
    if (!row) return res.status(404).json({ error: 'Estado no encontrado' });
    res.json({ estado: row });
  } catch (err) {
    console.error('Error actualizando estado:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/catalogo/estados/:eid', requiereAdmin, async (req, res) => {
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
router.post('/catalogo/tipos', requiereAdmin, async (req, res) => {
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

router.put('/catalogo/tipos/:tid', requiereAdmin, async (req, res) => {
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

router.delete('/catalogo/tipos/:tid', requiereAdmin, async (req, res) => {
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
