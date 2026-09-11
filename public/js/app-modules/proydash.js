// Dashboard de Proyecto (admin): quién trabajó, tareas, timbrado. Dividido
// del <script> monolítico de app.html.
import { API } from '../api-bridge.js';
import { el, esc, fmtDate } from './core.js';

/* ===== Dashboard de Proyecto (admin): quién trabajó, tareas, timbrado ===== */
export function viewProyectoDashboard() {
  return API.request('/api/board/resumen').then(function (r) {
    var proyRows = r.proyectos.map(function (p) {
      return '<tr><td>' + esc(p.proyecto) + '</td>' +
        '<td style="text-align:center;">' + p.abiertas + '</td>' +
        '<td style="text-align:center;color:' + (p.atrasadas ? 'var(--color-error)' : 'inherit') + ';">' + p.atrasadas + '</td>' +
        '<td style="text-align:center;">' + p.finalizadas + '</td></tr>';
    }).join('') || '<tr><td colspan="4" class="text-gray text-xs">Sin proyectos.</td></tr>';

    var respRows = r.por_responsable.map(function (t) {
      return '<tr><td>' + esc(t.responsable) + '</td>' +
        '<td style="text-align:center;">' + t.abiertas + '</td>' +
        '<td style="text-align:center;">' + t.en_curso + '</td>' +
        '<td style="text-align:center;color:' + (t.atrasadas ? 'var(--color-error)' : 'inherit') + ';">' + t.atrasadas + '</td>' +
        '<td style="text-align:center;">' + t.finalizadas_7d + '</td></tr>';
    }).join('') || '<tr><td colspan="5" class="text-gray text-xs">Sin tareas asignadas.</td></tr>';

    var equipo = r.equipo.map(function (u) {
      return '<div class="rz-att">' +
        '<div><strong>' + esc(u.name) + '</strong>' + (u.position ? ' <span class="text-gray text-xs">· ' + esc(u.position) + '</span>' : '') +
          '<div class="text-gray text-xs">' + esc(u.total_horas) + ' esta semana · ' + u.dias + ' día(s)</div></div>' +
        '<span class="rz-att-flag ' + (u.trabajo_hoy ? 'ok' : 'none') + '">' + (u.trabajo_hoy ? 'timbró hoy' : 'sin timbrar hoy') + '</span>' +
      '</div>';
    }).join('');

    var atrasadasList = r.tareas_atrasadas.length
      ? r.tareas_atrasadas.map(function (t) {
          return '<div class="rz-att"><div><strong>' + esc(t.titulo) + '</strong>' +
            '<div class="text-gray text-xs">' + esc(t.proyecto || '') + ' · ' + esc(t.responsable || 'Sin responsable') + '</div></div>' +
            '<span class="rz-att-flag late">venció ' + esc(fmtDate(t.fecha_fin)) + '</span></div>';
        }).join('')
      : '<p class="text-gray text-xs">Ninguna tarea atrasada. 🎉</p>';

    el('view').innerHTML =
      '<div class="rz-grid">' +
        '<div class="glass-panel rz-panel"><div class="section-heading">Por proyecto</div>' +
          '<div class="table-container"><table class="table table-compact"><thead><tr><th>Proyecto</th><th style="text-align:center;">Abiertas</th><th style="text-align:center;">Atrasadas</th><th style="text-align:center;">Finalizadas</th></tr></thead><tbody>' + proyRows + '</tbody></table></div></div>' +
        '<div class="glass-panel rz-panel"><div class="section-heading">Trabajó esta semana <span class="text-gray text-xs">(desde ' + esc(fmtDate(r.semana_desde)) + ')</span></div>' +
          '<div class="rz-attlist">' + (equipo || '<p class="text-gray text-xs">Sin registros.</p>') + '</div></div>' +
      '</div>' +
      '<div class="glass-panel rz-panel" style="margin-top:16px;">' +
        '<div class="section-heading">Tareas por responsable</div>' +
        '<div class="table-container"><table class="table table-compact"><thead><tr><th>Responsable</th><th style="text-align:center;">Abiertas</th><th style="text-align:center;">En curso</th><th style="text-align:center;">Atrasadas</th><th style="text-align:center;">Fin. 7d</th></tr></thead><tbody>' + respRows + '</tbody></table></div>' +
      '</div>' +
      '<div class="glass-panel rz-panel" style="margin-top:16px;">' +
        '<div class="section-heading">Tareas atrasadas <span class="text-gray text-xs">(' + r.tareas_atrasadas.length + ')</span></div>' +
        '<div class="rz-attlist">' + atrasadasList + '</div>' +
      '</div>';
  });
}

