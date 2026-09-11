// Cronograma (Gantt) + Backlog + Sprint (Scrum) del tablero de proyectos, y la
// automatización de sprints semanales. Dividido del <script> monolítico de
// app.html. boardState y pasteState se comparten con prospectos.js (el prospecto
// puede abrir/editar tareas del tablero, y el paste-to-upload de imágenes es un
// único listener global reusado por ambos módulos).
import { API } from '../api-bridge.js';
import { el, esc, chipEstado, initials, emptyState, parseDateLocal, fmtDate, refreshBell, pasteState } from './core.js';

/* ===== Seguimiento de proyectos: Cronograma (Gantt) + Backlog + Sprint (Scrum) ===== */
export var BOARD_ESTADOS = ['Tareas por hacer', 'En curso', 'Client Review', 'Control de calidad', 'Finalizada', 'Bloqueado'];
export var ESTADO_SLUG = { 'Tareas por hacer': 'todo', 'En curso': 'prog', 'Client Review': 'review', 'Control de calidad': 'qa', 'Finalizada': 'done', 'Bloqueado': 'blocked' };
export var SPRINT_ESTADO_VARIANTE = { activo: 'success', planificado: 'info', cerrado: 'gray' };
export var ESTADO_FINAL = 'Finalizada';
export var FIBO = [1, 2, 3, 5, 8, 13, 21];
export var PRIO_META = {
  baja: { c: '#64748b', t: 'Baja', i: 'fa-angle-down' },
  media: { c: '#3b82f6', t: 'Media', i: 'fa-equals' },
  alta: { c: '#f59e0b', t: 'Alta', i: 'fa-angle-up' },
  urgente: { c: '#ef4444', t: 'Urgente', i: 'fa-angles-up' }
};
export var PX_DAY = 3;
export var boardState = {
  tasks: [], meta: {}, tab: 'tablero',
  tableroMode: 'sprint',  // 'sprint' | 'backlog' (una sola pestaña "Tablero")
  proyectoId: '',          // proyecto activo para el Tablero
  sprintSel: {},            // { [projectId]: sprintId }
  filtros: { proyecto: '', responsable: '', tipo: '', q: '' },
  collapsed: {}
};
export var dstr = function (d) { return d ? String(d).slice(0, 10) : null; };
export var boardSprintsDe = function (pid) {
  return (boardState.meta.sprints || []).filter(function (s) { return String(s.project_id) === String(pid); });
};
// subtareas de una tarea (hijas directas)
export var boardSubtareas = function (parentId) {
  return boardState.tasks.filter(function (x) { return String(x.parent_id) === String(parentId); });
};
export var boardEsPrincipal = function (t) { return !t.parent_id; };
export function boardCurrentProjectId() {
  var ps = boardState.meta.projects || [];
  if (!ps.length) return null;
  var f = ps.filter(function (p) { return String(p.id) === String(boardState.proyectoId); })[0];
  if (f) return f.id;
  // por defecto: "Turingtech" si existe, si no el primero
  var tt = ps.filter(function (p) { return p.nombre === 'Turingtech'; })[0];
  return tt ? tt.id : ps[0].id;
}
// filtro personal: no-admin ya viene filtrado del backend; admin puede filtrar por responsable
export function boardPasaResponsable(t) {
  var f = boardState.filtros.responsable;
  return !f || t.responsable === f;
}
export function boardSprintSel(pid) {
  var ss = boardSprintsDe(pid);
  if (!ss.length) return null;
  var chosen = boardState.sprintSel[pid];
  if (chosen && ss.filter(function (s) { return String(s.id) === String(chosen); })[0]) return Number(chosen);
  var activo = ss.filter(function (s) { return s.estado === 'activo'; })[0];
  return activo ? activo.id : ss[0].id;
}

export function viewBoard() {
  return API.request('/api/board/tasks').then(function (r) {
    boardState.tasks = r.tasks || [];
    boardState.meta = r.meta || {};
    var abrir = boardState._openTask;
    boardState._openTask = null;
    if (abrir) {
      var tt = boardState.tasks.filter(function (x) { return String(x.id) === String(abrir); })[0];
      if (tt) { boardEdit(tt); return; }
    }
    boardRender();
  });
}

export function boardFiltered() {
  var f = boardState.filtros;
  return boardState.tasks.filter(function (t) {
    if (f.proyecto && t.proyecto !== f.proyecto) return false;
    if (f.responsable && t.responsable !== f.responsable) return false;
    if (f.tipo && t.tipo !== f.tipo) return false;
    if (f.q && (t.titulo || '').toLowerCase().indexOf(f.q.toLowerCase()) === -1
            && (t.observaciones || '').toLowerCase().indexOf(f.q.toLowerCase()) === -1) return false;
    return true;
  });
}
export function boardProjectNames() {
  return (boardState.meta.projects || []).map(function (p) { return p.nombre; });
}
export function boardResponsables() {
  return Array.from(new Set(boardState.tasks.map(function (t) { return t.responsable; }).filter(Boolean))).sort();
}

export function boardRender() {
  var f = boardState.filtros;
  var opt = function (o, v) { return '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>'; };
  var sel = function (id, label, opts, val) {
    return '<select id="' + id + '" class="form-input" style="width:auto;min-width:140px;padding:8px 10px;font-size:13px;">' +
      '<option value="">' + label + '</option>' + opts.map(function (o) { return opt(o, val); }).join('') + '</select>';
  };
  var isAdmin = !!boardState.meta.isAdmin;
  var projects = boardState.meta.projects || [];
  var hayProyectos = projects.length > 0;
  var t = boardState.tab;

  var tabs = '<button class="tab ' + (t === 'cronograma' ? 'active' : '') + '" data-tab="cronograma"><i class="fa-solid fa-chart-gantt"></i> Cronograma</button>' +
    '<button class="tab ' + (t === 'tablero' ? 'active' : '') + '" data-tab="tablero"><i class="fa-solid fa-table-columns"></i> Tablero</button>' +
    (isAdmin ? '<button class="tab ' + (t === 'proyectos' ? 'active' : '') + '" data-tab="proyectos"><i class="fa-solid fa-folder-open"></i> Proyectos</button>' : '');

  var toolbar = '';
  if (t === 'cronograma') {
    toolbar = '<div class="bt-toolbar">' +
      '<input id="bt_q" class="form-input" placeholder="Buscar actividad..." style="max-width:220px;padding:8px 12px;font-size:13px;" value="' + esc(f.q) + '">' +
      sel('bt_proj', 'Todos los proyectos', boardProjectNames(), f.proyecto) +
      sel('bt_resp', 'Todos los responsables', boardResponsables(), f.responsable) +
      sel('bt_tipo', 'Todos los tipos', boardState.meta.tipos || [], f.tipo) +
    '</div>';
  } else if (t === 'tablero') {
    var pid = boardCurrentProjectId();
    var projOpts = projects.map(function (p) {
      return '<option value="' + p.id + '"' + (String(p.id) === String(pid) ? ' selected' : '') + '>' + esc(p.nombre) + '</option>';
    }).join('');
    var mode = boardState.tableroMode;
    toolbar = '<div class="bt-toolbar">' +
      '<div class="seg-toggle">' +
        '<button class="seg ' + (mode === 'backlog' ? 'on' : '') + '" data-mode="backlog"><i class="fa-solid fa-layer-group"></i> Backlog</button>' +
        '<button class="seg ' + (mode === 'sprint' ? 'on' : '') + '" data-mode="sprint"><i class="fa-solid fa-person-running"></i> Sprint</button>' +
      '</div>' +
      '<select id="bt_proj_id" class="form-input" style="width:auto;min-width:170px;padding:8px 10px;font-size:13px;"' + (hayProyectos ? '' : ' disabled') + '>' + projOpts + '</select>' +
      (isAdmin ? sel('bt_resp', 'Cualquier responsable', boardResponsables(), f.responsable) : '') +
      '<input id="bt_q" class="form-input" placeholder="Buscar tarea..." style="max-width:170px;padding:8px 12px;font-size:13px;" value="' + esc(f.q) + '">' +
      '<div style="flex:1;"></div>' +
      '<button class="btn btn-primary btn-small" id="bt_new" ' + (hayProyectos ? '' : 'disabled') + '><i class="fa-solid fa-plus"></i> Nueva tarea</button>' +
    '</div>';
  }

  el('view').innerHTML = '<div class="tabs" style="margin-bottom:14px;">' + tabs + '</div>' + toolbar + '<div id="boardBody"></div>';

  document.querySelectorAll('.tab[data-tab]').forEach(function (b) {
    b.addEventListener('click', function () { boardState.tab = this.getAttribute('data-tab'); boardRender(); });
  });
  document.querySelectorAll('.seg-toggle .seg').forEach(function (b) {
    b.addEventListener('click', function () { boardState.tableroMode = this.getAttribute('data-mode'); boardRender(); });
  });
  if (el('bt_q')) el('bt_q').addEventListener('input', function () { f.q = this.value; boardRenderBody(); });
  if (el('bt_proj')) el('bt_proj').addEventListener('change', function () { f.proyecto = this.value; boardRenderBody(); });
  if (el('bt_resp')) el('bt_resp').addEventListener('change', function () { f.responsable = this.value; boardRenderBody(); });
  if (el('bt_tipo')) el('bt_tipo').addEventListener('change', function () { f.tipo = this.value; boardRenderBody(); });
  if (el('bt_proj_id')) el('bt_proj_id').addEventListener('change', function () { boardState.proyectoId = this.value; boardRenderBody(); });
  if (el('bt_new')) el('bt_new').addEventListener('click', function () {
    var pre = { project_id: boardCurrentProjectId() };
    if (boardState.tableroMode === 'sprint') pre.sprint_id = boardSprintSel(pre.project_id);
    boardEdit(null, pre);
  });
  boardRenderBody();
}

