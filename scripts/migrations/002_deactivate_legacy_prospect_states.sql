-- Migration: Desactivar estados legacy que la 001 dejó activos por error
-- Propósito: 001_consolidate_prospect_states.sql desactivó 'contactado',
-- 'en_seguimiento', 'reunion' y 'no_responde', pero se olvidó de 'nuevo',
-- 'ganado' y 'perdido' -- estos migran sus prospectos a slugs nuevos
-- (por_prospectar/exitoso/rechazado respectivamente) pero la fila vieja se
-- queda con activo=true, a diferencia de 'propuesta' que reutiliza el mismo
-- slug y se actualiza in-place. Efecto visible: el dashboard CRM
-- (GET /api/prospectos/resumen -> por_estado) y el panel de admin de
-- catálogo muestran 3 estados fantasma con conteo 0 mezclados con los 5
-- reales -- la misma confusión de estados duplicados que se quiso eliminar.

UPDATE prospecto_estados SET activo = false
WHERE slug IN ('nuevo', 'ganado', 'perdido');
