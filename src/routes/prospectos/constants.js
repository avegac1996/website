// Datos puros del dominio de prospección (CRM B2B). Sin lógica —
// mismo patrón que src/humanizer/dictionary.js.

// Cabeceras del .txt (CSV separado por ; — compatible con Excel ecuatoriano)
const CSV_HEADERS = [
  'timestamp', 'sector_id', 'sector_nombre', 'empresa', 'ruc', 'web',
  'contacto_nombre', 'contacto_apellido', 'cargo', 'email', 'telefono',
  'linkedin', 'fuente', 'pilar', 'fase_sop', 'fecha_fase',
  'extension_pbx', 'horario_preferido', 'notas',
];

const FIELDS = [
  'sector_id', 'sector_nombre', 'empresa', 'ruc', 'web', 'contacto_nombre', 'contacto_apellido',
  'cargo', 'email', 'telefono', 'linkedin', 'fuente', 'pilar', 'fase_sop',
  'fecha_fase', 'extension_pbx', 'horario_preferido', 'notas',
];

// Pipeline comercial (CRM) — resultados fijos; estados y tipos vienen de la BD (catálogo editable)
const INTER_RESULTADOS = ['contacto', 'no_contesto', 'agendo', 'propuesta', 'descartado', 'otro'];
const ACT_TIPOS = ['llamada', 'linkedin', 'whatsapp', 'reunion', 'otro'];
const KANBAN_COLS = ['por_prospectar', 'prospectando', 'exitoso', 'rechazado'];
const BOARD_ESTADOS = ['Tareas por hacer', 'En curso', 'Client Review', 'Control de calidad', 'Finalizada', 'Bloqueado'];

// Adjuntos de interacciones (data URL en la BD, igual que board_task_files)
const FILE_MIMES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'application/pdf'];
const FILE_MAX = 5 * 1024 * 1024;   // 5 MB del binario decodificado
const FILE_MAX_COUNT = 8;

module.exports = {
  CSV_HEADERS, FIELDS, INTER_RESULTADOS, ACT_TIPOS, KANBAN_COLS, BOARD_ESTADOS,
  FILE_MIMES, FILE_MAX, FILE_MAX_COUNT,
};