export function boardRenderBody() {
  if (boardState.tab === 'proyectos') renderProyectos();
  else if (boardState.tab === 'tablero') { if (boardState.tableroMode === 'backlog') renderBacklog(); else renderSprint(); }
  else renderCronograma();
}

/* ---- Drag & drop de tarjetas con línea indicadora (estilo Odoo/CRM) ---- */
export function boardDnD(scopeEl, onDrop) {
  var dragId = null, marker = null;
  function removeMarker() { if (marker && marker.parentNode) marker.parentNode.removeChild(marker); marker = null; }
  function getMarker() {
    if (!marker) { marker = document.createElement('div'); marker.className = 'dnd-marker'; }
    return marker;
  }
  function refAt(zone, y) {
    var cards = Array.prototype.slice.call(zone.querySelectorAll('.dnd-card:not(.dragging)'));
    for (var i = 0; i < cards.length; i++) {
      var r = cards[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) return cards[i];
    }
    return null;
  }
  scopeEl.querySelectorAll('.dnd-card').forEach(function (card) {
    card.setAttribute('draggable', 'true');
    card.addEventListener('dragstart', function (e) {
      dragId = card.getAttribute('data-id');
      boardState.dragging = true;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', dragId); } catch (x) {}
    });
    card.addEventListener('dragend', function () {
      card.classList.remove('dragging');
      scopeEl.querySelectorAll('.dnd-over').forEach(function (z) { z.classList.remove('dnd-over'); });
      removeMarker();
      setTimeout(function () { dragId = null; boardState.dragging = false; }, 60);
    });
  });
  scopeEl.querySelectorAll('.dnd-zone').forEach(function (zone) {
    zone.addEventListener('dragover', function (e) {
      if (!dragId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      zone.classList.add('dnd-over');
      var ref = refAt(zone, e.clientY);
      var mk = getMarker();
      if (ref) zone.insertBefore(mk, ref); else zone.appendChild(mk);
    });
    zone.addEventListener('dragleave', function (e) { if (e.target === zone) zone.classList.remove('dnd-over'); });
    zone.addEventListener('drop', function (e) {
      if (!dragId) return;
      e.preventDefault();
      zone.classList.remove('dnd-over');
      var ref = refAt(zone, e.clientY);
      var ids = Array.prototype.slice.call(zone.querySelectorAll('.dnd-card'))
        .map(function (c) { return c.getAttribute('data-id'); })
        .filter(function (x) { return x !== dragId; });
      var idx = ref ? ids.indexOf(ref.getAttribute('data-id')) : ids.length;
      if (idx < 0) idx = ids.length;
      ids.splice(idx, 0, dragId);
      removeMarker();
      onDrop({ id: Number(dragId), zone: zone, orderedIds: ids.map(Number) });
    });
  });
}

export function boardTareaLocal(id) {
  return boardState.tasks.filter(function (x) { return String(x.id) === String(id); })[0];
}
// aplica localmente el resultado de un drop y persiste; en error recarga
export function boardMover(id, sprint_id, estado, orderedIds, rerender) {
  var t = boardTareaLocal(id);
  if (t) { t.sprint_id = sprint_id; t.estado = estado; }
  orderedIds.forEach(function (tid, i) { var x = boardTareaLocal(tid); if (x) x.orden = i + 1; });
  if (rerender) rerender();
  API.request('/api/board/tasks/' + id + '/mover', {
    method: 'PATCH',
    body: JSON.stringify({ sprint_id: sprint_id, estado: estado, orden_ids: orderedIds })
  }).catch(function (err) { showAlert(err.message, 'error'); viewBoard(); });
}

/* ---- Proyectos (admin) ---- */
export function renderProyectos(edit) {
  var cols = boardState.meta.colaboradores || [];
  var projects = boardState.meta.projects || [];
  var memByProj = boardState.meta.membersByProject || {};
  var p = edit || null;

  var checks = function (selectedIds) {
    return '<div style="display:flex;flex-direction:column;gap:6px;">' + cols.map(function (u) {
      var on = selectedIds.indexOf(u.id) !== -1;
      return '<label style="display:flex;align-items:center;gap:8px;font-size:13px;">' +
        '<input type="checkbox" value="' + u.id + '"' + (on ? ' checked' : '') + '> ' + esc(u.name) +
        (u.position ? ' <span class="text-gray text-xs">— ' + esc(u.position) + '</span>' : '') + '</label>';
    }).join('') + '</div>';
  };

  var form = '<div class="glass-panel" style="padding:22px;margin-bottom:20px;max-width:620px;">' +
    '<div class="section-heading" style="text-align:left;margin-bottom:14px;">' + (p ? 'Editar proyecto' : 'Nuevo proyecto') + '</div>' +
    '<form id="pjForm">' +
      '<div class="form-group"><label for="pj_nombre">Nombre <span class="form-required-marker">*</span></label><input id="pj_nombre" class="form-input" required value="' + esc(p ? p.nombre : '') + '"></div>' +
      '<div class="form-group"><label for="pj_desc">Descripción</label><textarea id="pj_desc" class="form-input" rows="2">' + esc(p ? (p.descripcion || '') : '') + '</textarea></div>' +
      '<div class="form-group"><label>Miembros del proyecto</label>' + checks(p ? (memByProj[p.id] || []).map(function (m) { return m.id; }) : []) + '</div>' +
      '<div style="display:flex;gap:8px;">' +
        '<button type="submit" class="btn btn-primary" id="pj_save">' + (p ? 'Guardar' : 'Crear proyecto') + '</button>' +
        (p ? '<button type="button" class="btn btn-secondary btn-small" id="pj_cancel">Cancelar</button>' +
             '<div style="flex:1;"></div><button type="button" class="btn btn-error btn-small" id="pj_del">Eliminar</button>' : '') +
      '</div>' +
    '</form></div>';

  var lista = '<div class="glass-panel" style="padding:22px;"><div class="section-heading" style="text-align:left;margin-bottom:14px;">Proyectos (' + projects.length + ')</div>' +
    (projects.map(function (pr) {
      var ms = (memByProj[pr.id] || []).map(function (m) { return esc(m.name); }).join(', ') || '<span class="text-gray">sin miembros</span>';
      return '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.05);">' +
        '<div><div style="color:var(--color-white);font-weight:600;font-size:14px;">' + esc(pr.nombre) + '</div><div class="text-gray text-xs">' + ms + '</div></div>' +
        '<button class="btn btn-secondary btn-small" data-pj-edit="' + pr.id + '">Editar</button></div>';
    }).join('') || '<p class="text-gray text-center" style="padding:20px 0;">Aún no hay proyectos.</p>') + '</div>';

  el('boardBody').innerHTML = form + lista;

  document.querySelectorAll('[data-pj-edit]').forEach(function (b) {
    b.addEventListener('click', function () {
      var pr = projects.filter(function (x) { return String(x.id) === b.getAttribute('data-pj-edit'); })[0];
      if (pr) renderProyectos(pr);
    });
  });
  if (el('pj_cancel')) el('pj_cancel').addEventListener('click', function () { renderProyectos(null); });
  if (el('pj_del')) el('pj_del').addEventListener('click', function () {
    if (!confirm('¿Eliminar el proyecto "' + p.nombre + '"? (debe estar sin actividades)')) return;
    API.request('/api/board/projects/' + p.id, { method: 'DELETE' })
      .then(function () { showAlert('Proyecto eliminado.', 'success'); viewBoard(); })
      .catch(function (err) { showAlert(err.message, 'error'); });
  });
  el('pjForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var miembros = Array.prototype.map.call(el('pjForm').querySelectorAll('input[type=checkbox]:checked'), function (c) { return Number(c.value); });
    var body = { nombre: el('pj_nombre').value.trim(), descripcion: el('pj_desc').value.trim(), miembros: miembros };
    var btn = el('pj_save'); btn.disabled = true; btn.textContent = 'Guardando...';
    var req = p
      ? API.request('/api/board/projects/' + p.id, { method: 'PUT', body: JSON.stringify(body) })
      : API.request('/api/board/projects', { method: 'POST', body: JSON.stringify(body) });
    req.then(function () { showAlert(p ? 'Proyecto actualizado.' : 'Proyecto creado.', 'success'); viewBoard(); })
      .catch(function (err) { showAlert(err.message, 'error'); btn.disabled = false; btn.textContent = p ? 'Guardar' : 'Crear proyecto'; });
  });
}

