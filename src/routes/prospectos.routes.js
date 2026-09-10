const express = require('express');
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const J = require('../utils/jornada');

const router = express.Router();

// Adjuntos de interacciones (data URL en la BD, igual que board_task_files)
const FILE_MIMES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'application/pdf'];
const FILE_MAX = 5 * 1024 * 1024;   // 5 MB del binario decodificado
const FILE_MAX_COUNT = 8;

function parseDataUrl(data) {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(String(data || ''));
  if (!m) return null;
  const mime = m[1].toLowerCase();
  const bytes = m[2] ? Math.floor(m[3].length * 3 / 4) : m[3].length;
  return { mime, bytes };
}

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
const ACT_TIPOS = ['llamada', 'linkedin', 'whatsapp', 'reunion', 'otro'];
const KANBAN_COLS = ['por_prospectar', 'prospectando', 'exitoso', 'rechazado'];
const BOARD_ESTADOS = ['Tareas por hacer', 'En curso', 'Client Review', 'Control de calidad', 'Finalizada', 'Bloqueado'];
const slugify = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30);

async function estadosActivos() {
  return (await db.query('SELECT slug, label, color, board_estado, orden, kanban FROM prospecto_estados WHERE activo = true ORDER BY orden, id')).rows;
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
      `SELECT p.*, u.name AS owner_nombre, e.kanban,
              (SELECT max(created_at) FROM prospecto_interacciones i WHERE i.prospecto_id = p.id) AS ultima_gestion,
              (SELECT count(*) FROM prospecto_interacciones i WHERE i.prospecto_id = p.id)::int AS interacciones,
              (SELECT count(*) FROM prospecto_actividades a WHERE a.prospecto_id = p.id AND a.hecha = false)::int AS act_pendientes,
              (SELECT count(*) FROM prospecto_actividades a WHERE a.prospecto_id = p.id AND a.hecha = false AND a.deadline < (NOW() - interval '5 hours')::date)::int AS act_atrasadas,
              (SELECT min(deadline) FROM prospecto_actividades a WHERE a.prospecto_id = p.id AND a.hecha = false) AS act_proxima,
              t.estado AS task_estado, t.project_id AS task_project_id,
              t.titulo AS task_titulo, t.created_at AS task_created_at, t.fecha_fin AS task_fecha_fin
       FROM prospectos p
       LEFT JOIN users u ON u.id = p.owner_id
       LEFT JOIN prospecto_estados e ON e.slug = p.estado
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
        actividadTipos: ACT_TIPOS,
        kanban: [
          { id: 'por_prospectar', label: 'Por prospectar' },
          { id: 'prospectando', label: 'Prospectando' },
          { id: 'exitoso', label: 'Exitosos' },
          { id: 'rechazado', label: 'Rechazados' },
        ],
        colaboradores,
        esAdmin: isAdmin(req),
        miId: req.user.id,
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

// GET /api/prospectos/:id/interacciones  -> historial + adjuntos de cada interacción
router.get('/:id/interacciones', async (req, res) => {
  try {
    const rows = (await db.query(
      `SELECT i.id, i.tipo, i.resultado, i.nota, i.created_at, u.name AS usuario
       FROM prospecto_interacciones i LEFT JOIN users u ON u.id = i.user_id
       WHERE i.prospecto_id = $1 ORDER BY i.created_at DESC`, [req.params.id]
    )).rows;
    const ids = rows.map((r) => r.id);
    let files = [];
    if (ids.length) {
      files = (await db.query(
        'SELECT id, interaccion_id, nombre, mime, data FROM prospecto_interaccion_files WHERE interaccion_id = ANY($1) ORDER BY id',
        [ids]
      )).rows;
    }
    const byInter = {};
    files.forEach((f) => { (byInter[f.interaccion_id] = byInter[f.interaccion_id] || []).push(f); });
    rows.forEach((r) => { r.files = byInter[r.id] || []; });
    res.json({ interacciones: rows });
  } catch (err) {
    console.error('Error listando interacciones:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/prospectos/:id/interacciones   body: { tipo, resultado, nota, files:[{nombre,data}], proxima_gestion, proxima_gestion_nota }
router.post('/:id/interacciones', async (req, res) => {
  try {
    const cur = (await db.query('SELECT id FROM prospectos WHERE id = $1', [req.params.id])).rows[0];
    if (!cur) return res.status(404).json({ error: 'Prospecto no encontrado' });
    const tv = (await db.query('SELECT slug FROM prospecto_tipos_interaccion WHERE slug = $1 AND activo = true', [req.body.tipo])).rows[0];
    const tipo = tv ? tv.slug : 'nota';
    const resultado = INTER_RESULTADOS.includes(req.body.resultado) ? req.body.resultado : null;
    const nota = req.body.nota ? String(req.body.nota).trim() : null;

    const filesIn = Array.isArray(req.body.files) ? req.body.files.slice(0, FILE_MAX_COUNT) : [];
    if (!nota && !resultado && !filesIn.length) return res.status(400).json({ error: 'Agrega una nota, un resultado o una imagen' });
    for (const f of filesIn) {
      const info = parseDataUrl(f && f.data);
      if (!info || !FILE_MIMES.includes(info.mime)) return res.status(400).json({ error: 'Formato de archivo no admitido (imágenes o PDF)' });
      if (info.bytes > FILE_MAX) return res.status(400).json({ error: 'Cada archivo debe pesar máximo 5 MB' });
    }

    const row = (await db.query(
      `INSERT INTO prospecto_interacciones (prospecto_id, tipo, resultado, nota, user_id)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, tipo, resultado, nota, created_at`,
      [req.params.id, tipo, resultado, nota, req.user.id]
    )).rows[0];

    row.files = [];
    for (const f of filesIn) {
      const info = parseDataUrl(f.data);
      const fr = (await db.query(
        `INSERT INTO prospecto_interaccion_files (interaccion_id, nombre, mime, tamano, data, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, interaccion_id, nombre, mime, data`,
        [row.id, String(f.nombre || 'imagen.png').slice(0, 255), info.mime, info.bytes, f.data, req.user.id]
      )).rows[0];
      row.files.push(fr);
    }

    // fija la próxima gestión si vino en el mismo formulario
    const pg = /^\d{4}-\d{2}-\d{2}$/.test(req.body.proxima_gestion || '') ? req.body.proxima_gestion : null;
    if (pg || req.body.proxima_gestion === '') {
      await db.query('UPDATE prospectos SET proxima_gestion = $1, proxima_gestion_nota = $2 WHERE id = $3',
        [pg, req.body.proxima_gestion_nota ? String(req.body.proxima_gestion_nota).slice(0, 200) : null, req.params.id]);
    }

    res.status(201).json({ interaccion: row, proxima_gestion: pg });
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

// DELETE /api/prospectos/:id/interacciones/:iid/files/:fid  -> quita una imagen del historial
router.delete('/:id/interacciones/:iid/files/:fid', async (req, res) => {
  try {
    const r = await db.query(
      `DELETE FROM prospecto_interaccion_files f
       USING prospecto_interacciones i
       WHERE f.id = $1 AND f.interaccion_id = i.id AND i.id = $2 AND i.prospecto_id = $3 RETURNING f.id`,
      [req.params.fid, req.params.iid, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Adjunto no encontrado' });
    res.json({ message: 'Adjunto eliminado' });
  } catch (err) {
    console.error('Error eliminando adjunto de interacción:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PATCH /api/prospectos/:id/proxima-gestion  { proxima_gestion, nota }
router.patch('/:id/proxima-gestion', async (req, res) => {
  try {
    const cur = (await db.query('SELECT id FROM prospectos WHERE id = $1', [req.params.id])).rows[0];
    if (!cur) return res.status(404).json({ error: 'Prospecto no encontrado' });
    const pg = /^\d{4}-\d{2}-\d{2}$/.test(req.body.proxima_gestion || '') ? req.body.proxima_gestion : null;
    const nota = req.body.nota ? String(req.body.nota).slice(0, 200) : null;
    await db.query('UPDATE prospectos SET proxima_gestion = $1, proxima_gestion_nota = $2 WHERE id = $3', [pg, nota, req.params.id]);
    res.json({ id: Number(req.params.id), proxima_gestion: pg, proxima_gestion_nota: nota });
  } catch (err) {
    console.error('Error en proxima-gestion:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

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

// GET /api/prospectos/resumen  -> dashboard CRM (admin: todo; no-admin: solo lo suyo)
router.get('/resumen', async (req, res) => {
  try {
    const admin = isAdmin(req);
    const gestor = admin
      ? (req.query.gestor && /^\d+$/.test(req.query.gestor) ? Number(req.query.gestor) : null)
      : req.user.id;
    const hoy = J.hoyISO();
    const estados = await estadosActivos();
    const cerrados = estados.filter((e) => e.board_estado === 'Finalizada').map((e) => e.slug);
    const cerr = cerrados.length ? cerrados : ['__none__'];
    // $1 = estados cerrados, $2 = hoy, $3 = gestor (null = todos)
    const P = [cerr, hoy, gestor];
    const gCond = 'AND ($3::int IS NULL OR p.owner_id = $3)';
    const abierto = `p.estado <> ALL($1)`;
    const pendVenc = `EXISTS (SELECT 1 FROM prospecto_actividades a WHERE a.prospecto_id = p.id AND a.hecha = false AND a.deadline < $2::date)`;
    const pendAlguna = `EXISTS (SELECT 1 FROM prospecto_actividades a WHERE a.prospecto_id = p.id AND a.hecha = false)`;

    // pipeline por estado
    const porEstadoRows = (await db.query(
      `SELECT estado, count(*)::int AS n FROM prospectos p WHERE ($1::int IS NULL OR p.owner_id = $1) GROUP BY estado`, [gestor]
    )).rows;
    const porEstadoMap = {};
    porEstadoRows.forEach((r) => { porEstadoMap[r.estado] = r.n; });
    const por_estado = estados.map((e) => ({ slug: e.slug, label: e.label, color: e.color, count: porEstadoMap[e.slug] || 0 }));
    const total = porEstadoRows.reduce((a, r) => a + r.n, 0);

    // seguimiento (solo prospectos abiertos)
    const seg = (await db.query(
      `SELECT
         count(*) FILTER (WHERE NOT ${pendAlguna})::int AS sin_actividad,
         count(*) FILTER (WHERE ${pendVenc})::int AS atrasados,
         count(*) FILTER (WHERE ${pendAlguna} AND NOT ${pendVenc})::int AS al_dia,
         count(*) FILTER (WHERE p.task_id IS NOT NULL)::int AS con_tarea,
         count(*)::int AS abiertos
       FROM prospectos p WHERE ${abierto} ${gCond}`, P
    )).rows[0];

    // actividad por día (interacciones + actividades completadas), últimos 14 días
    const act = (await db.query(
      `SELECT dia, sum(n)::int AS n FROM (
         SELECT to_char((created_at - interval '5 hours')::date,'YYYY-MM-DD') AS dia, count(*) AS n
           FROM prospecto_interacciones i
           WHERE i.created_at >= NOW() - interval '14 days' AND ($1::int IS NULL OR i.user_id = $1)
           GROUP BY 1
         UNION ALL
         SELECT to_char((hecha_at - interval '5 hours')::date,'YYYY-MM-DD') AS dia, count(*) AS n
           FROM prospecto_actividades a
           WHERE a.hecha = true AND a.hecha_at >= NOW() - interval '14 days' AND ($1::int IS NULL OR a.created_by = $1)
           GROUP BY 1
       ) x GROUP BY dia`,
      [gestor]
    )).rows;
    const actPorDia = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(new Date(hoy + 'T00:00:00Z').getTime() - i * 86400000).toISOString().slice(0, 10);
      const hit = act.find((x) => x.dia === d);
      actPorDia.push({ dia: d, n: hit ? hit.n : 0 });
    }

    // por responsable comercial
    const porResp = (await db.query(
      `SELECT u.id, u.name,
         count(p.id)::int AS prospectos,
         count(p.id) FILTER (WHERE p.estado <> ALL($1) AND NOT EXISTS (
           SELECT 1 FROM prospecto_actividades a WHERE a.prospecto_id = p.id AND a.hecha = false))::int AS sin_actividad,
         count(p.id) FILTER (WHERE p.estado <> ALL($1) AND EXISTS (
           SELECT 1 FROM prospecto_actividades a WHERE a.prospecto_id = p.id AND a.hecha = false AND a.deadline < $2::date))::int AS atrasados,
         (SELECT count(*)::int FROM prospecto_interacciones i WHERE i.user_id = u.id AND i.created_at >= NOW() - interval '7 days') AS interacciones_7d
       FROM users u
       LEFT JOIN prospectos p ON p.owner_id = u.id
       WHERE u.account_type = 'colaborador' AND u.active = true ${gestor ? 'AND u.id = $3' : ''}
       GROUP BY u.id, u.name ORDER BY prospectos DESC, u.name`,
      gestor ? [cerr, hoy, gestor] : [cerr, hoy]
    )).rows;

    // prospectos que necesitan atención: abiertos, sin actividad pendiente o con una vencida
    const atencion = (await db.query(
      `SELECT p.id, p.empresa, p.estado, u.name AS owner_nombre,
              (SELECT min(deadline) FROM prospecto_actividades a WHERE a.prospecto_id = p.id AND a.hecha = false) AS proxima,
              (SELECT count(*)::int FROM prospecto_actividades a WHERE a.prospecto_id = p.id AND a.hecha = false AND a.deadline < $2::date) AS vencidas
       FROM prospectos p LEFT JOIN users u ON u.id = p.owner_id
       WHERE ${abierto} ${gCond}
         AND (NOT ${pendAlguna} OR ${pendVenc})
       ORDER BY (NOT ${pendAlguna}), (SELECT min(deadline) FROM prospecto_actividades a WHERE a.prospecto_id = p.id AND a.hecha = false) ASC NULLS FIRST, p.ts ASC
       LIMIT 30`, P
    )).rows;

    res.json({
      hoy,
      esAdmin: admin,
      gestor,
      colaboradores: admin ? (await db.query("SELECT id, name FROM users WHERE account_type = 'colaborador' AND active = true ORDER BY name")).rows : [],
      prospectos: {
        total,
        por_estado,
        seguimiento: {
          al_dia: seg.al_dia || 0,
          atrasados: seg.atrasados || 0,
          sin_actividad: seg.sin_actividad || 0,
          con_tarea: seg.con_tarea || 0,
          abiertos: seg.abiertos || 0,
        },
        actividad_por_dia: actPorDia,
        por_responsable: porResp,
        atencion,
      },
    });
  } catch (err) {
    console.error('Error en prospectos/resumen:', err.message);
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

router.put('/catalogo/estados/:eid', requiereAdmin, async (req, res) => {
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
