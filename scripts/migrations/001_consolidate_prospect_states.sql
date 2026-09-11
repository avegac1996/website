-- Migration: Consolidate Prospect States (5 estados unificados)
-- Propósito: Eliminar duplicación de estados y mapeos complejos
-- Cambia de: 8 estados de prospecto + 6 estados de board + mapeo configurable
-- A: 5 estados únicos que representan el viaje del prospecto

-- 1. Desactivar estados secundarios (mantener data histórica)
UPDATE prospecto_estados SET activo = false
WHERE slug IN ('contactado', 'en_seguimiento', 'reunion', 'no_responde');

-- 2. Insertar o actualizar los 5 estados nuevos
INSERT INTO prospecto_estados (slug, label, color, board_estado, kanban, orden, activo)
VALUES
  ('por_prospectar', 'Por Prospectar', '#94a3b8', 'Tareas por hacer', 'por_prospectar', 1, true),
  ('prospectando', 'Prospectando', '#3b82f6', 'En curso', 'prospectando', 2, true),
  ('propuesta', 'Propuesta Enviada', '#f97316', 'En curso', 'prospectando', 3, true),
  ('exitoso', 'Exitoso', '#10b981', 'Finalizada', 'exitoso', 4, true),
  ('rechazado', 'Rechazado', '#ef4444', 'Finalizada', 'rechazado', 5, true)
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  color = EXCLUDED.color,
  board_estado = EXCLUDED.board_estado,
  kanban = EXCLUDED.kanban,
  orden = EXCLUDED.orden,
  activo = EXCLUDED.activo;

-- 3. Migrar prospectos existentes a los nuevos estados
-- nuevo → por_prospectar
UPDATE prospectos SET estado = 'por_prospectar' WHERE estado = 'nuevo';

-- contactado, en_seguimiento, reunion → prospectando
UPDATE prospectos SET estado = 'prospectando' WHERE estado IN ('contactado', 'en_seguimiento', 'reunion');

-- perdido, no_responde → rechazado
UPDATE prospectos SET estado = 'rechazado' WHERE estado IN ('perdido', 'no_responde');

-- propuesta y ganado se quedan igual (ya existen en los nuevos datos)

-- 4. Log de cambios (opcional, para auditoria)
-- Nota: Si deseas registrar cuáles prospectos fueron migrados, agregar un comentario aquí

COMMIT;
