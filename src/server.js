const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const creditRoutes = require('./routes/credit.routes');
const adminRoutes = require('./routes/admin.routes');
const hrRoutes = require('./routes/hr.routes');
const boardRoutes = require('./routes/board.routes');
const prospectosRoutes = require('./routes/prospectos.routes');
const humanizerRoutes = require('./routes/humanizer.routes');

const app = express();

app.use(cors());
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

// Redirección: catalogo.html se retiró (duplicaba el contenido del home) y ahora
// apunta a la sección de servicios del home. Va antes del estático para tener prioridad.
app.get('/catalogo.html', (req, res) => {
  res.redirect(301, '/#servicios');
});

// Archivos estáticos del sitio público.
// HTML/CSS/JS sin caché para que los cambios se vean sin hard-refresh.
app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders: (res, filePath) => {
    if (/\.(html|css|js)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    }
  },
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/credits', creditRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/board', boardRoutes);
app.use('/api/prospectos', prospectosRoutes);
app.use('/api/humanizer', humanizerRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback: servir index.html para rutas no encontradas
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint no encontrado' });
  }
  const filePath = path.join(__dirname, '..', 'public', req.path);
  res.sendFile(filePath, (err) => {
    if (err) {
      next();
    }
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\nTURINGTECH server running on http://localhost:${PORT}`);
  console.log(`API: http://localhost:${PORT}/api/health\n`);
});