/* ---- Cronograma (Gantt) ---- */
export function renderCronograma() {
  var list = boardFiltered();
  var all = [];
  list.forEach(function (t) { if (t.fecha) all.push(dstr(t.fecha)); if (t.fecha_fin) all.push(dstr(t.fecha_fin)); });
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var minD = all.length ? parseDateLocal(all.reduce(function (a, b) { return a < b ? a : b; })) : new Date(today);
  var maxD = all.length ? parseDateLocal(all.reduce(function (a, b) { return a > b ? a : b; })) : new Date(today);
  var start = new Date(minD.getFullYear(), minD.getMonth(), 1);
  var end = new Date(maxD.getFullYear(), maxD.getMonth() + 1, 0);
  // asegurar al menos 7 meses de ventana
  var minEnd = new Date(start.getFullYear(), start.getMonth() + 7, 0);
  if (end < minEnd) end = minEnd;

  var months = [], cur = new Date(start);
  while (cur <= end) {
    var dim = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
    var lbl = cur.toLocaleDateString('es-EC', { month: 'long' });
    lbl = lbl.charAt(0).toUpperCase() + lbl.slice(1);
    if (cur.getFullYear() !== today.getFullYear()) lbl += " '" + String(cur.getFullYear()).slice(2);
    months.push({ label: lbl, w: dim * PX_DAY });
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  var totalW = months.reduce(function (a, m) { return a + m.w; }, 0);
  var off = function (d) { return Math.round((parseDateLocal(d) - start) / 86400000); };
  var todayLeft = off(today) * PX_DAY;

  var groups = {};
  list.forEach(function (t) { var p = t.proyecto || 'Sin proyecto'; (groups[p] = groups[p] || []).push(t); });

  var body = '';
  Object.keys(groups).forEach(function (proj) {
    var items = groups[proj];
    var coll = !!boardState.collapsed[proj];
    var gs = items.filter(function (t) { return t.fecha; }).map(function (t) { return dstr(t.fecha); });
    var ge = items.filter(function (t) { return t.fecha_fin || t.fecha; }).map(function (t) { return dstr(t.fecha_fin || t.fecha); });
    var gbar = '';
    if (gs.length) {
      var a = off(gs.reduce(function (x, y) { return x < y ? x : y; }));
      var b = off(ge.reduce(function (x, y) { return x > y ? x : y; }));
      gbar = '<div class="gt-bar gt-groupbar" style="left:' + (a * PX_DAY) + 'px;width:' + ((b - a + 1) * PX_DAY) + 'px;"></div>';
    }
    body += '<div class="gt-row gt-grouprow" data-proj="' + esc(proj) + '">' +
      '<div class="gt-cell gt-act"><span class="gt-caret">' + (coll ? '&#9656;' : '&#9662;') + '</span><strong>' + esc(proj) + '</strong><span class="text-gray text-xs">&nbsp;(' + items.length + ')</span></div>' +
      '<div class="gt-cell gt-est"></div><div class="gt-cell gt-per"></div>' +
      '<div class="gt-track" style="width:' + totalW + 'px;">' + gbar + '</div>' +
    '</div>';
    if (coll) return;
    items.forEach(function (t) {
      var bar = '';
      if (t.fecha) {
        var s = off(t.fecha), fn = t.fecha_fin ? off(t.fecha_fin) : s;
        if (fn < s) fn = s;
        var w = Math.max((fn - s + 1) * PX_DAY, 10);
        bar = '<div class="gt-bar est-' + ESTADO_SLUG[t.estado] + '" style="left:' + (s * PX_DAY) + 'px;width:' + w + 'px;" title="' + esc(t.titulo) + '"><span>' + esc(t.titulo) + '</span></div>';
      }
      var estSel = '<select class="gt-estsel est-' + ESTADO_SLUG[t.estado] + '" data-id="' + t.id + '">' +
        BOARD_ESTADOS.map(function (e) { return '<option' + (e === t.estado ? ' selected' : '') + '>' + esc(e) + '</option>'; }).join('') + '</select>';
      var per = t.responsable
        ? '<span class="bt-resp" title="' + esc(t.responsable) + '">' + esc(initials(t.responsable)) + '</span><span class="text-xs" style="margin-left:6px;">' + esc(t.responsable) + '</span>'
        : '<span class="text-gray text-xs">Sin asignar</span>';
      body += '<div class="gt-row">' +
        '<div class="gt-cell gt-act gt-tasktitle" data-id="' + t.id + '" title="' + esc(t.titulo) + '">' + esc(t.titulo) + '</div>' +
        '<div class="gt-cell gt-est">' + estSel + '</div>' +
        '<div class="gt-cell gt-per">' + per + '</div>' +
        '<div class="gt-track" style="width:' + totalW + 'px;">' + bar + '</div>' +
      '</div>';
    });
  });

  var monthHead = months.map(function (m) { return '<div class="gt-month" style="width:' + m.w + 'px;">' + esc(m.label) + '</div>'; }).join('');
  var todayMark = (todayLeft >= 0 && todayLeft <= totalW)
    ? '<div class="gt-today" style="left:' + todayLeft + 'px;"></div>' : '';

  el('boardBody').innerHTML =
    '<div class="gantt">' +
      '<div class="gt-row gt-head">' +
        '<div class="gt-cell gt-act">Actividad</div>' +
        '<div class="gt-cell gt-est">Estado</div>' +
        '<div class="gt-cell gt-per">Persona asignada</div>' +
        '<div class="gt-track" style="width:' + totalW + 'px;">' + monthHead + todayMark + '</div>' +
      '</div>' +
      body +
    '</div>' +
    (list.length ? '' : emptyState('No hay actividades con estos filtros.'));

  document.querySelectorAll('.gt-grouprow .gt-act').forEach(function (c) {
    c.addEventListener('click', function () {
      var p = c.parentNode.getAttribute('data-proj');
      boardState.collapsed[p] = !boardState.collapsed[p];
      renderCronograma();
    });
  });
  document.querySelectorAll('.gt-estsel').forEach(function (s) {
    s.addEventListener('change', function () {
      var id = this.getAttribute('data-id'), estado = this.value;
      var t = boardState.tasks.filter(function (x) { return String(x.id) === id; })[0];
      if (t) t.estado = estado;
      this.className = 'gt-estsel est-' + ESTADO_SLUG[estado];
      API.request('/api/board/tasks/' + id + '/estado', { method: 'PATCH', body: JSON.stringify({ estado: estado }) })
        .then(function () { renderCronograma(); })
        .catch(function (err) { showAlert(err.message, 'error'); viewBoard(); });
    });
  });
  document.querySelectorAll('.gt-tasktitle').forEach(function (c) {
    c.addEventListener('click', function () {
      var t = boardState.tasks.filter(function (x) { return String(x.id) === c.getAttribute('data-id'); })[0];
      if (t) boardEdit(t);
    });
  });
}

export function emptyProjectsMsg() {
  return '<div class="glass-panel" style="padding:30px;text-align:center;"><p class="text-gray">' +
    (boardState.meta.isAdmin ? 'Creá un proyecto en la pestaña Proyectos para empezar.' : 'Todavía no perteneces a ningún proyecto.') + '</p></div>';
}

// etiqueta de fecha límite: verde si en plazo, roja si vencida y sin finalizar
export function boardPlazoChip(t) {
  if (!t.fecha_fin) return '';
  var venc = fmtDate(t.fecha_fin);
  var hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  var fin = parseDateLocal(t.fecha_fin);
  var vencida = fin && fin < hoy && t.estado !== ESTADO_FINAL;
  var cls = t.estado === ESTADO_FINAL ? 'ok' : (vencida ? 'late' : '');
  return '<span class="bt-plazo ' + cls + '" title="Fecha de fin"><i class="fa-regular fa-clock"></i> ' + venc + '</span>';
}

/* ---- Tarjeta ---- */
export function boardCard(t) {
  var resp = t.responsable
    ? '<span class="bt-resp" title="' + esc(t.responsable) + '">' + esc(initials(t.responsable)) + '</span>'
    : '<span class="bt-resp bt-resp-none" title="Sin asignar">?</span>';
  var tipoCls = 'bt-tag tipo-' + (t.tipo || '').toLowerCase().replace(/[^a-z]/g, '');
  var pm = PRIO_META[t.prioridad] || PRIO_META.media;
  var prio = '<span class="bt-prio" title="Prioridad: ' + pm.t + '" style="color:' + pm.c + ';"><i class="fa-solid ' + pm.i + '"></i></span>';
  var pts = (t.puntos != null && t.puntos !== '') ? '<span class="bt-pts" title="Story points">' + esc(t.puntos) + '</span>' : '';
  var subs = boardSubtareas(t.id);
  var subBadge = subs.length
    ? '<span class="bt-badge" title="Subtareas finalizadas"><i class="fa-solid fa-list-check"></i> ' +
      subs.filter(function (s) { return s.estado === ESTADO_FINAL; }).length + '/' + subs.length + '</span>'
    : '';
  var fileBadge = t.files_count ? '<span class="bt-badge" title="Adjuntos"><i class="fa-solid fa-paperclip"></i> ' + t.files_count + '</span>' : '';
  var obs = t.observaciones ? '<div class="bt-obs">' + esc(String(t.observaciones).replace(/\s+/g, ' ').slice(0, 90)) + (String(t.observaciones).length > 90 ? '…' : '') + '</div>' : '';
  return '<div class="bt-card dnd-card" data-id="' + t.id + '">' +
    '<div class="bt-title">' + prio + esc(t.titulo) + '</div>' +
    obs +
    '<div class="bt-meta">' +
      (t.tipo ? '<span class="' + tipoCls + '">' + esc(t.tipo) + '</span>' : '') +
      boardPlazoChip(t) + subBadge + fileBadge +
    '</div>' +
    '<div class="bt-foot">' +
      '<span class="text-gray text-xs">' + (t.responsable ? esc(t.responsable) : 'Sin asignar') +
        (t.fecha ? ' &middot; ' + fmtDate(t.fecha) : '') + (t.horas ? ' &middot; ' + t.horas + 'h' : '') + '</span>' +
      '<span style="display:flex;align-items:center;gap:6px;">' + pts + resp + '</span>' +
    '</div>' +
  '</div>';
}

/* ---- Backlog ---- */
export function renderBacklog() {
  var pid = boardCurrentProjectId();
  if (!pid) { el('boardBody').innerHTML = emptyProjectsMsg(); return; }
  var q = (boardState.filtros.q || '').toLowerCase();
  var tasks = boardState.tasks.filter(function (t) {
    return String(t.project_id) === String(pid) && !t.sprint_id && boardEsPrincipal(t) && boardPasaResponsable(t) &&
      (!q || (t.titulo || '').toLowerCase().indexOf(q) !== -1);
  }).sort(function (a, b) { return (a.orden || 0) - (b.orden || 0) || a.id - b.id; });

  var sprints = boardSprintsDe(pid).filter(function (s) { return s.estado !== 'cerrado'; });
  var moverOpts = sprints.map(function (s) { return '<option value="' + s.id + '">' + esc(s.nombre) + '</option>'; }).join('');

  var chips = sprints.map(function (s) {
    var n = boardState.tasks.filter(function (t) { return String(t.sprint_id) === String(s.id); }).length;
    return '<div class="bl-sprint dnd-sprint" data-sprint="' + s.id + '">' +
      '<div><strong>' + esc(s.nombre) + '</strong>' + (s.estado === 'activo' ? ' ' + chipEstado('activo', { variante: 'success', clase: 'chip-sm chip-upper' }) : '') + '</div>' +
      '<span class="text-gray text-xs">' + n + ' tarea' + (n === 1 ? '' : 's') + ' · soltá una acá</span>' +
    '</div>';
  }).join('') || '<p class="text-gray text-xs">Sin sprints. Creá uno en la pestaña <strong>Sprint</strong>.</p>';

  var rows = tasks.map(function (t) {
    var pm = PRIO_META[t.prioridad] || PRIO_META.media;
    return '<div class="bl-row dnd-card" data-id="' + t.id + '">' +
      '<i class="fa-solid fa-grip-vertical bl-grip"></i>' +
      '<span class="bt-prio" style="color:' + pm.c + ';" title="' + pm.t + '"><i class="fa-solid ' + pm.i + '"></i></span>' +
      '<span class="bl-title" data-edit="' + t.id + '">' + esc(t.titulo) + '</span>' +
      (t.tipo ? '<span class="bt-tag tipo-' + (t.tipo || '').toLowerCase().replace(/[^a-z]/g, '') + '">' + esc(t.tipo) + '</span>' : '') +
      (t.puntos != null ? '<span class="bt-pts">' + esc(t.puntos) + '</span>' : '') +
      (t.responsable ? '<span class="bt-resp" title="' + esc(t.responsable) + '">' + esc(initials(t.responsable)) + '</span>' : '<span class="bt-resp bt-resp-none">?</span>') +
      (moverOpts ? '<select class="bl-move form-input" data-id="' + t.id + '"><option value="">→ a sprint…</option>' + moverOpts + '</select>' : '') +
    '</div>';
  }).join('') || emptyState('El backlog está vacío. Usá "Nueva tarea".');

  el('boardBody').innerHTML =
    '<div class="bl-wrap">' +
      '<div class="bl-main glass-panel"><div class="section-heading" style="text-align:left;margin-bottom:12px;">Backlog (' + tasks.length + ')</div>' +
        '<div class="dnd-zone bl-list">' + rows + '</div></div>' +
      '<div class="bl-side glass-panel"><div class="section-heading" style="text-align:left;margin-bottom:12px;">Sprints</div>' + chips + '</div>' +
    '</div>';

  boardDnD(el('boardBody'), function (d) {
    var t = boardTareaLocal(d.id);
    boardMover(d.id, null, t ? t.estado : 'Tareas por hacer', d.orderedIds, renderBacklog);
  });
  el('boardBody').querySelectorAll('.dnd-sprint').forEach(function (chip) {
    chip.addEventListener('dragover', function (e) { e.preventDefault(); chip.classList.add('dnd-over'); });
    chip.addEventListener('dragleave', function () { chip.classList.remove('dnd-over'); });
    chip.addEventListener('drop', function (e) {
      e.preventDefault(); chip.classList.remove('dnd-over');
      var id = Number(e.dataTransfer.getData('text/plain'));
      var t = boardTareaLocal(id);
      if (t) boardMover(id, Number(chip.getAttribute('data-sprint')), t.estado, [], function () { viewBoard(); });
    });
  });
  el('boardBody').querySelectorAll('.bl-move').forEach(function (sc) {
    sc.addEventListener('change', function () {
      if (!this.value) return;
      var id = Number(this.getAttribute('data-id')); var t = boardTareaLocal(id);
      boardMover(id, Number(this.value), t ? t.estado : 'Tareas por hacer', [], function () { viewBoard(); });
    });
  });
  el('boardBody').querySelectorAll('[data-edit]').forEach(function (s) {
    s.addEventListener('click', function () {
      if (boardState.dragging) return;
      var t = boardTareaLocal(this.getAttribute('data-edit')); if (t) boardEdit(t);
    });
  });
}

/* ---- Sprint (Kanban del sprint) ---- */
export function sprintEstado(sprint, estado) {
  API.request('/api/board/sprints/' + sprint.id + '/estado', { method: 'PATCH', body: JSON.stringify({ estado: estado }) })
    .then(function (r) {
      var msg = estado === 'activo' ? 'Sprint activado.' : estado === 'cerrado' ? 'Sprint cerrado.' : 'Sprint actualizado.';
      if (r && r.tareas_devueltas_al_backlog) msg += ' ' + r.tareas_devueltas_al_backlog + ' tarea(s) volvieron al Backlog.';
      showAlert(msg, 'success'); viewBoard();
    })
    .catch(function (err) { showAlert(err.message, 'error'); });
}

export function renderSprint() {
  var pid = boardCurrentProjectId();
  if (!pid) { el('boardBody').innerHTML = emptyProjectsMsg(); return; }
  var sprints = boardSprintsDe(pid);
  if (!sprints.length) {
    el('boardBody').innerHTML = '<div class="glass-panel" style="padding:30px;text-align:center;">' +
      '<p class="text-gray" style="margin-bottom:14px;">Este proyecto no tiene sprints todavía.</p>' +
      '<button class="btn btn-primary btn-small" id="spr_new"><i class="fa-solid fa-plus"></i> Crear primer sprint</button></div>';
    el('spr_new').addEventListener('click', function () { sprintEdit(pid, null); });
    return;
  }
  var sid = boardSprintSel(pid);
  var sprint = sprints.filter(function (s) { return String(s.id) === String(sid); })[0] || sprints[0];
  var q = (boardState.filtros.q || '').toLowerCase();
  var enSprint = boardState.tasks.filter(function (t) { return String(t.sprint_id) === String(sprint.id); });
  var tasks = enSprint.filter(function (t) {
    return boardEsPrincipal(t) && boardPasaResponsable(t) && (!q || (t.titulo || '').toLowerCase().indexOf(q) !== -1);
  });

  // progreso: cuenta tareas principales + subtareas del sprint
  var totalPts = 0, donePts = 0, doneN = 0;
  enSprint.forEach(function (t) {
    var p = Number(t.puntos) || 0; totalPts += p;
    if (t.estado === ESTADO_FINAL) { donePts += p; doneN++; }
  });
  var pct = enSprint.length ? Math.round((totalPts ? donePts / totalPts : doneN / enSprint.length) * 100) : 0;

  var selOpts = sprints.map(function (s) {
    return '<option value="' + s.id + '"' + (String(s.id) === String(sprint.id) ? ' selected' : '') + '>' +
      esc(s.nombre) + (s.estado === 'activo' ? ' • activo' : s.estado === 'cerrado' ? ' • cerrado' : '') + '</option>';
  }).join('');

  var acciones = '';
  if (sprint.estado === 'planificado') acciones += '<button class="btn btn-primary btn-small" id="spr_activar"><i class="fa-solid fa-play"></i> Activar</button>';
  if (sprint.estado === 'activo') acciones += '<button class="btn btn-secondary btn-small" id="spr_cerrar"><i class="fa-solid fa-flag-checkered"></i> Cerrar</button>';
  acciones += '<button class="btn btn-secondary btn-small" id="spr_edit" title="Editar sprint"><i class="fa-solid fa-pen"></i></button>';
  acciones += '<button class="btn btn-error btn-small" id="spr_del" title="Eliminar sprint"><i class="fa-solid fa-trash"></i></button>';

  var rango = (sprint.fecha_inicio ? fmtDate(sprint.fecha_inicio) : '—') + '  →  ' + (sprint.fecha_fin ? fmtDate(sprint.fecha_fin) : '—');
  var header = '<div class="spr-head glass-panel">' +
    '<div class="spr-head-top">' +
      '<select id="spr_sel" class="form-input" style="width:auto;min-width:170px;padding:7px 10px;font-size:13px;">' + selOpts + '</select>' +
      chipEstado(sprint.estado, { variante: SPRINT_ESTADO_VARIANTE[sprint.estado] || 'gray', clase: 'chip-sm chip-upper' }) +
      '<button class="btn btn-secondary btn-small" id="spr_new"><i class="fa-solid fa-plus"></i> Sprint</button>' +
      '<div style="flex:1;"></div>' + acciones +
    '</div>' +
    (sprint.objetivo ? '<div class="spr-goal">' + esc(sprint.objetivo) + '</div>' : '') +
    '<div class="spr-meta"><span><i class="fa-regular fa-calendar"></i> ' + rango + '</span>' +
      '<span>' + doneN + '/' + enSprint.length + ' tareas</span>' +
      (totalPts ? '<span>' + donePts + '/' + totalPts + ' pts</span>' : '') + '</div>' +
    '<div class="spr-bar"><div class="spr-bar-fill" style="width:' + pct + '%;"></div></div>' +
  '</div>';

  var colsHtml = BOARD_ESTADOS.map(function (e) {
    var items = tasks.filter(function (t) { return t.estado === e; })
      .sort(function (a, b) { return (a.orden || 0) - (b.orden || 0) || a.id - b.id; });
    return '<div class="bt-col"><div class="bt-col-head"><span>' + e + '</span><span class="bt-count">' + items.length + '</span></div>' +
      '<div class="bt-col-body dnd-zone" data-estado="' + esc(e) + '">' + items.map(boardCard).join('') + '</div></div>';
  }).join('');

  el('boardBody').innerHTML = header + '<div class="bt-board">' + colsHtml + '</div>';

  el('spr_sel').addEventListener('change', function () { boardState.sprintSel[pid] = this.value; renderSprint(); });
  el('spr_new').addEventListener('click', function () { sprintEdit(pid, null); });
  if (el('spr_edit')) el('spr_edit').addEventListener('click', function () { sprintEdit(pid, sprint); });
  if (el('spr_activar')) el('spr_activar').addEventListener('click', function () { sprintEstado(sprint, 'activo'); });
  if (el('spr_cerrar')) el('spr_cerrar').addEventListener('click', function () {
    if (confirm('¿Cerrar "' + sprint.nombre + '"? Las tareas sin finalizar vuelven al Backlog.')) sprintEstado(sprint, 'cerrado');
  });
  if (el('spr_del')) el('spr_del').addEventListener('click', function () {
    if (!confirm('¿Eliminar el sprint "' + sprint.nombre + '"? Sus tareas vuelven al Backlog.')) return;
    API.request('/api/board/sprints/' + sprint.id, { method: 'DELETE' })
      .then(function () { showAlert('Sprint eliminado.', 'success'); delete boardState.sprintSel[pid]; viewBoard(); })
      .catch(function (err) { showAlert(err.message, 'error'); });
  });

  boardDnD(el('boardBody'), function (d) {
    boardMover(d.id, sprint.id, d.zone.getAttribute('data-estado'), d.orderedIds, renderSprint);
  });
  el('boardBody').querySelectorAll('.bt-card').forEach(function (card) {
    card.addEventListener('click', function () {
      if (boardState.dragging) return;
      var t = boardTareaLocal(card.getAttribute('data-id')); if (t) boardEdit(t);
    });
  });
}

/* ---- Editor de sprint ---- */
export function sprintEdit(pid, s) {
  var isNew = !s;
  s = s || { nombre: '', objetivo: '', fecha_inicio: '', fecha_fin: '' };
  el('view').innerHTML =
    '<button class="btn btn-secondary btn-small" id="spr_back"><i class="fa-solid fa-arrow-left"></i> Volver</button>' +
    '<div class="glass-panel" style="padding:28px;max-width:520px;margin-top:14px;">' +
      '<div class="section-heading" style="text-align:left;margin-bottom:16px;">' + (isNew ? 'Nuevo sprint' : 'Editar sprint') + '</div>' +
      '<form id="sprForm">' +
        '<div class="form-group"><label for="spr_nombre">Nombre <span class="form-required-marker">*</span></label><input id="spr_nombre" class="form-input" required value="' + esc(s.nombre) + '"></div>' +
        '<div class="form-group"><label for="spr_obj">Objetivo del sprint</label><textarea id="spr_obj" class="form-input" rows="2">' + esc(s.objetivo || '') + '</textarea></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">' +
          '<div class="form-group"><label for="spr_ini">Inicio</label><input type="date" id="spr_ini" class="form-input" value="' + esc(dstr(s.fecha_inicio) || '') + '"></div>' +
          '<div class="form-group"><label for="spr_fin">Fin</label><input type="date" id="spr_fin" class="form-input" value="' + esc(dstr(s.fecha_fin) || '') + '"></div>' +
        '</div>' +
        '<button type="submit" class="btn btn-primary" id="spr_save">' + (isNew ? 'Crear sprint' : 'Guardar') + '</button>' +
      '</form>' +
    '</div>';
  el('spr_back').addEventListener('click', boardRender);
  el('sprForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = el('spr_save'); btn.disabled = true; btn.textContent = 'Guardando...';
    var body = {
      project_id: pid, nombre: el('spr_nombre').value.trim(), objetivo: el('spr_obj').value.trim(),
      fecha_inicio: el('spr_ini').value || null, fecha_fin: el('spr_fin').value || null
    };
    var req = isNew
      ? API.request('/api/board/sprints', { method: 'POST', body: JSON.stringify(body) })
      : API.request('/api/board/sprints/' + s.id, { method: 'PUT', body: JSON.stringify(body) });
    req.then(function () { showAlert(isNew ? 'Sprint creado.' : 'Sprint actualizado.', 'success'); viewBoard(); })
      .catch(function (err) { showAlert(err.message, 'error'); btn.disabled = false; btn.textContent = isNew ? 'Crear sprint' : 'Guardar'; });
  });
}

