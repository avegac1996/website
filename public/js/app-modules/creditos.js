// Portal de cliente: solicitar créditos, mis solicitudes, historial,
// notificaciones. Dividido del <script> monolítico de app.html.
import { API } from '../api-bridge.js';
import { el, esc, chipEstado, fmtDate, fmtDateTime, statusLabel, STATUS_VARIANTE, loadDashboard, refreshBell } from './core.js';

export var CREDIT_TYPES = [
  { id: 'rpa',         name: 'Automatización RPA',         icon: 'fa-robot',            desc: 'Bots para procesos operativos y bancarios.' },
  { id: 'bi',          name: 'Business Intelligence',      icon: 'fa-chart-line',       desc: 'Dashboards y control financiero.' },
  { id: 'software',    name: 'Desarrollo de Software',     icon: 'fa-code',             desc: 'Aplicaciones y sistemas a medida.' },
  { id: 'integracion', name: 'Integración de Sistemas',    icon: 'fa-diagram-project',  desc: 'APIs y conectores entre plataformas.' },
  { id: 'zerolicense', name: 'Consultoría Zero-License',   icon: 'fa-scale-balanced',   desc: 'Reducción de costos de licenciamiento.' },
  { id: 'ia',          name: 'Agentes de IA y WhatsApp',   icon: 'fa-comment-dots',     desc: 'Asistentes inteligentes y chatbots.' }
];
// Paquetes de créditos (escalonado, tope 2000). Debe coincidir con CREDIT_TIERS en src/routes/credit.routes.js
export var CREDIT_TIERS = [
  { credits: 200,  label: 'Automatización puntual', desc: 'Un script o bot simple, una sola tarea.' },
  { credits: 500,  label: 'Bot RPA / BI básico',    desc: 'Proceso con integración o dashboard.' },
  { credits: 1000, label: 'Módulo a medida',        desc: 'Integración de sistemas o app acotada.' },
  { credits: 1500, label: 'Sistema mediano',        desc: 'Varios procesos o módulos conectados.' },
  { credits: 2000, label: 'Proyecto completo',      desc: 'Plataforma o solución integral.' }
];
export var PRIORIDADES = ['Baja', 'Media', 'Alta'];


