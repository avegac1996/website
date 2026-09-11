// Timbrado (control de jornada): marcar entrada/salida/almuerzo y ver jornadas
// del equipo (admin). Dividido del <script> monolítico de app.html.
import { API } from '../api-bridge.js';
import { el, esc, emptyState, parseDateLocal } from './core.js';

/* ===== Timbrado (control de jornada) ===== */
export var TB_ICONO = { entrada: 'fa-right-to-bracket', almuerzo: 'fa-utensils', regreso: 'fa-mug-hot', salida: 'fa-right-from-bracket' };
export function tbHoras(min) {
  min = Math.max(0, Math.round(min || 0));
  var h = Math.floor(min / 60), m = min % 60;
  return (h ? h + ' h ' : '') + m + ' min';
}
export function fmtDiaLargo(d) {
  var dt = parseDateLocal(d); if (!dt) return d;
  var s = dt.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'short' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function viewTimbrado() {
  return API.request('/api/timbrado/hoy').then(function (hoy) {
    return API.request('/api/timbrado/resumen').then(function (res) { pintarTimbrado(hoy, res); });
  });
}

export function pintarTimbrado(hoy, res) {
  var marcadas = {};
  hoy.marcas.forEach(function (m) { marcadas[m.tipo] = m; });

  var botones = hoy.tipos.map(function (tp) {
    var hecha = marcadas[tp.id];
    var sug = hoy.sugerido === tp.id && !hecha;
    return '<button class="tb-btn' + (hecha ? ' done' : '') + (sug ? ' sug' : '') + '" data-tipo="' + tp.id + '"' + (hecha ? ' disabled' : '') + '>' +
      '<i class="fa-solid ' + TB_ICONO[tp.id] + '"></i>' +
      '<span class="tb-btn-lbl">' + esc(tp.label) + '</span>' +
      '<span class="tb-btn-hora">' + (hecha ? hecha.hora : (sug ? 'Marcar ahora' : '—')) + '</span>' +
    '</button>';
  }).join('');

  var timeline = hoy.marcas.length
    ? hoy.marcas.map(function (m) {
        return '<div class="tb-tl-item"><i class="fa-solid ' + TB_ICONO[m.tipo] + '"></i>' +
          '<span class="tb-tl-lbl">' + esc(m.label) + '</span>' +
          '<span class="tb-tl-hora">' + esc(m.hora) + '</span>' +
          (hoy.esHoy ? '<button class="tb-tl-del" data-del="' + m.id + '" title="Borrar marca">&times;</button>' : '') +
        '</div>';
      }).join('')
    : '<p class="text-gray text-xs" style="margin:4px 0;">Todavía no marcaste nada hoy.</p>';

  var filas = res.dias.slice().reverse().map(function (d) {
    return '<tr><td>' + esc(fmtDiaLargo(d.dia)) + '</td><td>' + esc(d.entrada || '—') + '</td><td>' + esc(d.salida || (d.abierto ? 'en curso' : '—')) +
      '</td><td style="text-align:right;font-weight:600;">' + esc(d.horas || '0m') + '</td></tr>';
  }).join('') || emptyState('Sin registros en el rango.', { colspan: 4 });

  el('view').innerHTML =
    '<div class="glass-panel" style="padding:26px;max-width:640px;">' +
      '<div class="section-heading" style="text-align:left;margin:0 0 4px;">Timbrado · ' + esc(fmtDiaLargo(hoy.dia)) + '</div>' +
      '<p class="text-gray text-xs" style="margin:0 0 18px;">Marcá tu jornada. Horas efectivas = (Salida − Entrada) − almuerzo.</p>' +
      '<div class="tb-grid">' + botones + '</div>' +
      '<div class="tb-hoy">Trabajado hoy: <strong>' + tbHoras(hoy.resumen.minutos) + '</strong>' +
        (hoy.resumen.abierto ? ' <span class="tb-live">● en curso</span>' : '') + '</div>' +
      '<div class="tb-timeline">' + timeline + '</div>' +
    '</div>' +
    '<div class="glass-panel" style="padding:22px;max-width:640px;margin-top:16px;">' +
      '<div class="section-heading" style="text-align:left;margin:0 0 12px;">Últimos días</div>' +
      '<div class="table-container"><table class="table table-compact"><thead><tr><th>Día</th><th>Entrada</th><th>Salida</th><th style="text-align:right;">Horas</th></tr></thead>' +
      '<tbody>' + filas + '</tbody></table></div>' +
      '<div class="tb-total">Total del rango: <strong>' + esc(res.total_horas) + '</strong> · ' + res.dias_con_marca + ' día(s)</div>' +
    '</div>';

  el('view').querySelectorAll('.tb-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      var tipo = b.getAttribute('data-tipo');
      el('view').querySelectorAll('.tb-btn').forEach(function (x) { x.disabled = true; });
      API.request('/api/timbrado/marcar', { method: 'POST', body: JSON.stringify({ tipo: tipo }) })
        .then(function (nuevo) {
          showAlert('Marca registrada: ' + nuevo.marcas[nuevo.marcas.length - 1].label + '.', 'success');
          return API.request('/api/timbrado/resumen').then(function (res2) { pintarTimbrado(nuevo, res2); });
        })
        .catch(function (err) { showAlert(err.message, 'error'); viewTimbrado(); });
    });
  });
  el('view').querySelectorAll('.tb-tl-del').forEach(function (b) {
    b.addEventListener('click', function () {
      if (!confirm('¿Borrar esta marca?')) return;
      API.request('/api/timbrado/' + b.getAttribute('data-del'), { method: 'DELETE' })
        .then(function () { showAlert('Marca borrada.', 'success'); viewTimbrado(); })
        .catch(function (err) { showAlert(err.message, 'error'); });
    });
  });
}

