// CRM · Tablero Kanban de prospectos — una columna por cada uno de los 5 estados
// consolidados (por_prospectar/prospectando/propuesta/exitoso/rechazado).
// Dividido del <script> monolítico de app.html. Importa PROS y prosGestionar de
// prospectos.js (abrir una tarjeta del kanban lleva al detalle de gestión).
import { API } from '../api-bridge.js';
import { el, esc, chipEstado, fmtDate } from './core.js';
import { PROS, prosGestionar } from './prospectos.js';

/* ===== CRM · Tablero Kanban de prospectos ===== */
export function viewCrmTablero() {
  PROS.view = 'kanban';
  return API.request('/api/prospectos').then(function (r) {
    PROS.list = r.prospectos || []; PROS.meta = r.meta || {};
    PROS.sel = null;
    renderCrmKanban();
  });
}
export function prosActChip(p) {
  if ((p.act_atrasadas || 0) > 0) return '<span class="kb-act late"><i class="fa-solid fa-triangle-exclamation"></i> ' + p.act_atrasadas + ' vencida' + (p.act_atrasadas > 1 ? 's' : '') + '</span>';
  if ((p.act_pendientes || 0) === 0) return '<span class="kb-act none"><i class="fa-solid fa-circle-exclamation"></i> sin actividad</span>';
  return '<span class="kb-act ok"><i class="fa-regular fa-clock"></i> ' + fmtDate(p.act_proxima) + '</span>';
}
export function renderCrmKanban() {
  var estados = PROS.meta.estados || [];
  // Columnas del Kanban = los estados del prospecto, 1:1 (ya no hay una columna "kanban"
  // aparte que agrupe varios estados en una sola casilla).
  var cols = PROS.meta.kanban || estados.map(function (e) { return { id: e.slug, label: e.label }; });
  var estadoDe = function (slug) { return estados.filter(function (e) { return e.slug === slug; })[0] || { label: slug, color: '#94a3b8' }; };
  var q = (PROS.kbq || '').toLowerCase();
  var lista = PROS.list.filter(function (p) { return !q || (p.empresa || '').toLowerCase().indexOf(q) !== -1; });

  var byCol = {};
  cols.forEach(function (c) { byCol[c.id] = []; });
  // si un prospecto tiene un estado que no es ninguna de las columnas (dato viejo sin
  // migrar), lo mostramos en la primera columna en vez de que desaparezca del tablero.
  lista.forEach(function (p) { var k = (p.estado && byCol[p.estado]) ? p.estado : (cols[0] ? cols[0].id : 'prospectando'); byCol[k].push(p); });

  var colHtml = cols.map(function (c) {
    var cards = (byCol[c.id] || []).map(function (p) {
      var e = estadoDe(p.estado);
      return '<div class="kb-card' + ((p.act_pendientes || 0) === 0 || (p.act_atrasadas || 0) > 0 ? ' vencido' : '') + '" draggable="true" data-id="' + p.id + '">' +
        '<div class="kb-card-top"><strong>' + esc(p.empresa) + '</strong>' +
          (p.task_id ? '<span class="kb-tag">tarea</span>' : '') + '</div>' +
        '<div class="text-gray text-xs">' + esc(p.sector_nombre || 'Sin sector') + (p.owner_nombre ? ' · ' + esc(p.owner_nombre) : '') + '</div>' +
        '<div class="kb-card-foot">' +
          chipEstado(e.label, { color: e.color, clase: 'chip-sm' }) +
          prosActChip(p) +
        '</div>' +
      '</div>';
    }).join('') || '<div class="kb-empty">—</div>';
    return '<div class="kb-col" data-col="' + c.id + '">' +
      '<div class="kb-col-head">' + esc(c.label) + ' <span class="kb-count">' + (byCol[c.id] || []).length + '</span></div>' +
      '<div class="kb-col-body" data-col="' + c.id + '">' + cards + '</div>' +
    '</div>';
  }).join('');

  el('view').innerHTML =
    '<div class="bt-toolbar" style="margin-bottom:14px;">' +
      '<input id="kb_q" class="form-input" placeholder="Buscar empresa…" style="max-width:240px;" value="' + esc(PROS.kbq || '') + '">' +
      '<span class="text-gray text-xs">Arrastrá las tarjetas entre columnas. Clic para ver el seguimiento.</span>' +
    '</div>' +
    '<div class="kb-board">' + colHtml + '</div>';

  el('kb_q').addEventListener('input', function () { PROS.kbq = this.value; renderCrmKanban(); });

  el('view').querySelectorAll('.kb-card').forEach(function (card) {
    card.addEventListener('click', function () {
      var p = PROS.list.filter(function (x) { return String(x.id) === card.getAttribute('data-id'); })[0];
      if (p) { PROS.sel = p.id; PROS.from = 'kanban'; el('view').innerHTML = '<div id="prosBody"></div>'; prosGestionar(p); }
    });
    card.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', card.getAttribute('data-id')); card.classList.add('kb-dragging'); });
    card.addEventListener('dragend', function () { card.classList.remove('kb-dragging'); });
  });
  el('view').querySelectorAll('.kb-col-body').forEach(function (body) {
    body.addEventListener('dragover', function (e) { e.preventDefault(); body.classList.add('kb-over'); });
    body.addEventListener('dragleave', function () { body.classList.remove('kb-over'); });
    body.addEventListener('drop', function (e) {
      e.preventDefault(); body.classList.remove('kb-over');
      var id = e.dataTransfer.getData('text/plain');
      var p = PROS.list.filter(function (x) { return String(x.id) === id; })[0];
      var col = body.getAttribute('data-col');
      if (!p || p.estado === col) return;
      // columna === slug del estado directamente (1:1), ya no hace falta buscar por "kanban"
      var dest = estados.filter(function (e2) { return e2.slug === col; })[0];
      if (!dest) { showAlert('Esa columna no tiene un estado configurado.', 'warning'); return; }
      var prevE = p.estado;
      p.estado = dest.slug;
      renderCrmKanban();
      API.request('/api/prospectos/' + p.id + '/estado', { method: 'PATCH', body: JSON.stringify({ estado: dest.slug }) })
        .then(function () { showAlert('Movido a "' + dest.label + '".', 'success'); })
        .catch(function (err) { showAlert(err.message, 'error'); p.estado = prevE; renderCrmKanban(); });
    });
  });
}

