// Middleware compartido: solo colaboradores TURINGTECH y admins pueden usar
// las rutas internas del CRM (tablero Kanban y prospección). Antes este mismo
// chequeo estaba duplicado literal dentro de board.routes.js y prospectos.routes.js.
function requireCollaboratorOrAdmin(req, res, next) {
  if (req.user.role === 'admin' || req.user.account_type === 'colaborador') return next();
  return res.status(403).json({ error: 'Acceso solo para colaboradores TURINGTECH' });
}

module.exports = { requireCollaboratorOrAdmin };
