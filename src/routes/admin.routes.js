const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { sendApprovedEmail, sendRejectedEmail, sendCreditModifiedEmail } = require('../services/email.service');

const router = express.Router();

// Todas las rutas requieren auth + admin
router.use(authMiddleware, adminMiddleware);

const ROLES = ['admin', 'user'];
const ACCOUNT_TYPES = ['cliente', 'colaborador'];

// POST /api/admin/users  -> crear usuario (p. ej. personal TURINGTECH) con rol
router.post('/users', async (req, res) => {
  try {
    const { name, email, password, role, account_type, position, company, phone, credits,
            vacation_total, vacation_used, handycoins } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    const finalRole = ROLES.includes(role) ? role : 'user';
    const finalType = ACCOUNT_TYPES.includes(account_type) ? account_type : (finalRole === 'admin' ? 'colaborador' : 'cliente');
    if (finalType === 'colaborador' && !String(position || '').trim()) {
      return res.status(400).json({ error: 'El cargo es obligatorio para colaboradores' });
    }
    const email_ = String(email).toLowerCase().trim();

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email_]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Ya existe una cuenta con este email' });
    }

    const hash = await bcrypt.hash(password, 10);
    const int = (v) => (Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : 0);

    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, role, account_type, position, credits, email_verified, company, phone,
                          vacation_total, vacation_used, handycoins)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, $10, $11, $12)
       RETURNING id, name, email, role, account_type, position, credits, email_verified, company, phone, created_at`,
      [name, email_, hash, finalRole, finalType, position || null, int(credits), company || null, phone || null,
       int(vacation_total), int(vacation_used), int(handycoins)]
    );

    res.status(201).json({ message: 'Usuario creado', user: result.rows[0] });
  } catch (err) {
    console.error('Error creando usuario:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.account_type, u.position, u.credits, u.email_verified, u.active, u.company, u.phone, u.created_at,
              u.photo, u.vacation_total, u.vacation_used, u.handycoins,
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

// PUT /api/admin/users/:id  -> editar datos del usuario
router.put('/users/:id', async (req, res) => {
  try {
    const { name, email, role, account_type, position, company, phone,
            vacation_total, vacation_used, handycoins } = req.body;
    const id = req.params.id;

    if (!name || !email) {
      return res.status(400).json({ error: 'Nombre y email son requeridos' });
    }
    const finalRole = ROLES.includes(role) ? role : 'user';
    const finalType = ACCOUNT_TYPES.includes(account_type) ? account_type : (finalRole === 'admin' ? 'colaborador' : 'cliente');
    if (finalType === 'colaborador' && !String(position || '').trim()) {
      return res.status(400).json({ error: 'El cargo es obligatorio para colaboradores' });
    }
    const email_ = String(email).toLowerCase().trim();
    const int = (v) => (Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : 0);

    const dup = await db.query('SELECT id FROM users WHERE email = $1 AND id <> $2', [email_, id]);
    if (dup.rows.length > 0) {
      return res.status(409).json({ error: 'Otro usuario ya usa ese email' });
    }

    const result = await db.query(
      `UPDATE users SET name = $1, email = $2, role = $3, account_type = $4, position = $5, company = $6, phone = $7,
              vacation_total = $8, vacation_used = $9, handycoins = $10, updated_at = NOW()
       WHERE id = $11
       RETURNING id, name, email, role, account_type, position, credits, email_verified, active, company, phone,
                 vacation_total, vacation_used, handycoins`,
      [name, email_, finalRole, finalType, position || null, company || null, phone || null,
       int(vacation_total), int(vacation_used), int(handycoins), id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ message: 'Usuario actualizado', user: result.rows[0] });
  } catch (err) {
    console.error('Error actualizando usuario:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PATCH /api/admin/users/:id/active  -> activar / desactivar
router.patch('/users/:id/active', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const active = !!req.body.active;

    if (id === req.user.id && !active) {
      return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
    }

    const result = await db.query(
      'UPDATE users SET active = $1, updated_at = NOW() WHERE id = $2 RETURNING id, active',
      [active, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ message: active ? 'Usuario activado' : 'Usuario desactivado', user: result.rows[0] });
  } catch (err) {
    console.error('Error cambiando estado de usuario:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/admin/users/:id/password  -> el admin resetea la contraseña de un usuario
router.put('/users/:id/password', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    const hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
      [hash, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ message: 'Contraseña actualizada' });
  } catch (err) {
    console.error('Error reseteando contraseña:', err.message);
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
       VALUES ($1, 'Créditos actualizados', $2, 'credit_modified')`,
      [userId, `El administrador ha ajustado tus créditos en ${parseInt(amount) >= 0 ? '+' : ''}${parseInt(amount)}. Motivo: ${reason || 'Ajuste manual'}`]
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
       VALUES ($1, '¡Solicitud aprobada!', $2, 'credit_approved')`,
      [request.user_id, `Tu solicitud de ${credits} créditos ha sido aprobada. Ya están disponibles en tu cuenta.`]
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
       VALUES ($1, 'Solicitud no aprobada', $2, 'credit_rejected')`,
      [request.user_id, `Tu solicitud de créditos no fue aprobada en esta ocasión. ${notes ? `Notas: ${notes}` : 'Contáctanos para más información.'}`]
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

