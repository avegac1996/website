const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { generateToken } = require('../utils/jwt');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
// El cliente entra directo (sin verificación de email) y con 0 créditos:
// los créditos se piden después según el proyecto a desarrollar.
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

    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, role, credits, email_verified, company, phone)
       VALUES ($1, $2, $3, 'user', 0, true, $4, $5)
       RETURNING id, name, email, role, credits, email_verified`,
      [name, email.toLowerCase(), hash, company || null, phone || null]
    );
    const user = result.rows[0];

    await db.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, 'Bienvenido a TURINGTECH', $2, 'welcome')`,
      [user.id, 'Tu cuenta ya está activa. Solicita créditos según el proyecto que quieras desarrollar y nuestro equipo los aprobará.']
    );

    const token = generateToken(user);

    res.status(201).json({
      message: 'Cuenta creada. Ya puedes ingresar.',
      token,
      user,
    });
  } catch (err) {
    console.error('Error en register:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/auth/verify?token=xxx  (legado: enlaces viejos de verificación; ya no otorga créditos)
router.get('/verify', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ error: 'Token no proporcionado' });
    }

    const result = await db.query(
      'SELECT id FROM users WHERE verification_token = $1',
      [token]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Token inválido o ya utilizado' });
    }

    await db.query(
      'UPDATE users SET email_verified = true, verification_token = NULL WHERE id = $1',
      [result.rows[0].id]
    );

    res.json({ message: 'Cuenta confirmada.', verified: true });
  } catch (err) {
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
