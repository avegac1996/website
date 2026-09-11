// Datos puros del dominio de tablero (Cronograma/Backlog/Sprint). Sin lógica —
// mismo patrón que src/humanizer/dictionary.js.

const ESTADOS = ['Tareas por hacer', 'En curso', 'Client Review', 'Control de calidad', 'Finalizada', 'Bloqueado'];
const TIPOS = ['Tarea', 'Reunión', 'Desarrollo', 'Configuración', 'Soporte', 'Investigación'];
const PRIORIDADES = ['baja', 'media', 'alta', 'urgente'];
const SPRINT_ESTADOS = ['planificado', 'activo', 'cerrado'];
const ESTADO_FINAL = 'Finalizada';

// Turingcoins por cumplimiento
const COIN_PREMIO = 2;   // terminar a tiempo
const COIN_CASTIGO = 3;  // no finalizar (extensión de fecha o cierre de semana)
const COIN_REABRIR = 1;  // penalización extra por reabrir una tarea ya premiada

const MESES_ABREV = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// Adjuntos de tareas (data URL en la BD)
const FILE_MIMES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'application/pdf'];
const FILE_MAX = 5 * 1024 * 1024; // 5 MB (tamaño del binario decodificado)

module.exports = {
  ESTADOS, TIPOS, PRIORIDADES, SPRINT_ESTADOS, ESTADO_FINAL,
  COIN_PREMIO, COIN_CASTIGO, COIN_REABRIR,
  MESES_ABREV, FILE_MIMES, FILE_MAX,
};
