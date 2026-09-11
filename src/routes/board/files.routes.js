const express = require('express');
const db = require('../../config/database');
const { FILE_MIMES, FILE_MAX } = require('./constants');
const { puedeProyecto } = require('./helpers');

const router = express.Router();

/* ===================== ADJUNTOS DE TAREAS ===================== */

async function tareaConProyecto(id) {
  const r = await db.query('SELECT id, project_id FROM board_tasks WHERE id = $1', [id]);
  return r.rows[0] || null;
}

// GET /api/board/tasks/:id/files  -> incluye el data URL para render directo
router.get('/tasks/:id/files', async (req, res) => {
  try {
    const t = await tareaConProyecto(req.params.id);
    if (!t) return res.status(404).json({ error: 'Tarea no encontrada' });
    if (!(await puedeProyecto(req, t.project_id))) return res.status(403).json({ error: 'No perteneces a ese proyecto' });
    const files = (await db.query(
      `SELECT f.id, f.nombre, f.mime, f.tamano, f.data, f.created_at, u.name AS subido_por
       FROM board_task_files f LEFT JOIN users u ON u.id = f.uploaded_by
       WHERE f.task_id = $1 ORDER BY f.created_at`, [req.params.id]
    )).rows;
    res.json({ files });
  } catch (err) {
    console.error('Error listando adjuntos:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/board/tasks/:id/files   body: { nombre, data }  (data = data URL base64)
router.post('/tasks/:id/files', async (req, res) => {
  try {
    const t = await tareaConProyecto(req.params.id);
    if (!t) return res.status(404).json({ error: 'Tarea no encontrada' });
    if (!(await puedeProyecto(req, t.project_id))) return res.status(403).json({ error: 'No perteneces a ese proyecto' });

    const nombre = req.body.nombre;
    const data = String(req.body.data || '');
    const m = data.match(/^data:([^;]+);base64,(.*)$/s);
    if (!m) return res.status(400).json({ error: 'Formato de archivo inválido' });
    const mime = m[1].toLowerCase();
    if (!FILE_MIMES.includes(mime)) {
      return res.status(400).json({ error: 'Solo se permiten imágenes (PNG, JPG, WEBP, GIF) o PDF' });
    }
    const bytes = Buffer.byteLength(m[2], 'base64');
    if (!bytes) return res.status(400).json({ error: 'Archivo vacío o inválido' });
    if (bytes > FILE_MAX) return res.status(400).json({ error: 'El archivo supera los 5 MB' });

    const row = (await db.query(
      `INSERT INTO board_task_files (task_id, nombre, mime, tamano, data, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, nombre, mime, tamano, data, created_at`,
      [t.id, String(nombre || 'adjunto').slice(0, 255), mime, bytes, data, req.user.id]
    )).rows[0];
    res.status(201).json({ file: row });
  } catch (err) {
    console.error('Error subiendo adjunto:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/board/files/:id
router.delete('/files/:id', async (req, res) => {
  try {
    const f = (await db.query(
      `SELECT f.id, t.project_id
       FROM board_task_files f JOIN board_tasks t ON t.id = f.task_id
       WHERE f.id = $1`, [req.params.id]
    )).rows[0];
    if (!f) return res.status(404).json({ error: 'Adjunto no encontrado' });
    if (!(await puedeProyecto(req, f.project_id))) return res.status(403).json({ error: 'Sin acceso' });
    await db.query('DELETE FROM board_task_files WHERE id = $1', [req.params.id]);
    res.json({ message: 'Adjunto eliminado' });
  } catch (err) {
    console.error('Error eliminando adjunto:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