// recarga silenciosa de tareas (sin re-render), para refrescar subtareas/adjuntos
export function reloadBoardTasks() {
  return API.request('/api/board/tasks').then(function (r) {
    boardState.tasks = r.tasks || [];
    boardState.meta = r.meta || boardState.meta;
  });
}

/* ---- Editor de tarea ---- */
export function boardEdit(t, pre) {
  var isNew = !t;
  pre = pre || {};
  t = t || { titulo: '', project_id: pre.project_id || '', assignee_id: '', sprint_id: pre.sprint_id || '', parent_id: pre.parent_id || null, tipo: 'Tarea', estado: 'Tareas por hacer', prioridad: 'media', fecha: '', fecha_fin: '', horas: '', puntos: '', observaciones: '' };
  var m = boardState.meta;
  var projs = m.projects || [];
  var memByProj = m.membersByProject || {};
  var prioridades = m.prioridades || ['baja', 'media', 'alta', 'urgente'];
  var esSub = !!t.parent_id;
  var padre = esSub ? boardTareaLocal(t.parent_id) : null;
  var finBloqueada = !isNew && !!t.fin_bloqueada;
  var opt = function (arr, v) { return arr.map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join(''); };
  var curProj = t.project_id ? Number(t.project_id) : (projs[0] ? projs[0].id : '');

  var projOpts = projs.map(function (p) { return '<option value="' + p.id + '"' + (p.id === curProj ? ' selected' : '') + '>' + esc(p.nombre) + '</option>'; }).join('');
  var respOptsFor = function (pid) {
    var ms = memByProj[pid] || [];
    return '<option value="">— Sin asignar —</option>' + ms.map(function (u) {
      return '<option value="' + u.id + '"' + (String(u.id) === String(t.assignee_id) ? ' selected' : '') + '>' + esc(u.name) + '</option>';
    }).join('');
  };
  var sprintOptsFor = function (pid) {
    var ss = boardSprintsDe(pid).filter(function (s) { return s.estado !== 'cerrado'; });
    return '<option value="">Backlog (sin sprint)</option>' + ss.map(function (s) {
      return '<option value="' + s.id + '"' + (String(s.id) === String(t.sprint_id) ? ' selected' : '') + '>' + esc(s.nombre) + (s.estado === 'activo' ? ' • activo' : '') + '</option>';
    }).join('');
  };
  var chipsHtml = function (v) {
    return '<div class="sp-chips" id="bt_f_pts">' +
      '<button type="button" class="sp-chip' + (v == null || v === '' ? ' active' : '') + '" data-v="">–</button>' +
      FIBO.map(function (n) { return '<button type="button" class="sp-chip' + (String(v) === String(n) ? ' active' : '') + '" data-v="' + n + '">' + n + '</button>'; }).join('') +
    '</div>';
  };

  var banner = esSub
    ? '<div class="bt-subbanner"><i class="fa-solid fa-diagram-project"></i> Subtarea de <strong>' + esc(padre ? padre.titulo : ('#' + t.parent_id)) + '</strong>' +
      (padre ? ' <button type="button" class="linklike" id="bt_goparent">abrir principal</button>' : '') + '</div>'
    : '';

  el('view').innerHTML =
    '<button class="btn btn-secondary btn-small" id="bt_back"><i class="fa-solid fa-arrow-left"></i> Volver</button>' +
    '<div class="glass-panel" style="padding:28px;max-width:660px;margin-top:14px;">' +
      '<div class="section-heading" style="text-align:left;margin-bottom:16px;">' + (isNew ? (esSub ? 'Nueva subtarea' : 'Nueva tarea') : (esSub ? 'Editar subtarea' : 'Editar tarea')) + '</div>' +
      banner +
      '<form id="btForm">' +
        '<div class="form-group"><label for="bt_titulo">Título / descripción <span class="form-required-marker">*</span></label>' +
          '<textarea id="bt_titulo" class="form-input" rows="2" required>' + esc(t.titulo) + '</textarea></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">' +
          (esSub ? '' : '<div class="form-group"><label for="bt_f_proj">Proyecto <span class="form-required-marker">*</span></label><select id="bt_f_proj" class="form-input" required>' + projOpts + '</select></div>' +
                        '<div class="form-group"><label for="bt_f_sprint">Sprint</label><select id="bt_f_sprint" class="form-input">' + sprintOptsFor(curProj) + '</select></div>') +
          '<div class="form-group"><label for="bt_f_resp">Responsable</label><select id="bt_f_resp" class="form-input">' + respOptsFor(curProj) + '</select></div>' +
          '<div class="form-group"><label for="bt_f_tipo">Tipo</label><select id="bt_f_tipo" class="form-input">' + opt(m.tipos || ['Tarea'], t.tipo) + '</select></div>' +
          '<div class="form-group"><label for="bt_f_estado">Estado</label><select id="bt_f_estado" class="form-input">' + opt(BOARD_ESTADOS, t.estado) + '</select></div>' +
          '<div class="form-group"><label for="bt_f_prio">Prioridad</label><select id="bt_f_prio" class="form-input">' + opt(prioridades, t.prioridad || 'media') + '</select></div>' +
          '<div class="form-group"><label for="bt_f_fecha">Inicio</label><input type="date" id="bt_f_fecha" class="form-input" value="' + esc(dstr(t.fecha) || '') + '"></div>' +
          '<div class="form-group"><label for="bt_f_fin">Fin' + (finBloqueada ? ' <i class="fa-solid fa-lock bt-lock" title="Bloqueada"></i>' : '') + '</label>' +
            '<input type="date" id="bt_f_fin" class="form-input" value="' + esc(dstr(t.fecha_fin) || '') + '"' + (finBloqueada ? ' disabled' : '') + '>' +
            (finBloqueada ? '<div class="bt-lock-hint"><i class="fa-solid fa-lock"></i> Pasaron más de 24 h. Reabrí la tarea (pasala a «En curso») para poder cambiarla.</div>' : '') +
          '</div>' +
          '<div class="form-group"><label for="bt_f_horas">Horas</label><input type="number" step="0.5" min="0" id="bt_f_horas" class="form-input" value="' + esc(t.horas != null ? t.horas : '') + '"></div>' +
        '</div>' +
        '<div class="bt-cohint"><i class="fa-solid fa-trophy"></i> Con fecha de inicio y fin: terminá a tiempo y ganás <strong>+2 Turingcoins</strong>; mover la fecha de fin sin terminar cuesta <strong>−3</strong>.</div>' +
        '<div class="form-group"><label>Story points</label>' + chipsHtml(t.puntos) + '</div>' +
        '<div class="form-group"><label for="bt_f_obs">Observaciones</label><textarea id="bt_f_obs" class="form-input" rows="2">' + esc(t.observaciones || '') + '</textarea></div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
          '<button type="submit" class="btn btn-primary" id="bt_save">' + (isNew ? 'Crear' : 'Guardar') + '</button>' +
          (isNew ? '' : '<button type="button" class="btn btn-error btn-small" id="bt_del">Eliminar</button>') +
        '</div>' +
      '</form>' +
    '</div>' +
    (!isNew && !esSub ? '<div class="glass-panel" id="bt_subs_panel" style="padding:24px;max-width:660px;margin-top:16px;"></div>' : '') +
    '<div class="glass-panel" id="bt_files_panel" style="padding:24px;max-width:660px;margin-top:16px;"></div>';

  var puntosSel = (t.puntos != null ? String(t.puntos) : '');
  var pendientes = [];   // adjuntos en cola: se suben al tocar Guardar/Crear
  el('bt_back').addEventListener('click', boardRender);
  if (el('bt_goparent')) el('bt_goparent').addEventListener('click', function () { if (padre) boardEdit(padre); });
  if (el('bt_f_proj')) el('bt_f_proj').addEventListener('change', function () {
    el('bt_f_resp').innerHTML = respOptsFor(Number(this.value));
    el('bt_f_sprint').innerHTML = sprintOptsFor(Number(this.value));
  });
  el('bt_f_pts').querySelectorAll('.sp-chip').forEach(function (c) {
    c.addEventListener('click', function () {
      el('bt_f_pts').querySelectorAll('.sp-chip').forEach(function (x) { x.classList.remove('active'); });
      c.classList.add('active'); puntosSel = c.getAttribute('data-v');
    });
  });
  function subirPendientes(tid) {
    if (!tid || !pendientes.length) return Promise.resolve();
    return pendientes.reduce(function (chain, f) {
      return chain.then(function () {
        return API.request('/api/board/tasks/' + tid + '/files', { method: 'POST', body: JSON.stringify({ nombre: f.nombre, data: f.data }) });
      });
    }, Promise.resolve());
  }

  el('btForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var finField = el('bt_f_fin');
    var finVal = finField.disabled ? (dstr(t.fecha_fin) || null) : (finField.value || null);
    var finAntes = dstr(t.fecha_fin) || null;
    if (!isNew && finAntes && finVal && finVal !== finAntes && el('bt_f_estado').value !== ESTADO_FINAL) {
      var msg = (finVal > finAntes)
        ? 'Vas a mover la fecha de Fin más adelante. Si la tarea no termina a tiempo, esto te descuenta 3 Turingcoins.\n¿Seguro que querés cambiarla?'
        : 'Vas a cambiar la fecha de Fin de esta tarea.\n¿Seguro?';
      if (!confirm(msg)) return;
    }
    var btn = el('bt_save'); btn.disabled = true; btn.textContent = 'Guardando...';
    var body = {
      titulo: el('bt_titulo').value.trim(),
      project_id: el('bt_f_proj') ? (el('bt_f_proj').value || null) : (esSub ? (padre ? padre.project_id : t.project_id) : t.project_id),
      sprint_id: el('bt_f_sprint') ? (el('bt_f_sprint').value || null) : (esSub ? (padre ? padre.sprint_id : t.sprint_id) : t.sprint_id),
      parent_id: t.parent_id || null,
      assignee_id: el('bt_f_resp').value || null, tipo: el('bt_f_tipo').value, estado: el('bt_f_estado').value,
      prioridad: el('bt_f_prio').value,
      fecha: el('bt_f_fecha').value || null, fecha_fin: finVal,
      horas: el('bt_f_horas').value, puntos: puntosSel === '' ? null : puntosSel,
      observaciones: el('bt_f_obs').value.trim()
    };
    var req = isNew
      ? API.request('/api/board/tasks', { method: 'POST', body: JSON.stringify(body) })
      : API.request('/api/board/tasks/' + t.id, { method: 'PUT', body: JSON.stringify(body) });
    req.then(function (r) { return subirPendientes(isNew ? (r && r.id) : t.id); })
      .then(function () {
        showAlert(isNew ? 'Creado.' : 'Guardado.', 'success');
        if (isNew && esSub && padre) { reloadBoardTasks().then(function () { boardEdit(boardTareaLocal(padre.id) || padre); }); }
        else viewBoard();
      }).catch(function (err) { showAlert(err.message, 'error'); btn.disabled = false; btn.textContent = isNew ? 'Crear' : 'Guardar'; });
  });
  var del = el('bt_del');
  if (del) del.addEventListener('click', function () {
    if (!confirm(esSub ? '¿Eliminar esta subtarea?' : '¿Eliminar esta tarea y sus subtareas?')) return;
    API.request('/api/board/tasks/' + t.id, { method: 'DELETE' })
      .then(function () {
        showAlert('Eliminado.', 'success');
        if (esSub && padre) { reloadBoardTasks().then(function () { boardEdit(boardTareaLocal(padre.id) || padre); }); }
        else viewBoard();
      })
      .catch(function (err) { showAlert(err.message, 'error'); });
  });

  if (!isNew && !esSub) renderSubtareasPanel(t);
  renderAdjuntosPanel(t, pendientes);
}

