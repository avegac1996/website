const db = require('../../config/database');
const { MESES_ABREV } = require('./constants');

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

/* ---- Sprints semanales automáticos: helpers compartidos por el CRUD manual
   de sprints y por el motor de auto-sprint (evita un import circular entre
   sprints.routes.js y auto-sprint.js). ---- */

function rangoSemana(diaInicio) {
  const ec = new Date(Date.now() - 5 * 3600 * 1000);
  const base = new Date(Date.UTC(ec.getUTCFullYear(), ec.getUTCMonth(), ec.getUTCDate()));
  const diff = (base.getUTCDay() - diaInicio + 7) % 7;
  const ini = new Date(base); ini.setUTCDate(base.getUTCDate() - diff);
  const fin = new Date(ini); fin.setUTCDate(ini.getUTCDate() + 6);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { inicio: iso(ini), fin: iso(fin) };
}
function nombreSprintSemanal(prefijo, ini, fin) {
  const [iy, im, id] = ini.split('-').map(Number);
  const [fy, fm, fd] = fin.split('-').map(Number);
  let r = im === fm ? `${id}–${fd} ${MESES_ABREV[fm - 1]}` : `${id} ${MESES_ABREV[im - 1]} – ${fd} ${MESES_ABREV[fm - 1]}`;
  if (iy !== fy) r += ` ${fy}`;
  return `${prefijo} · ${r}`;
}
async function proyectosAutoSprint(cfg) {
  if (cfg.project_ids && cfg.project_ids.length) return cfg.project_ids;
  return (await db.query("SELECT id FROM board_projects WHERE nombre IN ('Turingtech', 'Prospectos')")).rows.map((x) => x.id);
}

module.exports = { sprintConProyecto, cleanSprint, rangoSemana, nombreSprintSemanal, proyectosAutoSprint };
