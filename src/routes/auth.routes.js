const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/database');
const { generateToken } = require('../utils/jwt');
const { authMiddleware } = require('../middleware/auth');
const { sendVerificationEmail, sendWelcomeEmail } = require('../services/email.service');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, company, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nombre, email y password son requeridos' });
    }

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Ya existe una cuenta con este email' });
    }

    const hash = await bcrypt.hash(password, 10);
    const token = crypto.randomBytes(32).toString('hex');

    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, role, credits, email_verified, verification_token, company, phone)
       VALUES ($1, $2, $3, 'user', 0, false, $4, $5, $6)
       RETURNING id, name, email, role, credits, email_verified`,
      [name, email.toLowerCase(), hash, token, company || null, phone || null]
    );

    await sendVerificationEmail(email, token);

    res.status(201).json({
      message: 'Cuenta creada. Revisa tu email para verificar tu cuenta.',
      user: result.rows[0],
    });
  } catch (err) {
    console.error('Error en register:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/auth/verify?token=xxx
router.get('/verify', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ error: 'Token no proporcionado' });
    }

    const result = await db.query(
      'SELECT id, name, email, credits, email_verified FROM users WHERE verification_token = $1',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Token inválido o ya utilizado' });
    }

    const user = result.rows[0];
    if (user.email_verified) {
      return res.json({ message: 'Email ya verificado', verified: true });
    }

    const initialCredits = parseInt(process.env.INITIAL_CREDITS || '2000');

    await db.query('BEGIN');
    await db.query(
      'UPDATE users SET email_verified = true, verification_token = NULL, credits = credits + $1 WHERE id = $2',
      [initialCredits, user.id]
    );
    await db.query(
      `INSERT INTO credit_transactions (user_id, amount, type, description)
       VALUES ($1, $2, 'initial', 'Créditos iniciales por verificación de email')`,
      [user.id, initialCredits]
    );
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, '¡Bienvenido a TURINGTECH!', $2, 'credit_approved')`,
      [user.id, `Tu cuenta ha sido verificada y has recibido ${initialCredits} créditos iniciales. ¡Úsalos en tu próximo proyecto!`]
    );
    await db.query('COMMIT');

    await sendWelcomeEmail(user.email, user.name, initialCredits);

    res.json({
      message: 'Email verificado correctamente. Créditos asignados.',
      verified: true,
      credits: user.credits + initialCredits,
    });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Error en verify:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y password son requeridos' });
    }

    const result = await db.query(
      'SELECT id, name, email, password_hash, role, credits, email_verified, active FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }

    if (user.active === false) {
      return res.status(403).json({ error: 'Tu cuenta está desactivada. Contacta al administrador.' });
    }

    if (!user.email_verified && user.role !== 'admin') {
      return res.status(403).json({ error: 'Debes verificar tu email antes de iniciar sesión' });
    }

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        credits: user.credits,
      },
    });
  } catch (err) {
    console.error('Error en login:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  try {
    const { verifyToken } = require('../utils/jwt');
    const decoded = verifyToken(header.split(' ')[1]);
    const result = await db.query(
      `SELECT id, name, email, role, account_type, position, credits, email_verified, active, company, phone,
              photo, vacation_total, vacation_used, handycoins
       FROM users WHERE id = $1`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }
    if (result.rows[0].active === false) {
      return res.status(403).json({ error: 'Tu cuenta está desactivada' });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(401).json({ error: 'Token inválido' });
  }
});

// POST /api/auth/change-password  -> el usuario autenticado cambia su propia contraseña
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Contraseña actual y nueva son requeridas' });
    }
    if (String(new_password).length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }

    const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const valid = await bcrypt.compare(current_password, result.rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'La contraseña actual no es correcta' });
    }

    const hash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.user.id]);

    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error('Error en change-password:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
