const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { humanizarAsync } = require('../humanizer');
const { docxToText } = require('../humanizer/docx');

const router = express.Router();

// Colaboradores TURINGTECH y admins
router.use(authMiddleware, (req, res, next) => {
  if (req.user.role === 'admin' || req.user.account_type === 'colaborador') return next();
  return res.status(403).json({ error: 'Acceso solo para colaboradores TURINGTECH' });
});

// POST /api/humanizer            -> respuesta única  { result, stats }
// POST /api/humanizer?stream=1    -> stream NDJSON:  { progress, stage } ... { done, result, stats }
// body: { text?, docx_base64?, version: 'v1'|'v2' }
router.post('/', async (req, res) => {
  const stream = req.query.stream === '1';
  const send = (obj) => { try { res.write(JSON.stringify(obj) + '\n'); } catch (e) {} };
  try {
    const version = req.body.version === 'v2' ? 'v2' : 'v1';
    let texto = '';

    if (req.body.docx_base64) {
      const buf = Buffer.from(String(req.body.docx_base64), 'base64');
      if (buf.length > 12 * 1024 * 1024) return res.status(413).json({ error: 'Archivo demasiado grande' });
      texto = docxToText(buf);
    } else {
      texto = String(req.body.text || '');
    }

    if (!texto.trim()) return res.status(400).json({ error: 'El texto está vacío' });
    if (texto.length > 500000) return res.status(413).json({ error: 'El texto supera el límite (500 000 caracteres)' });

    if (!stream) {
      const out = await humanizarAsync(texto, version, null);
      return res.json({ result: out.result, stats: out.stats });
    }

    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    if (res.flushHeaders) res.flushHeaders();

    const out = await humanizarAsync(texto, version, (progress, stage) => {
      send({ progress, stage });
      if (res.flush) res.flush();
    });
    send({ done: true, progress: 1, result: out.result, stats: out.stats });
    res.end();
  } catch (err) {
    console.error('Error en humanizer:', err.message);
    if (res.headersSent) { send({ error: err.message || 'Error al procesar' }); res.end(); }
    else res.status(400).json({ error: err.message || 'No se pudo procesar el archivo' });
  }
});

module.exports = router;
