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

// Estados consolidados del prospecto (5 estados = viaje del prospecto)
// Única fuente de verdad para validación en backend
const PROSPECTO_ESTADOS = {
  POR_PROSPECTAR: 'por_prospectar',
  PROSPECTANDO: 'prospectando',
  PROPUESTA: 'propuesta',
  EXITOSO: 'exitoso',
  RECHAZADO: 'rechazado'
};

const PROSPECTO_ESTADOS_LIST = [
  { slug: 'por_prospectar', label: 'Por Prospectar', color: '#94a3b8' },
  { slug: 'prospectando', label: 'Prospectando', color: '#3b82f6' },
  { slug: 'propuesta', label: 'Propuesta Enviada', color: '#f97316' },
  { slug: 'exitoso', label: 'Exitoso', color: '#10b981' },
  { slug: 'rechazado', label: 'Rechazado', color: '#ef4444' }
];

// Mapeo determinístico: estado prospecto → estado board (no editable)
const PROSPECTO_ESTADO_BOARD_MAPPING = {
  'por_prospectar': 'Tareas por hacer',
  'prospectando': 'En curso',
  'propuesta': 'En curso',
  'exitoso': 'Finalizada',
  'rechazado': 'Finalizada'
};

// Estados que cuentan como "cerrados" para las estadísticas del pipeline (dashboard CRM) —
// se definen directo sobre el propio estado del prospecto, sin pasar por el vocabulario
// del tablero de tareas (board_estado).
const PROSPECTO_ESTADOS_CERRADOS = ['exitoso', 'rechazado'];

// Adjuntos de interacciones (data URL en la BD, igual que board_task_files)
const FILE_MIMES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'application/pdf'];
const FILE_MAX = 5 * 1024 * 1024;   // 5 MB del binario decodificado
const FILE_MAX_COUNT = 8;

module.exports = {
  CSV_HEADERS, FIELDS, INTER_RESULTADOS, ACT_TIPOS,
  FILE_MIMES, FILE_MAX, FILE_MAX_COUNT,
  PROSPECTO_ESTADOS, PROSPECTO_ESTADOS_LIST, PROSPECTO_ESTADO_BOARD_MAPPING, PROSPECTO_ESTADOS_CERRADOS,
};
