const express = require('express');
const db = require('../../config/database');
const { INTER_RESULTADOS, ACT_TIPOS } = require('./constants');
const { isAdmin, estadosActivos, tiposActivos, clean } = require('./helpers');

const router = express.Router();

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
