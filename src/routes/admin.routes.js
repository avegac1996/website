const express = require('express');
const db = require('../config/database');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { sendApprovedEmail, sendRejectedEmail, sendCreditModifiedEmail } = require('../services/email.service');

const router = express.Router();

// Todas las rutas requieren auth + admin
router.use(authMiddleware, adminMiddleware);

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.credits, u.email_verified, u.company, u.phone, u.created_at,
              (SELECT COUNT(*) FROM credit_requests WHERE user_id = u.id AND status = 'pending') as pending_requests
       FROM users u
       ORDER BY u.created_at DESC`
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error('Error en admin users:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/admin/users/:id
router.get('/users/:id', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, email, role, credits, email_verified, company, phone, created_at FROM users WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const transactions = await db.query(
      'SELECT id, amount, type, description, created_at FROM credit_transactions WHERE user_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );

    res.json({
      user: result.rows[0],
      transactions: transactions.rows,
    });
  } catch (err) {
    console.error('Error en admin user detail:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/admin/users/:id/credits
router.post('/users/:id/credits', async (req, res) => {
  try {
    const { amount, reason } = req.body;
    const userId = req.params.id;

    if (!amount || amount === 0) {
      return res.status(400).json({ error: 'El monto debe ser diferente de 0' });
    }

    const userResult = await db.query(
      'SELECT id, name, email, credits FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const user = userResult.rows[0];
    const newBalance = user.credits + parseInt(amount);

    if (newBalance < 0) {
      return res.status(400).json({ error: 'El usuario no tiene suficientes créditos' });
    }

    await db.query('BEGIN');
    await db.query(
      'UPDATE users SET credits = credits + $1, updated_at = NOW() WHERE id = $2',
      [parseInt(amount), userId]
    );
    await db.query(
      `INSERT INTO credit_transactions (user_id, amount, type, description)
       VALUES ($1, $2, 'admin_grant', $3)`,
      [userId, parseInt(amount), reason || 'Ajuste manual por administrador']
    );
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, 'Créditos actualizados', 'El administrador ha ajustado tus créditos en $2. Motivo: $3', 'credit_modified')`,
      [userId, `${parseInt(amount) >= 0 ? '+' : ''}${parseInt(amount)}`, reason || 'Ajuste manual']
    );
    await db.query('COMMIT');

    await sendCreditModifiedEmail(user.email, user.name, parseInt(amount), newBalance, reason);

    res.json({
      message: 'Créditos actualizados correctamente',
      new_balance: newBalance,
    });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Error en admin adjust credits:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/admin/requests
router.get('/requests', async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const result = await db.query(
      `SELECT r.id, r.user_id, r.project_description, r.requested_credits, r.status, r.admin_notes,
              r.created_at, r.reviewed_at, u.name as user_name, u.email as user_email, u.company as user_company
       FROM credit_requests r
       JOIN users u ON r.user_id = u.id
       WHERE r.status = $1
       ORDER BY r.created_at DESC`,
      [status]
    );
    res.json({ requests: result.rows });
  } catch (err) {
    console.error('Error en admin requests:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/admin/requests/:id/approve
router.post('/requests/:id/approve', async (req, res) => {
  try {
    const { notes } = req.body;
    const requestId = req.params.id;

    const requestResult = await db.query(
      `SELECT r.id, r.user_id, r.requested_credits, r.status, u.name, u.email, u.credits
       FROM credit_requests r
       JOIN users u ON r.user_id = u.id
       WHERE r.id = $1`,
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    const request = requestResult.rows[0];
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Esta solicitud ya fue revisada' });
    }

    const credits = parseInt(request.requested_credits);
    const newBalance = request.credits + credits;

    await db.query('BEGIN');
    await db.query(
      `UPDATE credit_requests SET status = 'approved', admin_notes = $1, reviewed_at = NOW(), reviewed_by = $2 WHERE id = $3`,
      [notes || null, req.user.id, requestId]
    );
    await db.query(
      'UPDATE users SET credits = credits + $1, updated_at = NOW() WHERE id = $2',
      [credits, request.user_id]
    );
    await db.query(
      `INSERT INTO credit_transactions (user_id, amount, type, description)
       VALUES ($1, $2, 'admin_grant', 'Créditos aprobados por solicitud de proyecto')`,
      [request.user_id, credits]
    );
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, '¡Solicitud aprobada!', 'Tu solicitud de $2 créditos ha sido aprobada. Ya están disponibles en tu cuenta.', 'credit_approved')`,
      [request.user_id, credits]
    );
    await db.query('COMMIT');

    await sendApprovedEmail(request.email, request.name, credits);

    res.json({
      message: 'Solicitud aprobada correctamente',
      new_balance: newBalance,
    });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Error en approve request:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/admin/requests/:id/reject
router.post('/requests/:id/reject', async (req, res) => {
  try {
    const { notes } = req.body;
    const requestId = req.params.id;

    const requestResult = await db.query(
      `SELECT r.id, r.user_id, r.status, u.name, u.email
       FROM credit_requests r
       JOIN users u ON r.user_id = u.id
       WHERE r.id = $1`,
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    const request = requestResult.rows[0];
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Esta solicitud ya fue revisada' });
    }

    await db.query('BEGIN');
    await db.query(
      `UPDATE credit_requests SET status = 'rejected', admin_notes = $1, reviewed_at = NOW(), reviewed_by = $2 WHERE id = $3`,
      [notes || null, req.user.id, requestId]
    );
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, 'Solicitud no aprobada', 'Tu solicitud de créditos no fue aprobada en esta ocasión. $2', 'credit_rejected')`,
      [request.user_id, notes ? `Notas: ${notes}` : 'Contáctanos para más información.']
    );
    await db.query('COMMIT');

    await sendRejectedEmail(request.email, request.name, notes);

    res.json({ message: 'Solicitud rechazada' });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Error en reject request:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/admin/config
router.get('/config', async (req, res) => {
  try {
    const result = await db.query('SELECT key, value FROM admin_config');
    const config = {};
    result.rows.forEach(row => { config[row.key] = row.value; });
    res.json({ config });
  } catch (err) {
    console.error('Error en admin config:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/admin/config
router.put('/config', async (req, res) => {
  try {
    const { key, value } = req.body;

    if (!key || !value) {
      return res.status(400).json({ error: 'Key y value son requeridos' });
    }

    await db.query(
      `INSERT INTO admin_config (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, value]
    );

    res.json({ message: 'Configuración actualizada', key, value });
  } catch (err) {
    console.error('Error en admin update config:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
