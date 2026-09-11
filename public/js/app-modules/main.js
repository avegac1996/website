// Punto de entrada del shell de app.html (reemplaza el <script> monolítico +
// IIFE original). Verifica sesión, engancha los controles del shell
// (sidebar/topbar/búsqueda) y arranca el router tras cargar el usuario.
import { API } from '../api-bridge.js';
import { state, el, buildMenu, buildSidebar, paintTopbarAvatar, refreshBell } from './core.js';
import { router } from './routes.js';

if (!API.isLoggedIn()) {
  window.location.href = '/login.html';
} else {

/* ---------- Interacciones del shell ---------- */
el('navToggle').addEventListener('click', function () {
  var shell = el('shell');
  if (window.matchMedia('(max-width: 1024px)').matches) shell.classList.toggle('nav-open');
  else shell.classList.toggle('collapsed');
});
el('navBackdrop').addEventListener('click', function () { el('shell').classList.remove('nav-open'); });
// Al cruzar el breakpoint, limpiar estados de menú que no aplican
var _wasMobile = window.matchMedia('(max-width: 1024px)').matches;
window.addEventListener('resize', function () {
  var isMobile = window.matchMedia('(max-width: 1024px)').matches;
  if (isMobile !== _wasMobile) {
    el('shell').classList.remove('nav-open');
    if (isMobile) el('shell').classList.remove('collapsed');
    _wasMobile = isMobile;
  }
  el('userMenu').classList.remove('show');
});
window.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') { el('shell').classList.remove('nav-open'); el('userMenu').classList.remove('show'); }
});
el('bell').addEventListener('click', function () { location.hash = '#/notificaciones'; });
el('userChip').addEventListener('click', function (e) {
  if (e.target.closest('#userMenu')) return;
  el('userMenu').classList.toggle('show');
});
document.addEventListener('click', function (e) {
  if (!e.target.closest('#userChip')) el('userMenu').classList.remove('show');
});
el('logoutLink').addEventListener('click', function (e) { e.preventDefault(); API.logout(); });
el('navSearch').addEventListener('input', function () {
  var q = this.value.toLowerCase().trim();
  document.querySelectorAll('.nav-item').forEach(function (it) {
    it.style.display = (!q || it.textContent.toLowerCase().indexOf(q) !== -1) ? '' : 'none';
  });
});
window.addEventListener('hashchange', router);

/* ---------- Init ---------- */
API.getMe().then(function (data) {
  state.me = data.user;
  state.menu = buildMenu();
  el('userChipName').textContent = data.user.name;
  el('userChipRole').textContent = data.user.role === 'admin'
    ? 'Administrador TURINGTECH'
    : (data.user.account_type === 'colaborador' ? (data.user.position || 'Colaborador TURINGTECH') : 'Cliente');
  paintTopbarAvatar();
  buildSidebar();
  if (!location.hash || location.hash === '#') location.hash = '#/inicio';
  router();
  refreshBell();
  setInterval(refreshBell, 60000);
}).catch(function () { window.location.href = '/login.html'; });
}
