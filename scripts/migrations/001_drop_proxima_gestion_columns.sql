-- Elimina prospectos.proxima_gestion / proxima_gestion_nota: quedaron
-- huérfanas (ningún endpoint ni pantalla del frontend las usaba). El
-- seguimiento real de "próxima gestión" se maneja con prospecto_actividades
-- (ver renderActividades en public/js/app-modules/prospectos.js), que sí
-- tiene UI completa y alimenta los badges del kanban y el dashboard.
--
-- Ejecutar en producción con:
--   psql "$DATABASE_URL" -f scripts/migrations/001_drop_proxima_gestion_columns.sql

DROP INDEX IF EXISTS idx_prospectos_proxima;
ALTER TABLE prospectos DROP COLUMN IF EXISTS proxima_gestion;
ALTER TABLE prospectos DROP COLUMN IF EXISTS proxima_gestion_nota;
