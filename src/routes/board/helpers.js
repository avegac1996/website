const db = require('../../config/database');

const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || null;
// Ecuador es UTC-5 todo el año (sin horario de verano)
const hoyISO = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
const soloFecha = (d) => (d ? String(d).slice(0, 10) : null);

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

module.exports = { firstName, hoyISO, soloFecha, isAdmin, puedeProyecto, proyectosVisibles };