/* ---- Panel de subtareas ---- */
export function renderSubtareasPanel(t) {
  var box = el('bt_subs_panel'); if (!box) return;
  var subs = boardSubtareas(t.id).sort(function (a, b) { return (a.orden || 0) - (b.orden || 0) || a.id - b.id; });
  var hechas = subs.filter(function (s) { return s.estado === ESTADO_FINAL; }).length;
  var pct = subs.length ? Math.round(hechas / subs.length * 100) : 0;
  var members = (boardState.meta.membersByProject || {})[t.project_id] || [];
  var respOpts = '<option value="">Responsable…</option>' + members.map(function (u) { return '<option value="' + u.id + '">' + esc(u.name) + '</option>'; }).join('');

  var lista = subs.map(function (s) {
    var done = s.estado === ESTADO_FINAL;
    return '<div class="sub-row">' +
      '<button type="button" class="sub-check ' + (done ? 'on' : '') + '" data-toggle="' + s.id + '" title="' + (done ? 'Reabrir' : 'Marcar finalizada') + '"><i class="fa-solid ' + (done ? 'fa-circle-check' : 'fa-circle') + '"></i></button>' +
      '<span class="sub-title ' + (done ? 'done' : '') + '" data-open="' + s.id + '">' + esc(s.titulo) + '</span>' +
      (s.responsable ? '<span class="bt-resp" title="' + esc(s.responsable) + '">' + esc(initials(s.responsable)) + '</span>' : '') +
      (s.fecha_fin ? '<span class="text-gray text-xs">' + fmtDate(s.fecha_fin) + '</span>' : '') +
    '</div>';
  }).join('') || '<p class="text-gray text-xs" style="margin:6px 0 10px;">Sin subtareas todavía.</p>';

  box.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;">' +
      '<div class="section-heading" style="text-align:left;margin:0;">Subtareas ' + (subs.length ? '(' + hechas + '/' + subs.length + ')' : '') + '</div>' +
    '</div>' +
    (subs.length ? '<div class="spr-bar" style="margin-bottom:12px;"><div class="spr-bar-fill" style="width:' + pct + '%;"></div></div>' : '') +
    '<div class="sub-list">' + lista + '</div>' +
    '<form id="subAddForm" class="sub-add">' +
      '<input id="sub_titulo" class="form-input" placeholder="Nueva subtarea…" required>' +
      '<select id="sub_resp" class="form-input" style="max-width:150px;">' + respOpts + '</select>' +
      '<input type="date" id="sub_fin" class="form-input" style="max-width:150px;" title="Fecha de fin">' +
      '<button type="submit" class="btn btn-primary btn-small"><i class="fa-solid fa-plus"></i></button>' +
    '</form>' +
    '<div class="text-gray text-xs" style="margin-top:6px;">Tip: hacé clic en una subtarea para abrir su ficha completa (fechas, puntos, adjuntos).</div>';

  box.querySelectorAll('[data-open]').forEach(function (n) {
    n.addEventListener('click', function () { var s = boardTareaLocal(this.getAttribute('data-open')); if (s) boardEdit(s); });
  });
  box.querySelectorAll('[data-toggle]').forEach(function (n) {
    n.addEventListener('click', function () {
      var s = boardTareaLocal(this.getAttribute('data-toggle')); if (!s) return;
      var nuevo = s.estado === ESTADO_FINAL ? 'En curso' : ESTADO_FINAL;
      API.request('/api/board/tasks/' + s.id + '/estado', { method: 'PATCH', body: JSON.stringify({ estado: nuevo }) })
        .then(function () { return reloadBoardTasks(); })
        .then(function () { renderSubtareasPanel(boardTareaLocal(t.id) || t); refreshBell && refreshBell(); })
        .catch(function (err) { showAlert(err.message, 'error'); });
    });
  });
  el('subAddForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var body = {
      titulo: el('sub_titulo').value.trim(), parent_id: t.id, project_id: t.project_id,
      assignee_id: el('sub_resp').value || null, fecha_fin: el('sub_fin').value || null,
      estado: 'Tareas por hacer', tipo: 'Tarea', prioridad: 'media'
    };
    if (!body.titulo) return;
    API.request('/api/board/tasks', { method: 'POST', body: JSON.stringify(body) })
      .then(function () { return reloadBoardTasks(); })
      .then(function () { renderSubtareasPanel(boardTareaLocal(t.id) || t); })
      .catch(function (err) { showAlert(err.message, 'error'); });
  });
}

