const express = require('express');
const db = require('../../config/database');
const J = require('../../utils/jornada');
const { isAdmin } = require('./helpers');
const { PROSPECTO_ESTADOS_LIST, PROSPECTO_ESTADOS_CERRADOS } = require('./constants');

const router = express.Router();

// GET /api/prospectos/resumen  -> dashboard CRM (admin: todo; no-admin: solo lo suyo)
router.get('/resumen', async (req, res) => {
  try {
    const admin = isAdmin(req);
    const gestor = admin
      ? (req.query.gestor && /^\d+$/.test(req.query.gestor) ? Number(req.query.gestor) : null)
      : req.user.id;
    const hoy = J.hoyISO();
    const cerr = PROSPECTO_ESTADOS_CERRADOS;
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
    const por_estado = PROSPECTO_ESTADOS_LIST.map((e) => ({ slug: e.slug, label: e.label, color: e.color, count: porEstadoMap[e.slug] || 0 }));
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

module.exports = router;