export function viewSolicitar() {
  // Asistente estilo AWS/Azure: 1) tipo de crédito  2) detalles  3) revisar y enviar
  var w = { step: 1, typeId: null, credits: '', project: '', prioridad: 'Media', inicio: '', justificacion: '' };
  var typeOf = function () { return CREDIT_TYPES.filter(function (t) { return t.id === w.typeId; })[0]; };

  function steps() {
    var labels = ['Tipo de crédito', 'Detalles de la solicitud', 'Revisar y enviar'];
    return '<div class="wizard-steps">' + labels.map(function (l, i) {
      var n = i + 1, cls = n === w.step ? 'active' : (n < w.step ? 'done' : '');
      return (i ? '<span class="wizard-step sep">/</span>' : '') +
        '<div class="wizard-step ' + cls + '"><span class="num">' + (n < w.step ? '<i class="fa-solid fa-check"></i>' : n) + '</span>' + l + '</div>';
    }).join('') + '</div>';
  }

  function render() {
    var html = steps();
    if (w.step === 1) {
      html += '<div class="glass-panel" style="padding:24px;">' +
        '<div class="section-heading" style="text-align:left;margin-bottom:16px;">¿Para qué tipo de servicio necesitas créditos?</div>' +
        '<div class="choice-grid">' + CREDIT_TYPES.map(function (t) {
          return '<button type="button" class="choice-card ' + (w.typeId === t.id ? 'selected' : '') + '" data-type="' + t.id + '">' +
            '<div class="cc-icon"><i class="fa-solid ' + t.icon + '"></i></div>' +
            '<div class="cc-name">' + esc(t.name) + '</div><div class="cc-desc">' + esc(t.desc) + '</div></button>';
        }).join('') + '</div>' +
        '<div style="margin-top:20px;display:flex;justify-content:flex-end;">' +
          '<button class="btn btn-primary" id="w_next" ' + (w.typeId ? '' : 'disabled') + '>Continuar <i class="fa-solid fa-arrow-right"></i></button>' +
        '</div></div>';
    } else if (w.step === 2) {
      html += '<div class="glass-panel" style="padding:24px;max-width:680px;">' +
        '<div class="text-gray text-sm mb-2">Servicio: <strong class="text-accent">' + esc(typeOf().name) + '</strong></div>' +
        '<div class="form-group"><label>¿Cuántos créditos necesitas? <span class="form-required-marker">*</span></label>' +
          '<div class="tier-grid">' + CREDIT_TIERS.map(function (t) {
            return '<button type="button" class="tier-card ' + (String(w.credits) === String(t.credits) ? 'selected' : '') + '" data-tier="' + t.credits + '">' +
              '<div class="tier-credits">' + t.credits.toLocaleString() + '</div>' +
              '<div class="tier-label">' + esc(t.label) + '</div>' +
              '<div class="tier-desc">' + esc(t.desc) + '</div></button>';
          }).join('') + '</div>' +
          '<div class="text-gray text-xs" style="margin-top:8px;">El equipo ajusta el monto final al aprobar, según el alcance real del proyecto.</div></div>' +
        '<div class="form-group"><label for="w_project">Nombre del proyecto / caso de uso <span class="form-required-marker">*</span></label>' +
          '<input type="text" id="w_project" class="form-input" placeholder="Automatización de conciliaciones bancarias" value="' + esc(w.project) + '"></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">' +
          '<div class="form-group"><label for="w_prio">Prioridad</label><select id="w_prio" class="form-input">' +
            PRIORIDADES.map(function (p) { return '<option ' + (w.prioridad === p ? 'selected' : '') + '>' + p + '</option>'; }).join('') + '</select></div>' +
          '<div class="form-group"><label for="w_inicio">Inicio estimado</label><input type="date" id="w_inicio" class="form-input" value="' + esc(w.inicio) + '"></div>' +
        '</div>' +
        '<div class="form-group"><label for="w_just">Justificación / alcance <span class="form-required-marker">*</span></label>' +
          '<textarea id="w_just" class="form-input" rows="4" placeholder="Describe el alcance, los procesos involucrados y el resultado esperado...">' + esc(w.justificacion) + '</textarea></div>' +
        '<div style="display:flex;justify-content:space-between;">' +
          '<button class="btn btn-secondary" id="w_back"><i class="fa-solid fa-arrow-left"></i> Atrás</button>' +
          '<button class="btn btn-primary" id="w_next">Revisar <i class="fa-solid fa-arrow-right"></i></button>' +
        '</div></div>';
    } else {
      html += '<div class="glass-panel" style="padding:24px;max-width:640px;">' +
        '<div class="section-heading" style="text-align:left;margin-bottom:14px;">Revisa tu solicitud</div>' +
        '<div class="summary-box">' +
          row('Tipo de crédito', typeOf().name) +
          row('Créditos solicitados', parseInt(w.credits, 10).toLocaleString()) +
          row('Proyecto / caso de uso', w.project) +
          row('Prioridad', w.prioridad) +
          row('Inicio estimado', w.inicio || 'Sin definir') +
          row('Justificación', w.justificacion) +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;margin-top:20px;">' +
          '<button class="btn btn-secondary" id="w_back"><i class="fa-solid fa-arrow-left"></i> Atrás</button>' +
          '<button class="btn btn-primary" id="w_submit"><i class="fa-solid fa-paper-plane"></i> Enviar solicitud</button>' +
        '</div></div>';
    }
    el('view').innerHTML = html;
    wire();
  }

  function row(k, v) { return '<div class="sr"><span>' + esc(k) + '</span><span>' + esc(v) + '</span></div>'; }

  function collectStep2() {
    w.project = el('w_project').value.trim();
    w.prioridad = el('w_prio').value;
    w.inicio = el('w_inicio').value;
    w.justificacion = el('w_just').value.trim();
  }

  function wire() {
    var next = el('w_next'), back = el('w_back');
    document.querySelectorAll('[data-type]').forEach(function (b) {
      b.addEventListener('click', function () { w.typeId = this.getAttribute('data-type'); render(); });
    });
    document.querySelectorAll('[data-tier]').forEach(function (c) {
      c.addEventListener('click', function () {
        w.credits = this.getAttribute('data-tier');
        document.querySelectorAll('[data-tier]').forEach(function (n) { n.classList.remove('selected'); });
        this.classList.add('selected');
      });
    });
    if (back) back.addEventListener('click', function () { if (w.step === 2) collectStep2(); w.step--; render(); });
    if (next) next.addEventListener('click', function () {
      if (w.step === 1) { if (!w.typeId) return; w.step = 2; render(); return; }
      if (w.step === 2) {
        collectStep2();
        if (!w.credits || parseInt(w.credits, 10) < 200) return showAlert('Elige un paquete de créditos.', 'warning');
        if (!w.project) return showAlert('Indica el nombre del proyecto.', 'warning');
        if (!w.justificacion) return showAlert('Agrega una justificación.', 'warning');
        w.step = 3; render();
      }
    });
    var submit = el('w_submit');
    if (submit) submit.addEventListener('click', function () {
      submit.disabled = true; submit.textContent = 'Enviando...';
      var desc = '[' + typeOf().name + '] ' + w.project +
        ' — Prioridad: ' + w.prioridad +
        (w.inicio ? ' — Inicio estimado: ' + w.inicio : '') +
        '\n\n' + w.justificacion;
      API.requestCredits(desc, parseInt(w.credits, 10)).then(function () {
        showAlert('Tu solicitud será revisada en los próximos minutos.', 'success');
        location.hash = '#/solicitudes';
        return loadDashboard(true);
      }).catch(function (err) {
        showAlert(err.message, 'error');
        submit.disabled = false; submit.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar solicitud';
      });
    });
  }

  render();
  return Promise.resolve();
}