/* ---- Panel de adjuntos (imágenes / PDF): pegar, arrastrar o elegir; se guardan al Guardar ---- */
export function renderAdjuntosPanel(t, pendientes) {
  var box = el('bt_files_panel'); if (!box) return;
  var isNew = !t.id;
  var serverFiles = [];

  function tarjeta(vista, nombre, delAttr, pending) {
    return '<div class="file-card' + (pending ? ' pending' : '') + '">' +
      (pending ? '<span class="file-tag">sin guardar</span>' : '') +
      '<span class="file-open">' + vista + '</span>' +
      '<div class="file-cap"><span title="' + esc(nombre) + '">' + esc((nombre || '').slice(0, 22)) + '</span>' +
        '<button type="button" class="file-del" ' + delAttr + ' title="' + (pending ? 'Quitar' : 'Eliminar') + '"><i class="fa-solid fa-xmark"></i></button></div>' +
    '</div>';
  }
  function vistaDe(src, esImg, nombre) {
    return esImg ? '<img src="' + src + '" alt="' + esc(nombre || '') + '">' : '<div class="file-pdf"><i class="fa-solid fa-file-pdf"></i></div>';
  }

  function render() {
    var cards = serverFiles.map(function (f) {
      return tarjeta(
        '<a href="' + f.data + '" target="_blank" rel="noopener" class="file-open">' + vistaDe(f.data, /^image\//.test(f.mime || ''), f.nombre) + '</a>',
        f.nombre, 'data-del="' + f.id + '"', false
      );
    });
    var pend = pendientes.map(function (f, i) {
      return tarjeta(vistaDe(f.data, /^data:image\//.test(f.data), f.nombre), f.nombre, 'data-pend="' + i + '"', true);
    });
    var grid = cards.concat(pend).join('') || '<span class="text-gray text-xs">Sin adjuntos.</span>';
    box.innerHTML =
      '<div class="section-heading" style="text-align:left;margin-bottom:10px;">Adjuntos</div>' +
      '<div class="files-grid">' + grid + '</div>' +
      '<div class="bt-drop" id="bt_drop"><i class="fa-solid fa-arrow-up-from-bracket"></i>' +
        'Arrastrá, <strong>pegá (Ctrl+V)</strong> o hacé clic para elegir imagen o PDF' +
        '<input type="file" id="bt_file_input" accept="image/*,application/pdf" multiple hidden></div>' +
      '<div class="text-gray text-xs" style="margin-top:6px;">Máx 5 MB por archivo. Se guardan al tocar «' + (isNew ? 'Crear' : 'Guardar') + '» abajo.</div>';

    var drop = el('bt_drop');
    drop.addEventListener('click', function (e) { if (e.target.tagName !== 'INPUT') el('bt_file_input').click(); });
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('drag'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('drag'); });
    drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('drag'); encolar(e.dataTransfer.files); });
    el('bt_file_input').addEventListener('change', function () { encolar(this.files); this.value = ''; });
    box.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!confirm('¿Eliminar este adjunto?')) return;
        API.request('/api/board/files/' + this.getAttribute('data-del'), { method: 'DELETE' }).then(cargar).catch(function (err) { showAlert(err.message, 'error'); });
      });
    });
    box.querySelectorAll('[data-pend]').forEach(function (b) {
      b.addEventListener('click', function () { pendientes.splice(Number(b.getAttribute('data-pend')), 1); render(); });
    });
  }

  function encolar(fileList) {
    Array.prototype.slice.call(fileList || []).forEach(function (file) {
      if (!/^image\/|^application\/pdf/.test(file.type || '')) { showAlert('"' + (file.name || 'archivo') + '": tipo no admitido.', 'warning'); return; }
      if (file.size > 5 * 1024 * 1024) { showAlert('"' + (file.name || 'archivo') + '" supera los 5 MB.', 'warning'); return; }
      var reader = new FileReader();
      reader.onload = function () {
        pendientes.push({ nombre: file.name || ('captura-' + Date.now() + (/pdf/.test(file.type) ? '.pdf' : '.png')), data: reader.result });
        render();
      };
      reader.readAsDataURL(file);
    });
  }

  function cargar() {
    if (isNew) { render(); return Promise.resolve(); }
    return API.request('/api/board/tasks/' + t.id + '/files').then(function (r) { serverFiles = r.files || []; render(); });
  }

  function onPaste(e) {
    if (!document.getElementById('bt_files_panel')) { document.removeEventListener('paste', onPaste); pasteState.handler = null; return; }
    var items = (e.clipboardData || {}).items || [];
    var fs = [];
    for (var i = 0; i < items.length; i++) { if (items[i].kind === 'file') fs.push(items[i].getAsFile()); }
    if (fs.length) { e.preventDefault(); encolar(fs); }
  }
  if (pasteState.handler) document.removeEventListener('paste', pasteState.handler);
  pasteState.handler = onPaste;
  document.addEventListener('paste', onPaste);

  cargar();
}

