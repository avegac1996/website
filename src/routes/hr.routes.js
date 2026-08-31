const express = require('express');
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const HR_TYPES = ['certificado_laboral', 'rol_pagos', 'vacaciones', 'permiso', 'adelanto'];

router.use(authMiddleware);

// POST /api/hr/profile  -> el colaborador actualiza su foto de perfil (data URL)
router.post('/profile', async (req, res) => {
  try {
    const { photo } = req.body;
    if (photo != null && photo !== '') {
      if (typeof photo !== 'string' || !/^data:image\/(png|jpe?g|webp);base64,/.test(photo)) {
        return res.status(400).json({ error: 'Formato de imagen no válido' });
      }
      if (photo.length > 1500000) {
        return res.status(400).json({ error: 'La imagen es demasiado grande (máx. ~1 MB)' });
      }
    }
    await db.query('UPDATE users SET photo = $1, updated_at = NOW() WHERE id = $2', [photo || null, req.user.id]);
    res.json({ message: 'Foto actualizada' });
  } catch (err) {
    console.error('Error en hr profile:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/hr/requests  -> solicitudes del colaborador autenticado
router.get('/requests', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, type, details, start_date, end_date, status, admin_notes, created_at, reviewed_at
       FROM hr_requests WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ requests: result.rows });
  } catch (err) {
    console.error('Error en hr requests:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/hr/requests  -> crear solicitud (certificado laboral, vacaciones, permiso, adelanto)
router.post('/requests', async (req, res) => {
  try {
    const { type, details, start_date, end_date } = req.body;

    if (!HR_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Tipo de solicitud no válido' });
    }
    if ((type === 'vacaciones' || type === 'permiso') && !start_date) {
      return res.status(400).json({ error: 'Indica la fecha de inicio' });
    }

    const result = await db.query(
      `INSERT INTO hr_requests (user_id, type, details, start_date, end_date, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING id, type, status, created_at`,
      [req.user.id, type, details || null, start_date || null, end_date || null]
    );

    res.status(201).json({
      message: 'Solicitud enviada. Talento y Cultura la revisará pronto.',
      request: result.rows[0],
    });
  } catch (err) {
    console.error('Error creando hr request:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
