const express = require('express');
const db = require('../../config/database');
const { crearTareaDesdeProspecto, tareaBoardExiste } = require('../board/integration');

const router = express.Router();

// POST /api/prospectos/:id/convertir-tarea  -> crea (o devuelve) la tarea del tablero
router.post('/:id/convertir-tarea', async (req, res) => {
  try {
    const p = (await db.query('SELECT * FROM prospectos WHERE id = $1', [req.params.id])).rows[0];
    if (!p) return res.status(404).json({ error: 'Prospecto no encontrado' });
    if (p.task_id) {
      const existe = await tareaBoardExiste(p.task_id);
      if (existe) return res.json({ task_id: p.task_id, project_id: existe.project_id, ya_existia: true });
    }

    const { taskId, projectId } = await crearTareaDesdeProspecto(p, req.user.id);
    await db.query('UPDATE prospectos SET task_id = $1 WHERE id = $2', [taskId, req.params.id]);
    res.status(201).json({ task_id: taskId, project_id: projectId, proyecto: 'Turingtech' });
  } catch (err) {
    console.error('Error convirtiendo prospecto en tarea:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
