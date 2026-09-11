const express = require('express');
const db = require('../../config/database');
const { ESTADO_FINAL, COIN_CASTIGO } = require('./constants');
const { isAdmin } = require('./helpers');
const { rangoSemana, nombreSprintSemanal, proyectosAutoSprint } = require('./sprints-shared');
const { ajustarTuringcoins } = require('./turingcoins');

const router = express.Router();

let _autoSprintRunning = false;
async function asegurarSprintsSemanales() {
  if (_autoSprintRunning) return;
  let cfg;
  try {
    cfg = (await db.query('SELECT * FROM board_auto_sprint WHERE id = 1')).rows[0];
  } catch (e) { return; } // tabla aún no migrada
  if (!cfg || !cfg.activo) return;
  if (cfg.ultima_revision && Date.now() - new Date(cfg.ultima_revision).getTime() < 10 * 60 * 1000) return;

  _autoSprintRunning = true;
  try {
    await db.query('UPDATE board_auto_sprint SET ultima_revision = NOW() WHERE id = 1');
    const { inicio, fin } = rangoSemana(cfg.dia_inicio);
    const proys = await proyectosAutoSprint(cfg);

    for (const pid of proys) {
      const ya = await db.query(
        "SELECT id FROM board_sprints WHERE project_id = $1 AND fecha_inicio = $2 AND estado <> 'cerrado'",
        [pid, inicio]
      );
      let sprintId;
      if (ya.rows.length) {
        sprintId = ya.rows[0].id;
        await db.query("UPDATE board_sprints SET estado = 'activo' WHERE id = $1 AND estado <> 'activo'", [sprintId]);
      } else {
        await db.query('BEGIN');
        try {
          sprintId = (await db.query(
            `INSERT INTO board_sprints (project_id, nombre, objetivo, fecha_inicio, fecha_fin, estado)
             VALUES ($1,$2,'Sprint semanal generado automáticamente.',$3,$4,'activo') RETURNING id`,
            [pid, nombreSprintSemanal(cfg.prefijo, inicio, fin), inicio, fin]
          )).rows[0].id;

          const prevs = (await db.query(
            "SELECT id FROM board_sprints WHERE project_id = $1 AND estado = 'activo' AND id <> $2", [pid, sprintId]
          )).rows.map((x) => x.id);

          if (prevs.length) {
            const pendientes = (await db.query(
              'SELECT id, titulo, assignee_id FROM board_tasks WHERE sprint_id = ANY($1) AND estado <> $2',
              [prevs, ESTADO_FINAL]
            )).rows;
            await db.query(
              'UPDATE board_tasks SET sprint_id = $1, en_backlog = false, updated_at = NOW() WHERE sprint_id = ANY($2) AND estado <> $3',
              [sprintId, prevs, ESTADO_FINAL]
            );
            await db.query("UPDATE board_sprints SET estado = 'cerrado', updated_at = NOW() WHERE id = ANY($1)", [prevs]);
            for (const t of pendientes) {
              if (t.assignee_id) {
                await ajustarTuringcoins(
                  t.assignee_id, -COIN_CASTIGO, 'penalty',
                  `Semana cerrada sin finalizar: ${t.titulo}`, 'Se cerró la semana',
                  `"${t.titulo}" no se finalizó esta semana. Perdiste -${COIN_CASTIGO} Turingcoins. Sigue en el sprint nuevo.`
                );
              }
            }
          }
          // tareas sueltas del proyecto (no sacadas a propósito) -> sprint de la semana
          await db.query(
            'UPDATE board_tasks SET sprint_id = $1, updated_at = NOW() WHERE project_id = $2 AND sprint_id IS NULL AND en_backlog = false',
            [sprintId, pid]
          );
          await db.query('COMMIT');
        } catch (e) {
          await db.query('ROLLBACK');
          console.error('Error creando sprint semanal:', e.message);
          continue;
        }
      }
      // barrido continuo: tareas nuevas sin sprint -> sprint de la semana
      await db.query(
        'UPDATE board_tasks SET sprint_id = $1, updated_at = NOW() WHERE project_id = $2 AND sprint_id IS NULL AND en_backlog = false',
        [sprintId, pid]
      );
    }
  } catch (err) {
    console.error('Error en asegurarSprintsSemanales:', err.message);
  } finally {
    _autoSprintRunning = false;
  }
}

/* ===================== AUTOMATIZACIÓN DE SPRINTS (config admin) ===================== */

// GET /api/board/auto-sprint  -> config + proyectos disponibles
router.get('/auto-sprint', async (req, res) => {
  try {
    const cfg = (await db.query('SELECT * FROM board_auto_sprint WHERE id = 1')).rows[0] || {};
    const projects = (await db.query('SELECT id, nombre FROM board_projects ORDER BY nombre')).rows;
    const efectivos = await proyectosAutoSprint(cfg);
    res.json({ config: cfg, projects, project_ids_efectivos: efectivos });
  } catch (err) {
    console.error('Error leyendo auto-sprint:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/board/auto-sprint  (solo admin)
router.put('/auto-sprint', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Solo un administrador puede cambiar esto' });
  try {
    const activo = req.body.activo !== false;
    const project_ids = Array.isArray(req.body.project_ids) ? req.body.project_ids.map(Number).filter(Boolean) : [];
    let dia = parseInt(req.body.dia_inicio, 10);
    if (!(dia >= 0 && dia <= 6)) dia = 1;
    const prefijo = String(req.body.prefijo || 'Sprint semanal').trim().slice(0, 40) || 'Sprint semanal';
    const row = (await db.query(
      `UPDATE board_auto_sprint SET activo = $1, project_ids = $2, dia_inicio = $3, prefijo = $4, ultima_revision = NULL
       WHERE id = 1 RETURNING *`,
      [activo, project_ids, dia, prefijo]
    )).rows[0];
    // aplicar de una
    await asegurarSprintsSemanales();
    res.json({ config: row });
  } catch (err) {
    console.error('Error guardando auto-sprint:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/board/auto-sprint/run  -> fuerza la revisión ahora (útil para probar)
router.post('/auto-sprint/run', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Solo un administrador' });
  try {
    await db.query('UPDATE board_auto_sprint SET ultima_revision = NULL WHERE id = 1');
    await asegurarSprintsSemanales();
    res.json({ message: 'Sprints semanales revisados.' });
  } catch (err) {
    console.error('Error corriendo auto-sprint:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = { router, asegurarSprintsSemanales };
