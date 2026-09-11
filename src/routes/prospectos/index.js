const express = require('express');
const { authMiddleware } = require('../../middleware/auth');
const { requireCollaboratorOrAdmin } = require('../../middleware/collaborator');

const prospectosRoutes = require('./prospectos.routes');
const interaccionesRoutes = require('./interacciones.routes');
const actividadesRoutes = require('./actividades.routes');
const dashboardRoutes = require('./dashboard.routes');
const exportRoutes = require('./export.routes');
const convertirTareaRoutes = require('./convertir-tarea.routes');
const catalogoRoutes = require('./catalogo.routes');

const router = express.Router();

// Solo colaboradores TURINGTECH y admins
router.use(authMiddleware, requireCollaboratorOrAdmin);

router.use('/', prospectosRoutes);
router.use('/', interaccionesRoutes);
router.use('/', actividadesRoutes);
router.use('/', dashboardRoutes);
router.use('/', convertirTareaRoutes);
router.use('/', exportRoutes);
router.use('/', catalogoRoutes);

module.exports = router;
