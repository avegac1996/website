// Infraestructura compartida por todos los módulos de app.html: estado global,
// utilidades de DOM/formato, y las vistas más simples del shell (Mi espacio).
// Dividido del <script> monolítico de app.html (ver CLAUDE.md).
import { API } from '../api-bridge.js';
import { viewInicioHr } from './hr.js';

export var ROLE_LABELS = { admin: 'Administrador TURINGTECH', user: 'Cliente' };

export function buildMenu() {
  // Clientes: portal de créditos (sin cambios)
  if (state.me.account_type !== 'colaborador') {
    return [{ section: 'Mi espacio', items: [
      { id: 'inicio',         label: 'Mi espacio',         icon: 'fa-house' },
      { id: 'solicitar',      label: 'Solicitar créditos', icon: 'fa-coins' },
      { id: 'solicitudes',    label: 'Mis solicitudes',    icon: 'fa-paper-plane' },
      { id: 'historial',      label: 'Historial',          icon: 'fa-clock-rotate-left' },
      { id: 'notificaciones', label: 'Notificaciones',     icon: 'fa-bell' }
    ] }];
  }
  var admin = state.me.role === 'admin';
  var pick = function (arr) { return arr.filter(Boolean); };
  var menu = [
    { section: 'Mi espacio', items: [
      { id: 'inicio', label: 'Mi espacio', icon: 'fa-house' }
    ] },
    { section: 'CRM', items: pick([
      { id: 'crm-dashboard', label: 'Dashboard',             icon: 'fa-chart-pie' },
      { id: 'crm-tablero',   label: 'Tablero',               icon: 'fa-table-columns' },
      { id: 'prospectos',    label: 'Prospectos y empresas',  icon: 'fa-crosshairs' },
      admin ? { id: 'admin-prospectos', label: 'Estados y actividades', icon: 'fa-tags' } : null
    ]) },
    { section: 'Proyecto', items: pick([
      admin ? { id: 'proy-dashboard', label: 'Dashboard', icon: 'fa-gauge-high' } : null,
      { id: 'board', label: 'Seguimiento de proyectos', icon: 'fa-diagram-project' },
      admin ? { id: 'admin-sprints', label: 'Automatización de sprints', icon: 'fa-calendar-week' } : null
    ]) },
    { section: 'Recursos Humanos', items: pick([
      admin ? { id: 'admin-hr-solicitudes', label: 'Solicitudes RRHH', icon: 'fa-user-clock' }
            : { id: 'hr-solicitudes',       label: 'Mis solicitudes',  icon: 'fa-paper-plane' },
      { id: 'credencial', label: 'Mi credencial', icon: 'fa-id-badge' },
      { id: 'timbrado',   label: 'Timbrado',      icon: 'fa-fingerprint' },
      admin ? { id: 'admin-timbrado', label: 'Jornadas del equipo', icon: 'fa-business-time' } : null
    ]) },
    admin ? { section: 'Administración', items: [
      { id: 'admin-solicitudes', label: 'Solicitudes de créditos', icon: 'fa-inbox' },
      { id: 'admin-usuarios',    label: 'Usuarios',                icon: 'fa-users' },
      { id: 'admin-creditos',    label: 'Modificar créditos',      icon: 'fa-sliders' },
      { id: 'admin-config',      label: 'Configuración',           icon: 'fa-gear' }
    ] } : null,
    { section: 'Otros', items: pick([
      { id: 'humanizador',    label: 'Humanizador',    icon: 'fa-wand-magic-sparkles' },
      { id: 'notificaciones', label: 'Notificaciones', icon: 'fa-bell' },
      admin ? null : { id: 'config', label: 'Configuración', icon: 'fa-gear' }
    ]) }
  ];
  return menu.filter(Boolean);
}


export var pasteState = { handler: null };  // compartido con prospectos.js (un solo listener de "paste" activo a la vez)

