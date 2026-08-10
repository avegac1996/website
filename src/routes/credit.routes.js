const express = require('express');
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const { sendCreditRequestAdminEmail } = require('../services/email.service');

const router = express.Router();

// GET /api/credits/dashboard
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const userResult = await db.query(
      'SELECT id, name, email, role, credits, company, phone, created_at FROM users WHERE id = $1',
      [userId]
    );

    const transactionsResult = await db.query(
      'SELECT id, amount, type, description, created_at FROM credit_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
      [userId]
    );

    const requestsResult = await db.query(
      'SELECT id, project_description, requested_credits, status, admin_notes, created_at, reviewed_at FROM credit_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
      [userId]
    );

    const notificationsResult = await db.query(
      'SELECT id, title, message, type, is_read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
      [userId]
    );

    res.json({
      user: userResult.rows[0],
      transactions: transactionsResult.rows,
      requests: requestsResult.rows,
      notifications: notificationsResult.rows,
    });
  } catch (err) {
    console.error('Error en dashboard:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/credits/request
router.post('/request', authMiddleware, async (req, res) => {
  try {
    const { project_description, requested_credits } = req.body;

    if (!project_description || !requested_credits) {
      return res.status(400).json({ error: 'Descripción del proyecto y créditos solicitados son requeridos' });
    }

    const result = await db.query(
      `INSERT INTO credit_requests (user_id, project_description, requested_credits, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id, status, created_at`,
      [req.user.id, project_description, parseInt(requested_credits)]
    );

    // Obtener email de notificaciones del admin_config
    const configResult = await db.query(
      "SELECT value FROM admin_config WHERE key = 'notification_email'"
    );
    const adminEmail = configResult.rows.length > 0
      ? configResult.rows[0].value
      : process.env.NOTIFICATION_EMAIL || 'nicole.flores@turingtech.com.ec';

    await sendCreditRequestAdminEmail(
      adminEmail,
      req.user.name,
      req.user.email,
      project_description,
      parseInt(requested_credits)
    );

    res.status(201).json({
      message: 'Tu solicitud será aprobada en los siguientes minutos.',
      request: result.rows[0],
    });
  } catch (err) {
    console.error('Error en credit request:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/credits/transactions
router.get('/transactions', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, amount, type, description, created_at FROM credit_transactions WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ transactions: result.rows });
  } catch (err) {
    console.error('Error en transactions:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/credits/notifications
router.get('/notifications', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, title, message, type, is_read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ notifications: result.rows });
  } catch (err) {
    console.error('Error en notifications:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/credits/notifications/:id/read
router.put('/notifications/:id/read', authMiddleware, async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Notificación marcada como leída' });
  } catch (err) {
    console.error('Error marking notification:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