// ===== Solicitudes RRHH (colaboradores TURINGTECH) =====
const HR_LABELS = {
  certificado_laboral: 'Certificado laboral',
  rol_pagos: 'Rol de pagos',
  vacaciones: 'Vacaciones',
  permiso: 'Permiso',
  adelanto: 'Adelanto de sueldo',
};

// GET /api/admin/hr-requests?status=pending
router.get('/hr-requests', async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const result = await db.query(
      `SELECT h.id, h.user_id, h.type, h.details, h.start_date, h.end_date, h.status, h.admin_notes,
              h.created_at, h.reviewed_at, u.name as user_name, u.email as user_email, u.position as user_position
       FROM hr_requests h
       JOIN users u ON h.user_id = u.id
       WHERE h.status = $1
       ORDER BY h.created_at DESC`,
      [status]
    );
    res.json({ requests: result.rows });
  } catch (err) {
    console.error('Error en admin hr-requests:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

async function reviewHrRequest(req, res, newStatus) {
  try {
    const { notes } = req.body;
    const id = req.params.id;

    const found = await db.query(
      `SELECT h.id, h.user_id, h.type, h.status FROM hr_requests h WHERE h.id = $1`,
      [id]
    );
    if (found.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    if (found.rows[0].status !== 'pending') {
      return res.status(400).json({ error: 'Esta solicitud ya fue revisada' });
    }
    const hr = found.rows[0];
    const label = HR_LABELS[hr.type] || hr.type;

    await db.query('BEGIN');
    await db.query(
      `UPDATE hr_requests SET status = $1, admin_notes = $2, reviewed_at = NOW(), reviewed_by = $3 WHERE id = $4`,
      [newStatus, notes || null, req.user.id, id]
    );
    const msg = newStatus === 'approved'
      ? `Tu solicitud de ${label} fue aprobada.${notes ? ' Notas: ' + notes : ''}`
      : `Tu solicitud de ${label} no fue aprobada.${notes ? ' Notas: ' + notes : ''}`;
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, $2, $3, $4)`,
      [hr.user_id, newStatus === 'approved' ? 'Solicitud aprobada' : 'Solicitud no aprobada', msg,
       newStatus === 'approved' ? 'hr_approved' : 'hr_rejected']
    );
    await db.query('COMMIT');

    res.json({ message: newStatus === 'approved' ? 'Solicitud aprobada' : 'Solicitud rechazada' });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Error revisando hr request:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

router.post('/hr-requests/:id/approve', (req, res) => reviewHrRequest(req, res, 'approved'));
router.post('/hr-requests/:id/reject', (req, res) => reviewHrRequest(req, res, 'rejected'));

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