export var DIAS_SEMANA = [[1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'], [5, 'Viernes'], [6, 'Sábado'], [0, 'Domingo']];
export function viewAutoSprint() {
  return API.request('/api/board/auto-sprint').then(function (r) {
    var cfg = r.config || {};
    var propios = (cfg.project_ids && cfg.project_ids.length) ? cfg.project_ids.map(Number) : [];
    var efectivos = (r.project_ids_efectivos || []).map(Number);
    var checks = (r.projects || []).map(function (p) {
      var on = propios.length ? propios.indexOf(p.id) !== -1 : efectivos.indexOf(p.id) !== -1;
      return '<label class="as-check"><input type="checkbox" value="' + p.id + '"' + (on ? ' checked' : '') + '> ' + esc(p.nombre) + '</label>';
    }).join('');
    var diaOpts = DIAS_SEMANA.map(function (d) { return '<option value="' + d[0] + '"' + (Number(cfg.dia_inicio) === d[0] ? ' selected' : '') + '>' + d[1] + '</option>'; }).join('');

    el('view').innerHTML =
      '<div class="glass-panel" style="padding:24px;max-width:640px;">' +
        '<div class="section-heading" style="text-align:left;margin-bottom:6px;">Sprints semanales automáticos</div>' +
        '<p class="text-gray text-xs mb-3">El sistema crea un sprint por semana para los proyectos marcados. Las tareas sin sprint entran solas al sprint de la semana; al empezar la semana nueva, lo no finalizado pasa al sprint nuevo (con su penalización de Turingcoins).</p>' +
        '<form id="asForm">' +
          '<label class="as-check" style="font-weight:600;margin-bottom:14px;"><input type="checkbox" id="as_activo"' + (cfg.activo !== false ? ' checked' : '') + '> Automatización activada</label>' +
          '<div class="form-group"><label>Proyectos con sprint semanal</label><div style="display:flex;flex-direction:column;gap:6px;margin-top:4px;">' + checks + '</div>' +
            '<div class="text-gray text-xs" style="margin-top:6px;">Si no marcás ninguno, se usan "Turingtech" y "Prospectos" por defecto.</div></div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">' +
            '<div class="form-group"><label for="as_dia">La semana empieza el</label><select id="as_dia" class="form-input">' + diaOpts + '</select></div>' +
            '<div class="form-group"><label for="as_prefijo">Prefijo del nombre</label><input id="as_prefijo" class="form-input" value="' + esc(cfg.prefijo || 'Sprint semanal') + '"></div>' +
          '</div>' +
          '<div style="display:flex;gap:8px;align-items:center;">' +
            '<button type="submit" class="btn btn-primary" id="as_save">Guardar</button>' +
            '<button type="button" class="btn btn-secondary btn-small" id="as_run"><i class="fa-solid fa-rotate"></i> Revisar ahora</button>' +
          '</div>' +
        '</form>' +
      '</div>';

    function body() {
      return {
        activo: el('as_activo').checked,
        project_ids: Array.prototype.map.call(el('asForm').querySelectorAll('input[type=checkbox]:not(#as_activo):checked'), function (c) { return Number(c.value); }),
        dia_inicio: Number(el('as_dia').value),
        prefijo: el('as_prefijo').value.trim()
      };
    }
    el('asForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = el('as_save'); btn.disabled = true; btn.textContent = 'Guardando...';
      API.request('/api/board/auto-sprint', { method: 'PUT', body: JSON.stringify(body()) })
        .then(function () { showAlert('Configuración guardada y aplicada.', 'success'); viewAutoSprint(); })
        .catch(function (err) { showAlert(err.message, 'error'); btn.disabled = false; btn.textContent = 'Guardar'; });
    });
    el('as_run').addEventListener('click', function () {
      var b = this; b.disabled = true;
      API.request('/api/board/auto-sprint/run', { method: 'POST', body: '{}' })
        .then(function () { showAlert('Sprints semanales revisados.', 'success'); })
        .catch(function (err) { showAlert(err.message, 'error'); })
        .then(function () { b.disabled = false; });
    });
  });
}

/* ===== Humanizador de texto ===== */