/* ---- Admin: jornadas del equipo ---- */
export function viewTimbradoEquipo() {
  var q = viewTimbradoEquipo._q || {};
  var qs = [];
  if (q.desde) qs.push('desde=' + q.desde);
  if (q.hasta) qs.push('hasta=' + q.hasta);
  return API.request('/api/timbrado/equipo' + (qs.length ? '?' + qs.join('&') : '')).then(function (r) {
    var filas = r.equipo.map(function (u, i) {
      var detalle = u.dias.slice().reverse().map(function (d) {
        return '<div class="tbq-day"><span>' + esc(fmtDiaLargo(d.dia)) + '</span>' +
          '<span class="text-gray text-xs">' + esc(d.entrada || '—') + ' → ' + esc(d.salida || (d.abierto ? 'en curso' : '—')) + '</span>' +
          '<strong>' + esc(d.horas || '0m') + '</strong></div>';
      }).join('') || '<div class="text-gray text-xs" style="padding:6px 0;">Sin marcas en el rango.</div>';
      return '<div class="tbq-row">' +
        '<button class="tbq-head" data-i="' + i + '">' +
          '<span class="tbq-name">' + esc(u.name) + (u.position ? ' <span class="text-gray text-xs">· ' + esc(u.position) + '</span>' : '') + '</span>' +
          '<span class="tbq-tot">' + esc(u.total_horas) + ' <span class="text-gray text-xs">/ ' + u.dias_con_marca + 'd</span> <i class="fa-solid fa-chevron-down"></i></span>' +
        '</button>' +
        '<div class="tbq-detail" id="tbq_d_' + i + '" hidden>' + detalle + '</div>' +
      '</div>';
    }).join('') || emptyState('No hay colaboradores.');

    el('view').innerHTML =
      '<div class="glass-panel" style="padding:24px;max-width:720px;">' +
        '<div class="section-heading" style="text-align:left;margin:0 0 6px;">Jornadas del equipo</div>' +
        '<div class="tbq-range">' +
          '<label>Desde <input type="date" id="tbq_desde" class="form-input" value="' + esc(r.desde) + '"></label>' +
          '<label>Hasta <input type="date" id="tbq_hasta" class="form-input" value="' + esc(r.hasta) + '"></label>' +
          '<button class="btn btn-secondary btn-small" id="tbq_apply">Aplicar</button>' +
        '</div>' +
        '<div class="tbq-list">' + filas + '</div>' +
      '</div>';

    el('tbq_apply').addEventListener('click', function () {
      viewTimbradoEquipo._q = { desde: el('tbq_desde').value || null, hasta: el('tbq_hasta').value || null };
      viewTimbradoEquipo();
    });
    el('view').querySelectorAll('.tbq-head').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = el('tbq_d_' + b.getAttribute('data-i'));
        d.hidden = !d.hidden;
        b.classList.toggle('open', !d.hidden);
      });
    });
  });
}

