const express = require('express');
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const J = require('../utils/jornada');

const router = express.Router();

const { TIPOS, TIPO_LABEL, hoyISO, horaEc, diaDe, calcDia, sugerido, resumenRango, rangoDefault } = J;

// Solo colaboradores TURINGTECH y admins
router.use(authMiddleware, (req, res, next) => {
  if (req.user.role === 'admin' || req.user.account_type === 'colaborador') return next();
  return res.status(403).json({ error: 'Acceso solo para colaboradores TURINGTECH' });
});
const isAdmin = (req) => req.user.role === 'admin';

async function marcasDelDia(userId, dia) {
  const r = await db.query(
    'SELECT id, tipo, ts, nota FROM time_entries WHERE user_id = $1 AND dia = $2 ORDER BY ts ASC, id ASC',
    [userId, dia]
  );
  return r.rows;
}

function payloadHoy(entries, dia) {
  const esHoy = dia === hoyISO();
  return {
    dia,
    esHoy,
    tipos: TIPOS.map((t) => ({ id: t, label: TIPO_LABEL[t] })),
    marcas: entries.map((e) => ({ id: e.id, tipo: e.tipo, label: TIPO_LABEL[e.tipo], hora: horaEc(e.ts), ts: e.ts, nota: e.nota || null })),
    resumen: calcDia(entries, esHoy),
    sugerido: sugerido(entries),
  };
}

// GET /api/timbrado/hoy  -> marcas + resumen del día del usuario (por defecto hoy)
router.get('/hoy', async (req, res) => {
  try {
    const dia = /^\d{4}-\d{2}-\d{2}$/.test(req.query.dia || '') ? req.query.dia : hoyISO();
    const entries = await marcasDelDia(req.user.id, dia);
    res.json(payloadHoy(entries, dia));
  } catch (err) {
    console.error('Error en timbrado/hoy:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/timbrado/marcar  { tipo, nota? }  -> registra una marca "ahora"
router.post('/marcar', async (req, res) => {
  try {
    const tipo = TIPOS.includes(req.body.tipo) ? req.body.tipo : null;
    if (!tipo) return res.status(400).json({ error: 'Tipo de marca no válido' });
    const nota = req.body.nota ? String(req.body.nota).slice(0, 200) : null;

    const now = new Date();
    const dia = diaDe(now);
    const previas = await marcasDelDia(req.user.id, dia);

    if (previas.length && previas[previas.length - 1].tipo === tipo) {
      return res.status(409).json({ error: 'Ya registraste "' + TIPO_LABEL[tipo] + '" como última marca.' });
    }
    if (tipo !== 'entrada' && !previas.some((e) => e.tipo === 'entrada')) {
      return res.status(409).json({ error: 'Primero marcá tu Entrada.' });
    }

    await db.query(
      'INSERT INTO time_entries (user_id, tipo, ts, dia, nota) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, tipo, now, dia, nota]
    );
    const entries = await marcasDelDia(req.user.id, dia);
    res.status(201).json(payloadHoy(entries, dia));
  } catch (err) {
    console.error('Error en timbrado/marcar:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/timbrado/:id  -> borra una marca propia del día en curso (corregir un error)
router.delete('/:id', async (req, res) => {
  try {
    const r = await db.query('SELECT user_id, dia FROM time_entries WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Marca no encontrada' });
    const m = r.rows[0];
    const propia = m.user_id === req.user.id;
    if (!propia && !isAdmin(req)) return res.status(403).json({ error: 'No podés borrar marcas de otra persona' });
    if (propia && !isAdmin(req) && String(m.dia).slice(0, 10) !== hoyISO()) {
      return res.status(403).json({ error: 'Solo podés corregir las marcas del día en curso' });
    }
    await db.query('DELETE FROM time_entries WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error en timbrado/delete:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/timbrado/resumen?desde=&hasta=  -> resumen propio por día
router.get('/resumen', async (req, res) => {
  try {
    const { desde, hasta } = rangoDefault(req.query);
    const r = await db.query(
      'SELECT tipo, ts, dia FROM time_entries WHERE user_id = $1 AND dia BETWEEN $2 AND $3 ORDER BY dia, ts, id',
      [req.user.id, desde, hasta]
    );
    res.json(resumenRango(r.rows, desde, hasta));
  } catch (err) {
    console.error('Error en timbrado/resumen:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/timbrado/equipo?desde=&hasta=  -> resumen de todo el equipo (admin)
router.get('/equipo', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Solo administradores' });
    const { desde, hasta } = rangoDefault(req.query);
    const users = (await db.query(
      "SELECT id, name, position FROM users WHERE account_type = 'colaborador' AND active = true ORDER BY name"
    )).rows;
    const marcas = (await db.query(
      'SELECT user_id, tipo, ts, dia FROM time_entries WHERE dia BETWEEN $1 AND $2 ORDER BY dia, ts, id',
      [desde, hasta]
    )).rows;
    const porUser = {};
    marcas.forEach((e) => { (porUser[e.user_id] = porUser[e.user_id] || []).push(e); });

    const equipo = users.map((u) => {
      const r = resumenRango(porUser[u.id] || [], desde, hasta);
      return {
        user_id: u.id, name: u.name, position: u.position || null,
        total_min: r.total_min, total_horas: r.total_horas,
        dias_con_marca: r.dias_con_marca, dias: r.dias,
      };
    });
    res.json({ desde, hasta, equipo });
  } catch (err) {
    console.error('Error en timbrado/equipo:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