export var state = { me: null, menu: [], dashboard: null, users: null };
export var el = function (id) { return document.getElementById(id); };
export var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
  return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
// Valida que "color" sea un hex de 6 dígitos (#rrggbb). Si no lo es (undefined,
// formato corto #fff, nombre de color CSS, etc.) devuelve un gris neutro de
// respaldo en vez de concatenar la opacidad sobre un valor inválido.
export var hexValido = function (color, fallback) {
  fallback = fallback || '#94a3b8';
  return (typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color)) ? color : fallback;
};
// Genera el HTML de un chip de estado/etiqueta, unificando los distintos
// sistemas de badge del CRM. label se escapa acá adentro.
// opts.color: hex dinámico (catálogo de estados de prospectos), tiene prioridad sobre opts.variante.
// opts.variante: paleta fija 'success'|'warning'|'error'|'info'|'accent'|'secondary'|'gray'.
// opts.solido: true = fondo lleno + texto blanco (equivalente al .badge de antes).
// opts.clase: clases extra (ej. 'chip-sm chip-upper').
// opts.style: estilos inline extra a preservar de call-sites puntuales.
export function chipEstado(label, opts) {
  opts = opts || {};
  var cls = 'chip' + (opts.solido ? ' chip-solido' : '') + (opts.clase ? ' ' + opts.clase : '');
  var style = '';
  if (opts.color) {
    var c = hexValido(opts.color);
    style = 'background:' + c + (opts.solido ? '' : '22') + ';color:' + (opts.solido ? '#fff' : c) + ';';
  } else if (opts.variante) {
    cls += ' chip-' + opts.variante;
  }
  if (opts.style) style += opts.style;
  return '<span class="' + cls + '"' + (style ? ' style="' + style + '"' : '') + '">' + esc(label) + '</span>';
}
export var initials = function (name) {
  var p = String(name || '').trim().split(/\s+/).filter(Boolean);
  var s = ((p[0] || '')[0] || '') + ((p[1] || '')[0] || '');
  return (s || 'TT').toUpperCase();
};
// Avatar redondo: foto si existe, si no las iniciales
export var avatarHtml = function (name, photo, sizePx) {
  if (photo) return '<img src="' + photo + '" alt="" style="width:100%;height:100%;object-fit:cover;">';
  return esc(initials(name));
};
// Mensaje de "no hay datos" reutilizable. Por defecto arma un bloque <p>
// centrado para insertar en un contenedor; pasando opts.colspan arma una
// fila <tr><td> lista para reemplazar el <tbody> de una tabla vacía.
export function emptyState(msg, opts) {
  opts = opts || {};
  var pad = opts.padding || '24px';
  var inner = esc(msg);
  return opts.colspan
    ? '<tr><td colspan="' + opts.colspan + '" class="text-gray text-center" style="padding:' + pad + ' 0;">' + inner + '</td></tr>'
    : '<p class="text-gray text-center" style="padding:' + pad + ' 0;">' + inner + '</p>';
}
// Indicador de carga con el spinner ya definido en app.css, para no seguir
// mostrando el texto plano "Cargando...".
export function loadingHtml(msg) {
  return '<div style="display:flex;align-items:center;justify-content:center;gap:8px;padding:24px 0;">' +
    '<span class="spinner"></span>' + (msg ? '<span class="text-gray text-sm">' + esc(msg) + '</span>' : '') + '</div>';
}
export function paintTopbarAvatar() {
  var a = el('userAvatar');
  if (state.me && state.me.photo) {
    a.innerHTML = '<img src="' + state.me.photo + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
    a.style.padding = '0'; a.style.overflow = 'hidden';
  } else {
    a.textContent = initials(state.me ? state.me.name : '');
  }
}
// Parsea una fecha a Date. Si es una fecha pura 'YYYY-MM-DD' (sin hora) la toma
// como fecha LOCAL para que no se corra ±1 día por zona horaria. Los timestamps
// ISO completos se parsean normal.
export var parseDateLocal = function (d) {
  if (!d) return null;
  var s = String(d).trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  var dt = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
};
export var fmtDate = function (d) {
  var dt = parseDateLocal(d);
  return dt ? dt.toLocaleDateString('es-EC', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
};
export var fmtDateTime = function (d) { return d ? new Date(d).toLocaleString('es-EC') : '—'; };
export var isTuringtech = function (u) { return u.role === 'admin' || /@turingtech\.com\.ec\s*$/i.test(u.email || ''); };
export var statusLabel = { pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada' };
export var STATUS_VARIANTE = { pending: 'warning', approved: 'success', rejected: 'error' };

/* ---------- Shell / navegación ---------- */
export function buildSidebar() {
  var html = '';
  state.menu.forEach(function (grp) {
    html += '<div class="nav-section-label">' + esc(grp.section) + '</div>';
    grp.items.forEach(function (it) {
      html += '<a class="nav-item" data-route="' + it.id + '" href="#/' + it.id + '">' +
                '<i class="fa-solid ' + it.icon + '"></i><span>' + esc(it.label) + '</span>' +
                (it.id === 'notificaciones' ? '<span class="nav-badge" data-nav-badge style="display:none;">0</span>' : '') +
              '</a>';
    });
  });
  el('sidebarNav').innerHTML = html;
}

export function menuLookup(routeId) {
  for (var i = 0; i < state.menu.length; i++) {
    for (var j = 0; j < state.menu[i].items.length; j++) {
      if (state.menu[i].items[j].id === routeId) return { section: state.menu[i].section, item: state.menu[i].items[j] };
    }
  }
  return null;
}

export function setActive(routeId) {
  var items = document.querySelectorAll('.nav-item');
  for (var i = 0; i < items.length; i++) items[i].classList.toggle('active', items[i].getAttribute('data-route') === routeId);
}


export function loadDashboard() {
  return API.getDashboard().then(function (d) {
    state.dashboard = d;
    if (d.user) {
      for (var k in d.user) { if (d.user[k] != null) state.me[k] = d.user[k]; }
      el('userChipName').textContent = state.me.name;
      paintTopbarAvatar();
    }
    return d;
  });
}
export function loadUsers(force) {
  if (state.users && !force) return Promise.resolve(state.users);
  return API.getAdminUsers().then(function (r) { state.users = Array.isArray(r) ? r : (r.users || []); return state.users; });
}
export function refreshBell() {
  return API.getNotifications().then(function (r) {
    var list = (r.notifications || r || []);
    var unread = list.filter(function (n) { return !n.is_read; }).length;
    el('bellDot').style.display = unread ? 'block' : 'none';
    el('bellDot').textContent = unread;
    var b = document.querySelector('[data-nav-badge]');
    if (b) { b.style.display = unread ? 'inline-block' : 'none'; b.textContent = unread; }
  }).catch(function () {});
}

/* ---------- Vistas ---------- */
export function viewInicio() {
  return state.me.account_type === 'colaborador' ? viewInicioHr() : viewInicioCliente();
}

export function viewInicioCliente() {
  return loadDashboard().then(function (d) {
    var me = d.user || state.me;
    var txns = d.transactions || [];
    // Usados = créditos consumidos (transacciones negativas). Disponibles = saldo real.
    // Totales = Disponibles + Usados  -> siempre cuadra.
    var spent = txns.filter(function (t) { return t.amount < 0; }).reduce(function (a, t) { return a - t.amount; }, 0);
    var avail = (me && me.credits != null) ? me.credits : 0;
    var totals = avail + spent;

    // Movimientos = transacciones (ingresos y usos, incl. ajustes del admin) + solicitudes no aprobadas
    var acts = [];
    txns.forEach(function (t) {
      acts.push({ date: t.created_at, label: t.description || 'Movimiento de créditos', amount: t.amount });
    });
    (d.requests || []).forEach(function (r) {
      if (r.status === 'approved') return; // ya figura como transacción
      acts.push({ date: r.created_at, label: r.project_description, amount: r.requested_credits, req: r.status });
    });
    acts.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });

    var actRows = acts.slice(0, 8).map(function (a) {
      var monto, estado;
      if (a.req) {
        monto = '<span class="text-gray">' + (a.amount || 0).toLocaleString() + '</span>';
        estado = chipEstado(statusLabel[a.req] || a.req, { variante: STATUS_VARIANTE[a.req] || 'gray' });
      } else if (a.amount < 0) {
        monto = '<span style="color:var(--color-error);font-weight:700;">&minus;' + Math.abs(a.amount).toLocaleString() + '</span>';
        estado = chipEstado('Uso', { variante: 'error' });
      } else {
        monto = '<span style="color:var(--color-success);font-weight:700;">+' + a.amount.toLocaleString() + '</span>';
        estado = chipEstado('Ingreso', { variante: 'success' });
      }
      return '<tr><td>' + esc(a.label) + '</td><td>' + monto + '</td><td>' + estado + '</td><td>' + fmtDate(a.date) + '</td></tr>';
    }).join('') || '<tr><td colspan="4" class="text-gray text-center" style="padding:24px 0;">No se encontraron registros.</td></tr>';

    el('view').innerHTML =
    '<div class="dash-grid">' +
      '<div class="glass-panel welcome-card">' +
        '<div class="avatar-lg">' + esc(initials(me.name)) + '</div>' +
        '<div class="w-hi">¡Bienvenid@ ' + esc(me.name) + '!</div>' +
        '<div class="w-sub">' + esc(ROLE_LABELS[me.role] || me.role) + (me.company ? ' &middot; ' + esc(me.company) : '') + '</div>' +
        '<div class="w-sub">' + esc(me.email) + '</div>' +
      '</div>' +
      '<div class="dash-col">' +
        '<div class="glass-panel" style="padding:24px;">' +
          '<div class="section-heading">Mis créditos</div>' +
          '<div class="tile-row">' +
            '<div class="stat-tile"><div class="st-label">Totales</div><div class="st-value">' + totals.toLocaleString() + '</div></div>' +
            '<div class="stat-tile"><div class="st-label">Usados</div><div class="st-value">' + spent.toLocaleString() + '</div></div>' +
            '<div class="stat-tile"><div class="st-label">Disponibles</div><div class="st-value">' + avail.toLocaleString() + '</div></div>' +
          '</div>' +
        '</div>' +
        '<div class="glass-panel" style="padding:24px;">' +
          '<div class="section-heading">Saldo créditos TURINGTECH</div>' +
          '<div class="balance-hero"><i class="fa-solid fa-coins"></i> ' + avail.toLocaleString() + '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="dash-grid-aside">' +
      '<div class="glass-panel" style="padding:24px;">' +
        '<div class="section-heading">Solicitudes</div>' +
        '<button class="btn btn-primary quick-action" onclick="location.hash=\'#/solicitar\'"><i class="fa-solid fa-coins"></i> Solicitar créditos</button>' +
        '<button class="btn btn-secondary quick-action" onclick="location.hash=\'#/solicitudes\'"><i class="fa-solid fa-paper-plane"></i> Mis solicitudes</button>' +
        '<button class="btn btn-secondary quick-action" onclick="location.hash=\'#/historial\'"><i class="fa-solid fa-clock-rotate-left"></i> Historial</button>' +
      '</div>' +
      '<div class="glass-panel" style="padding:24px;">' +
        '<div class="section-heading">Movimientos recientes</div>' +
        '<div class="table-container"><table class="table"><thead><tr><th>Concepto</th><th>Monto</th><th>Tipo</th><th>Fecha</th></tr></thead><tbody>' + actRows + '</tbody></table></div>' +
      '</div>' +
    '</div>';
  });
}

