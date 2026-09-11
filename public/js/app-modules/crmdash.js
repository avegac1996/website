// Dashboard de prospección (CRM): tiles de resumen, barras por responsable,
// gráfico de actividad y lista de "necesita atención". Dividido del <script>
// monolítico de app.html. Importa PROS de prospectos.js (mutamos sus campos
// tab/sel/from al abrir un prospecto desde acá).
import { API } from '../api-bridge.js';
import { el, esc, emptyState, parseDateLocal, fmtDate } from './core.js';
import { PROS } from './prospectos.js';

/* ===== Admin: Resumen (dashboard prospectos + equipo) ===== */
export function rzTile(label, value, cls) {
  return '<div class="rz-tile ' + (cls || '') + '"><div class="rz-tile-v">' + esc(String(value)) + '</div><div class="rz-tile-l">' + esc(label) + '</div></div>';
}
export function rzBars(rows) {
  var max = Math.max.apply(null, rows.map(function (r) { return r.value; }).concat([1]));
  return '<div class="rz-bars">' + rows.map(function (r) {
    var w = Math.round((r.value / max) * 100);
    return '<div class="rz-bar-row">' +
      '<span class="rz-bar-lbl" title="' + esc(r.label) + '">' + esc(r.label) + '</span>' +
      '<span class="rz-bar-track"><span class="rz-bar-fill" style="width:' + w + '%;background:' + (r.color || 'var(--color-accent)') + ';"></span></span>' +
      '<span class="rz-bar-val">' + esc(String(r.value)) + (r.sub ? ' <span class="text-gray">' + esc(r.sub) + '</span>' : '') + '</span>' +
    '</div>';
  }).join('') + '</div>';
}
export function rzCols(points) {
  var max = Math.max.apply(null, points.map(function (p) { return p.n; }).concat([1]));
  return '<div class="rz-cols">' + points.map(function (p) {
    var h = Math.round((p.n / max) * 100);
    var d = parseDateLocal(p.dia);
    var lbl = d ? (d.getDate() + '/' + (d.getMonth() + 1)) : p.dia;
    return '<div class="rz-col" title="' + esc(lbl + ': ' + p.n) + '">' +
      '<span class="rz-col-n">' + (p.n || '') + '</span>' +
      '<span class="rz-col-bar" style="height:' + Math.max(h, p.n ? 6 : 2) + '%;"></span>' +
      '<span class="rz-col-x">' + esc(lbl) + '</span>' +
    '</div>';
  }).join('') + '</div>';
}
export function abrirProspecto(id) {
  PROS.tab = 'gestion'; PROS.sel = Number(id); PROS.from = null;
  location.hash = '#/prospectos';
}
export var ACT_ICONO = { llamada: 'fa-solid fa-phone', linkedin: 'fa-brands fa-linkedin', whatsapp: 'fa-brands fa-whatsapp', reunion: 'fa-solid fa-handshake', otro: 'fa-solid fa-thumbtack' };
export var ACT_LABEL = { llamada: 'Llamada', linkedin: 'Mensaje LinkedIn', whatsapp: 'Mensaje WhatsApp', reunion: 'Reunión', otro: 'Otra' };

export var CRM_DASH = { gestor: '' };
export function viewResumen() {
  var qs = CRM_DASH.gestor ? '?gestor=' + CRM_DASH.gestor : '';
  return API.request('/api/prospectos/resumen' + qs).then(function (r) {
    var P = r.prospectos, S = P.seguimiento;

    var filtro = r.esAdmin
      ? '<div class="rz-filter"><label for="rz_gestor">Gestor</label><select id="rz_gestor" class="form-input">' +
          '<option value="">Todos</option>' +
          (r.colaboradores || []).map(function (c) { return '<option value="' + c.id + '"' + (String(c.id) === String(CRM_DASH.gestor) ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') +
        '</select></div>'
      : '';

    var pipeline = rzBars(P.por_estado.map(function (e) { return { label: e.label, value: e.count, color: e.color }; }));

    var atencion = P.atencion.length
      ? P.atencion.map(function (a) {
          var txt = a.proxima == null ? 'sin actividad programada'
            : (a.vencidas > 0 ? a.vencidas + ' actividad(es) vencida(s)' : 'próxima: ' + fmtDate(a.proxima));
          return '<div class="rz-att" data-pid="' + a.id + '">' +
            '<div><strong>' + esc(a.empresa) + '</strong>' +
              '<div class="text-gray text-xs">' + esc(a.owner_nombre || 'Sin responsable') + '</div></div>' +
            '<span class="rz-att-flag ' + (a.proxima == null ? 'none' : 'late') + '">' + esc(txt) + '</span>' +
          '</div>';
        }).join('')
      : '<p class="text-gray text-xs">Todos los prospectos tienen su actividad al día. 👌</p>';

    var respRows = P.por_responsable.map(function (u) {
      return '<tr><td>' + esc(u.name) + '</td>' +
        '<td style="text-align:center;">' + u.prospectos + '</td>' +
        '<td style="text-align:center;">' + u.interacciones_7d + '</td>' +
        '<td style="text-align:center;color:' + (u.atrasados ? 'var(--color-error)' : 'inherit') + ';">' + u.atrasados + '</td>' +
        '<td style="text-align:center;color:' + (u.sin_actividad ? 'var(--color-warning)' : 'inherit') + ';">' + u.sin_actividad + '</td></tr>';
    }).join('') || emptyState('Sin datos.', { colspan: 5 });

    el('view').innerHTML =
      (filtro ? '<div class="rz-toolbar">' + filtro + '</div>' : '') +
      '<div class="rz-tiles">' +
        rzTile('Prospectos', P.total, '') +
        rzTile('Al día', S.al_dia, 'ok') +
        rzTile('Atrasados', S.atrasados, 'err') +
        rzTile('Sin actividad', S.sin_actividad, 'warn') +
        rzTile('Con tarea', S.con_tarea, '') +
      '</div>' +
      '<div class="rz-grid">' +
        '<div class="glass-panel rz-panel"><div class="section-heading">Pipeline por estado</div>' + pipeline + '</div>' +
        '<div class="glass-panel rz-panel"><div class="section-heading">Actividad · últimos 14 días</div>' + rzCols(P.actividad_por_dia) +
          '<p class="text-gray text-xs" style="margin-top:8px;">Interacciones registradas + actividades completadas por día.</p></div>' +
      '</div>' +
      '<div class="glass-panel rz-panel" style="margin-top:16px;">' +
        '<div class="section-heading">Necesitan seguimiento <span class="text-gray text-xs">(' + P.atencion.length + ')</span></div>' +
        '<div class="rz-attlist">' + atencion + '</div>' +
      '</div>' +
      '<div class="glass-panel rz-panel" style="margin-top:16px;">' +
        '<div class="section-heading">Por gestor</div>' +
        '<div class="table-container"><table class="table table-compact"><thead><tr><th>Gestor</th><th style="text-align:center;">Prospectos</th><th style="text-align:center;">Interac. 7d</th><th style="text-align:center;">Atrasados</th><th style="text-align:center;">Sin actividad</th></tr></thead><tbody>' + respRows + '</tbody></table></div>' +
      '</div>';

    if (el('rz_gestor')) el('rz_gestor').addEventListener('change', function () { CRM_DASH.gestor = this.value; viewResumen(); });
    el('view').querySelectorAll('.rz-att[data-pid]').forEach(function (n) {
      n.style.cursor = 'pointer';
      n.addEventListener('click', function () { abrirProspecto(n.getAttribute('data-pid')); });
    });
  });
}

