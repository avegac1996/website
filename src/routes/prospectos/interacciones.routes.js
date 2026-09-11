const express = require('express');
const db = require('../../config/database');
const { INTER_RESULTADOS, FILE_MIMES, FILE_MAX, FILE_MAX_COUNT } = require('./constants');
const { parseDataUrl } = require('./helpers');

const router = express.Router();

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

module.exports = router;