export function viewSolicitudes() {
  return loadDashboard(true).then(function (d) {
    var rows = (d.requests || []).map(function (r) {
      return '<tr><td>' + esc(r.project_description) + '</td><td>' + (r.requested_credits || 0).toLocaleString() +
        '</td><td>' + chipEstado(statusLabel[r.status] || r.status, { variante: STATUS_VARIANTE[r.status] || 'gray' }) + '</td><td>' +
        fmtDate(r.created_at) + '</td><td>' + esc(r.admin_notes || '—') + '</td></tr>';
    }).join('') || '<tr><td colspan="5" class="text-gray text-center" style="padding:28px 0;">No se encontraron registros.</td></tr>';
    el('view').innerHTML = '<div class="glass-panel" style="padding:24px;"><div class="table-container"><table class="table">' +
      '<thead><tr><th>Proyecto</th><th>Créditos</th><th>Estado</th><th>Fecha</th><th>Notas del admin</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  });
}

export function viewHistorial() {
  return API.request('/api/credits/transactions').then(function (r) {
    var txns = r.transactions || [];
    var rows = txns.map(function (t) {
      return '<tr><td>' + esc(t.description) + '</td><td>' + esc(t.type) + '</td><td style="color:' +
        (t.amount > 0 ? 'var(--color-success)' : 'var(--color-error)') + ';font-weight:700;">' +
        (t.amount > 0 ? '+' : '') + t.amount + '</td><td>' + fmtDate(t.created_at) + '</td></tr>';
    }).join('') || '<tr><td colspan="4" class="text-gray text-center" style="padding:28px 0;">No se encontraron registros.</td></tr>';
    el('view').innerHTML = '<div class="glass-panel" style="padding:24px;"><div class="table-container"><table class="table">' +
      '<thead><tr><th>Descripción</th><th>Tipo</th><th>Monto</th><th>Fecha</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  });
}

export function viewNotificaciones() {
  return API.getNotifications().then(function (r) {
    var list = r.notifications || [];
    el('view').innerHTML = '<div class="glass-panel" style="padding:24px;"><div id="notifWrap" style="display:flex;flex-direction:column;gap:10px;">' +
      (list.map(function (n) {
        return '<div class="notification-item ' + (n.is_read ? '' : 'unread') + '" data-id="' + n.id + '">' +
          '<div class="notif-content"><h4 style="color:var(--color-white);font-size:14px;margin:0 0 4px;">' + esc(n.title) + '</h4>' +
          '<p style="color:var(--color-text);font-size:13px;margin:0;">' + esc(n.message) + '</p>' +
          '<div class="notif-time">' + fmtDateTime(n.created_at) + '</div></div></div>';
      }).join('') || '<p class="text-gray text-center" style="padding:28px 0;">Sin notificaciones.</p>') +
      '</div></div>';
    var items = document.querySelectorAll('#notifWrap .notification-item.unread');
    for (var i = 0; i < items.length; i++) {
      items[i].addEventListener('click', function () {
        var id = this.getAttribute('data-id'); var node = this;
        API.markNotificationRead(id).then(function () { node.classList.remove('unread'); refreshBell(); }).catch(function () {});
      });
    }
  });
}

