const express = require('express');
const { authMiddleware } = require('../../middleware/auth');
const { requireCollaboratorOrAdmin } = require('../../middleware/collaborator');

const projectsRoutes = require('./projects.routes');
const sprintsRoutes = require('./sprints.routes');
const tasksRoutes = require('./tasks.routes');
const filesRoutes = require('./files.routes');
const { router: autoSprintRoutes } = require('./auto-sprint');

const router = express.Router();

// Solo colaboradores TURINGTECH y admins
router.use(authMiddleware, requireCollaboratorOrAdmin);

router.use('/', projectsRoutes);
router.use('/', sprintsRoutes);
router.use('/', tasksRoutes);
router.use('/', filesRoutes);
router.use('/', autoSprintRoutes);

module.exports = router;
