// Tabla de rutas (hash -> vista) y el router del shell. Dividido del <script>
// monolítico de app.html. Importa todas las vistas para poder armar ROUTES;
// core.js NO conoce ROUTES (evita import circular con este archivo).
import { el, esc, loadingHtml, menuLookup, setActive, refreshBell, viewInicio } from './core.js';
import { viewSolicitar, viewSolicitudes, viewHistorial, viewNotificaciones } from './creditos.js';
import { viewCredencial, viewMiConfig, viewHrSolicitudes, viewAdminHrSolicitudes } from './hr.js';
import { viewBoard, viewAutoSprint } from './board.js';
import { viewProspectos, viewAdminProspectos } from './prospectos.js';
import { viewResumen } from './crmdash.js';
import { viewCrmTablero } from './crmkanban.js';
import { viewProyectoDashboard } from './proydash.js';
import { viewTimbrado, viewTimbradoEquipo } from './timbrado.js';
import { viewHumanizador } from './humanizador.js';
import { viewAdminSolicitudes, viewAdminUsuarios, viewAdminCreditos, viewAdminConfig } from './admin.js';

export var ROUTES = {
  'inicio': viewInicio,
  'solicitar': viewSolicitar,
  'solicitudes': viewSolicitudes,
  'historial': viewHistorial,
  'notificaciones': viewNotificaciones,
  'credencial': viewCredencial,
  'hr-solicitudes': viewHrSolicitudes,
  'board': viewBoard,
  'prospectos': viewProspectos,
  'crm-dashboard': viewResumen,
  'crm-tablero': viewCrmTablero,
  'proy-dashboard': viewProyectoDashboard,
  'timbrado': viewTimbrado,
  'humanizador': viewHumanizador,
  'config': viewMiConfig,
  'admin-solicitudes': viewAdminSolicitudes,
  'admin-hr-solicitudes': viewAdminHrSolicitudes,
  'admin-usuarios': viewAdminUsuarios,
  'admin-creditos': viewAdminCreditos,
  'admin-resumen': viewResumen,
  'admin-prospectos': viewAdminProspectos,
  'admin-timbrado': viewTimbradoEquipo,
  'admin-sprints': viewAutoSprint,
  'admin-config': viewAdminConfig
};

export function router() {
  var routeId = (location.hash.replace(/^#\/?/, '') || 'inicio');
  var meta = menuLookup(routeId);
  if (!ROUTES[routeId] || !meta) {
    routeId = 'inicio'; meta = menuLookup('inicio');
    if (location.hash !== '#/inicio') { location.hash = '#/inicio'; return; }
  }
  setActive(routeId);
  // limpiamos alertas de la vista anterior: no tiene sentido que un mensaje
  // de la pantalla previa quede flotando sobre la vista nueva.
  var alertContainer = el('alert-container');
  if (alertContainer) alertContainer.innerHTML = '';
  el('breadcrumb').innerHTML = 'TURINGTECH <span class="sep">/</span> ' + esc(meta.section) +
    ' <span class="sep">/</span> <span class="current">' + esc(meta.item.label) + '</span>';
  el('pageTitle').textContent = meta.item.label;
  el('view').innerHTML = loadingHtml();
  el('shell').classList.remove('nav-open');
  Promise.resolve(ROUTES[routeId]()).catch(function (e) { showAlert(e.message, 'error'); });
  refreshBell();
}

/* ---------- Data helpers ---------- */
// Siempre trae datos frescos: los créditos/estados cambian cuando el admin aprueba/ajusta.
