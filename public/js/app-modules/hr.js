// Vistas de RRHH/colaborador (Talento y Cultura): certificados, rol de pagos,
// vacaciones, permisos, credencial. Dividido del <script> monolítico de app.html.
import { API } from '../api-bridge.js';
import {
  state, el, esc, chipEstado, avatarHtml, loadingHtml, paintTopbarAvatar,
  fmtDate, statusLabel, STATUS_VARIANTE, refreshBell,
} from './core.js';

export var HR_TYPES = [
  { id: 'certificado_laboral', label: 'Certificado laboral', icon: 'fa-file-lines', dates: false },
  { id: 'rol_pagos',           label: 'Rol de pagos',        icon: 'fa-receipt', dates: false },
  { id: 'vacaciones',          label: 'Vacaciones',          icon: 'fa-umbrella-beach', dates: true },
  { id: 'permiso',             label: 'Permiso',             icon: 'fa-calendar-day', dates: true },
  { id: 'adelanto',            label: 'Adelanto de sueldo',  icon: 'fa-money-bill-wave', dates: false }
];
export var hrLabel = function (t) { var x = HR_TYPES.filter(function (h) { return h.id === t; })[0]; return x ? x.label : t; };

// El menú depende del tipo de cuenta: cliente = créditos; colaborador/admin = áreas de trabajo.

/* ===== Vistas de COLABORADOR (Talento y Cultura) ===== */
// refresca state.me desde el servidor (cargo, vacaciones, turingcoins, foto)
export function refreshMe() {
  return API.getMe().then(function (d) {
    if (d && d.user) { state.me = d.user; paintTopbarAvatar(); }
    return state.me;
  }).catch(function () { return state.me; });
}

export function viewInicioHr() {
  return Promise.all([refreshMe(), API.request('/api/hr/requests')]).then(function (res) {
    var me = state.me;
    var reqs = (res[1] && res[1].requests) || [];
    var vt = me.vacation_total || 0, vu = me.vacation_used || 0;
    var vd = Math.max(vt - vu, 0);

    var docRows = '<tr><td colspan="2" class="text-gray text-center" style="padding:26px 0;">No se encontraron registros.</td></tr>';

    el('view').innerHTML =
    '<div class="dash-grid">' +
      '<div class="glass-panel welcome-card">' +
        '<div class="avatar-lg"' + (me.photo ? ' style="overflow:hidden;padding:0;"' : '') + '>' + avatarHtml(me.name, me.photo) + '</div>' +
        '<div class="w-hi">¡Bienvenid@ ' + esc(me.name) + '!</div>' +
        '<div class="w-sub" style="color:var(--color-accent);font-weight:600;">' + esc(me.position || (me.role === 'admin' ? 'Administrador TURINGTECH' : 'Colaborador TURINGTECH')) + '</div>' +
        (me.company ? '<div class="w-sub">' + esc(me.company) + '</div>' : '') +
      '</div>' +
      '<div class="dash-col">' +
        '<div class="glass-panel" style="padding:24px;">' +
          '<div class="section-heading">Mis vacaciones</div>' +
          '<div class="tile-row">' +
            '<div class="stat-tile"><div class="st-label">Totales</div><div class="st-value">' + vt + '</div></div>' +
            '<div class="stat-tile"><div class="st-label">Gozadas</div><div class="st-value">' + vu + '</div></div>' +
            '<div class="stat-tile"><div class="st-label">Disponibles</div><div class="st-value">' + vd + '</div></div>' +
          '</div>' +
        '</div>' +
        '<div class="glass-panel" style="padding:24px;">' +
          '<div class="section-heading">Turingcoins</div>' +
          '<div class="balance-hero"><i class="fa-solid fa-coins"></i> ' + (me.credits || 0).toLocaleString() + '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="dash-grid-aside">' +
      '<div class="glass-panel" style="padding:24px;">' +
        '<div class="section-heading">Solicitudes</div>' +
        '<button class="btn btn-primary quick-action" onclick="goHr(\'certificado_laboral\')"><i class="fa-solid fa-file-lines"></i> Certificado laboral</button>' +
        '<button class="btn btn-secondary quick-action" onclick="goHr(\'rol_pagos\')"><i class="fa-solid fa-receipt"></i> Rol de pagos</button>' +
        '<button class="btn btn-secondary quick-action" onclick="goHr(\'vacaciones\')"><i class="fa-solid fa-umbrella-beach"></i> Vacaciones</button>' +
      '</div>' +
      '<div class="glass-panel" style="padding:24px;">' +
        '<div class="section-heading">Documentos cargados</div>' +
        '<div class="table-container"><table class="table"><thead><tr><th>Tipo</th><th class="text-right">Acciones</th></tr></thead><tbody>' + docRows + '</tbody></table></div>' +
        '<div class="text-gray text-xs text-center mt-2">Mostrando 0 a 0 de 0 registros</div>' +
      '</div>' +
    '</div>';
  });
}

// ir a "Mis solicitudes" abriendo el formulario con un tipo preseleccionado
window.goHr = function (type) { viewHrSolicitudes._preset = type; location.hash = '#/hr-solicitudes'; };

export function viewCredencial() {
  return refreshMe().then(renderCredencial);
}
export function renderCredencial() {
  var me = state.me;
  var idStr = 'TT-' + String(me.id).padStart(4, '0');
  el('view').innerHTML =
    '<div style="display:flex;justify-content:center;">' +
      '<div class="credential-card">' +
        '<div class="cred-glow-a"></div><div class="cred-glow-b"></div>' +
        '<div class="cred-head">' +
          '<img src="/logo-turingtech-mark.svg" alt="" class="cred-logo">' +
          '<div><div class="cred-brand">TURING<span>TECH</span></div><div class="cred-sub">Credencial de colaborador</div></div>' +
        '</div>' +
        '<div class="cred-avatar"' + (me.photo ? ' style="overflow:hidden;"' : '') + '>' + avatarHtml(me.name, me.photo) + '</div>' +
        '<div class="cred-name">' + esc(me.name) + '</div>' +
        '<div class="cred-role">' + esc(me.position || 'Colaborador') + '</div>' +
        '<div class="cred-fields">' +
          '<div><span>ID</span><strong>' + idStr + '</strong></div>' +
          '<div><span>Área / Empresa</span><strong>' + esc(me.company || 'TURINGTECH Ecuador') + '</strong></div>' +
          '<div><span>Email</span><strong>' + esc(me.email) + '</strong></div>' +
          (me.phone ? '<div><span>Teléfono</span><strong>' + esc(me.phone) + '</strong></div>' : '') +
        '</div>' +
        '<div class="cred-foot">turingtech.com.ec &middot; Documento de identificación interno</div>' +
      '</div>' +
    '</div>' +
    '<p class="text-gray text-center text-sm mt-3">' +
      (me.position ? '' : 'Tu cargo aún no está definido. ') +
      'La foto se cambia en <a href="#/config" style="color:var(--color-accent);">Configuración</a>.</p>';
}

export function viewMiConfig() {
  var me = state.me;
  el('view').innerHTML =
    '<div class="glass-panel" style="padding:28px;max-width:520px;margin-bottom:22px;">' +
      '<div class="section-heading" style="text-align:left;margin-bottom:16px;">Foto de perfil</div>' +
      '<div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap;">' +
        '<div id="cfgPhoto" style="width:84px;height:84px;border-radius:50%;overflow:hidden;background:linear-gradient(135deg,var(--color-accent),var(--color-accent-hover));display:flex;align-items:center;justify-content:center;color:var(--color-white);font-weight:800;font-size:28px;">' + avatarHtml(me.name, me.photo) + '</div>' +
        '<div>' +
          '<input type="file" id="cfg_file" accept="image/png,image/jpeg,image/webp" style="display:none;">' +
          '<button class="btn btn-secondary btn-small" id="cfg_pick"><i class="fa-solid fa-upload"></i> Subir foto</button> ' +
          (me.photo ? '<button class="btn btn-error btn-small" id="cfg_rmphoto">Quitar</button>' : '') +
          '<div class="text-gray text-xs mt-1">JPG o PNG. Se recorta a un cuadrado.</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="glass-panel" style="padding:28px;max-width:520px;">' +
      '<div class="section-heading" style="text-align:left;margin-bottom:16px;">Cambiar mi contraseña</div>' +
      '<form id="pwForm">' +
        '<div class="form-group"><label for="pw_cur">Contraseña actual <span class="form-required-marker">*</span></label><input type="password" id="pw_cur" class="form-input" required autocomplete="current-password"></div>' +
        '<div class="form-group"><label for="pw_new">Nueva contraseña <span class="form-required-marker">*</span></label><input type="password" id="pw_new" class="form-input" required minlength="6" autocomplete="new-password"></div>' +
        '<div class="form-group"><label for="pw_new2">Repetir nueva contraseña <span class="form-required-marker">*</span></label><input type="password" id="pw_new2" class="form-input" required minlength="6" autocomplete="new-password"></div>' +
        '<button type="submit" class="btn btn-primary" id="pw_btn">Actualizar contraseña</button>' +
      '</form>' +
    '</div>';

  function savePhoto(dataUrl) {
    return API.request('/api/hr/profile', { method: 'POST', body: JSON.stringify({ photo: dataUrl }) })
      .then(function () {
        state.me.photo = dataUrl || null;
        paintTopbarAvatar();
        showAlert(dataUrl ? 'Foto actualizada.' : 'Foto quitada.', 'success');
        viewMiConfig();
      }).catch(function (e) { showAlert(e.message, 'error'); });
  }

  el('cfg_pick').addEventListener('click', function () { el('cfg_file').click(); });
  el('cfg_file').addEventListener('change', function () {
    var f = this.files && this.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function (ev) {
      var img = new Image();
      img.onload = function () {
        var size = 256;
        var c = document.createElement('canvas'); c.width = size; c.height = size;
        var ctx = c.getContext('2d');
        var s = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
        savePhoto(c.toDataURL('image/jpeg', 0.85));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(f);
  });
  var rm = el('cfg_rmphoto');
  if (rm) rm.addEventListener('click', function () { savePhoto(''); });

  el('pwForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (el('pw_new').value !== el('pw_new2').value) { showAlert('Las contraseñas nuevas no coinciden.', 'warning'); return; }
    var btn = el('pw_btn'); btn.disabled = true; btn.textContent = 'Actualizando...';
    API.request('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: el('pw_cur').value, new_password: el('pw_new').value })
    }).then(function () {
      showAlert('Contraseña actualizada.', 'success');
      el('pwForm').reset();
    }).catch(function (err) { showAlert(err.message, 'error'); })
      .then(function () { btn.disabled = false; btn.textContent = 'Actualizar contraseña'; });
  });
}

export function viewHrSolicitudes() {
  return API.request('/api/hr/requests').then(function (r) {
    var reqs = r.requests || [];
    var rows = reqs.map(function (x) {
      var rango = x.start_date ? fmtDate(x.start_date) + (x.end_date ? ' → ' + fmtDate(x.end_date) : '') : '—';
      return '<tr><td>' + esc(hrLabel(x.type)) + '</td><td>' + esc(x.details || '—') + '</td><td>' + rango +
        '</td><td>' + chipEstado(statusLabel[x.status] || x.status, { variante: STATUS_VARIANTE[x.status] || 'gray' }) + '</td><td>' +
        fmtDate(x.created_at) + '</td><td>' + esc(x.admin_notes || '—') + '</td></tr>';
    }).join('') || '<tr><td colspan="6" class="text-gray text-center" style="padding:28px 0;">No se encontraron registros.</td></tr>';

    var opts = HR_TYPES.map(function (h) { return '<option value="' + h.id + '">' + h.label + '</option>'; }).join('');

    el('view').innerHTML =
      '<div class="glass-panel" style="padding:24px;margin-bottom:22px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
          '<h2 style="color:var(--color-white);font-size:18px;font-weight:700;"><i class="fa-solid fa-paper-plane" style="color:var(--color-accent);margin-right:8px;"></i>Nueva solicitud</h2>' +
          '<button class="btn btn-secondary btn-small" id="hrToggle">Crear solicitud</button>' +
        '</div>' +
        '<form id="hrForm" style="display:none;margin-top:18px;max-width:560px;">' +
          '<div class="form-group"><label for="hr_type">Tipo <span class="form-required-marker">*</span></label><select id="hr_type" class="form-input">' + opts + '</select></div>' +
          '<div id="hr_dates" style="display:none;"><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">' +
            '<div class="form-group"><label for="hr_start">Desde</label><input type="date" id="hr_start" class="form-input"></div>' +
            '<div class="form-group"><label for="hr_end">Hasta</label><input type="date" id="hr_end" class="form-input"></div>' +
          '</div></div>' +
          '<div class="form-group"><label for="hr_details">Detalle / motivo</label><textarea id="hr_details" class="form-input" rows="3" placeholder="Información adicional para Talento y Cultura..."></textarea></div>' +
          '<button type="submit" class="btn btn-primary" id="hr_btn"><i class="fa-solid fa-check"></i> Enviar solicitud</button>' +
        '</form>' +
      '</div>' +
      '<div class="glass-panel" style="padding:24px;"><div class="section-heading" style="text-align:left;margin-bottom:14px;">Historial de solicitudes</div>' +
        '<div class="table-container"><table class="table"><thead><tr><th>Tipo</th><th>Detalle</th><th>Fechas</th><th>Estado</th><th>Enviada</th><th>Notas</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '</div>';

    var syncDates = function () {
      var h = HR_TYPES.filter(function (x) { return x.id === el('hr_type').value; })[0];
      el('hr_dates').style.display = (h && h.dates) ? 'block' : 'none';
    };
    el('hr_type').addEventListener('change', syncDates);
    el('hrToggle').addEventListener('click', function () {
      var f = el('hrForm'); f.style.display = f.style.display === 'none' ? 'block' : 'none'; syncDates();
    });

    // Preselección desde los accesos de "Mi espacio"
    if (viewHrSolicitudes._preset) {
      el('hr_type').value = viewHrSolicitudes._preset;
      viewHrSolicitudes._preset = null;
      el('hrForm').style.display = 'block';
      syncDates();
    }
    el('hrForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = el('hr_btn'); btn.disabled = true; btn.textContent = 'Enviando...';
      API.request('/api/hr/requests', {
        method: 'POST',
        body: JSON.stringify({
          type: el('hr_type').value,
          details: el('hr_details').value.trim(),
          start_date: el('hr_start').value || null,
          end_date: el('hr_end').value || null
        })
      }).then(function () {
        showAlert('Solicitud enviada a Talento y Cultura.', 'success');
        viewHrSolicitudes();
      }).catch(function (err) {
        showAlert(err.message, 'error');
        btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-check"></i> Enviar solicitud';
      });
    });
  });
}

export function viewAdminHrSolicitudes() {
  var current = viewAdminHrSolicitudes._status || 'pending';
  function load(status) {
    viewAdminHrSolicitudes._status = status;
    el('view').innerHTML = '<div class="tabs" style="margin-bottom:16px;">' +
      ['pending', 'approved', 'rejected'].map(function (s) {
        return '<button class="tab ' + (s === status ? 'active' : '') + '" data-s="' + s + '">' + statusLabel[s] + '</button>';
      }).join('') + '</div><div id="hrList">' + loadingHtml() + '</div>';
    document.querySelectorAll('.tab[data-s]').forEach(function (t) {
      t.addEventListener('click', function () { load(this.getAttribute('data-s')); });
    });
    return API.request('/api/admin/hr-requests?status=' + status).then(function (r) {
      var list = r.requests || [];
      el('hrList').innerHTML = list.map(function (h) {
        var rango = h.start_date ? fmtDate(h.start_date) + (h.end_date ? ' → ' + fmtDate(h.end_date) : '') : '';
        var actions = status === 'pending'
          ? '<div style="display:flex;gap:8px;margin-top:10px;"><button class="btn btn-success btn-small" data-ap="' + h.id + '">Aprobar</button>' +
            '<button class="btn btn-error btn-small" data-rj="' + h.id + '">Rechazar</button></div>' : '';
        return '<div class="glass-panel" style="padding:18px;margin-bottom:12px;">' +
          '<div style="color:var(--color-white);font-weight:700;">' + esc(hrLabel(h.type)) + (rango ? ' <span class="text-gray text-sm">' + rango + '</span>' : '') + '</div>' +
          '<div class="text-gray text-sm" style="margin-top:6px;">' + esc(h.user_name) + ' (' + esc(h.user_email) + ')' + (h.user_position ? ' &middot; ' + esc(h.user_position) : '') + '</div>' +
          (h.details ? '<div class="text-sm" style="margin-top:4px;">' + esc(h.details) + '</div>' : '') +
          '<div class="text-gray text-xs" style="margin-top:4px;">' + fmtDate(h.created_at) + '</div>' + actions + '</div>';
      }).join('') || '<p class="text-gray text-center" style="padding:28px 0;">No se encontraron registros.</p>';
      document.querySelectorAll('[data-ap]').forEach(function (b) {
        b.addEventListener('click', function () {
          API.request('/api/admin/hr-requests/' + this.getAttribute('data-ap') + '/approve', { method: 'POST', body: '{}' })
            .then(function () { showAlert('Solicitud aprobada.', 'success'); refreshBell(); load('pending'); })
            .catch(function (e) { showAlert(e.message, 'error'); });
        });
      });
      document.querySelectorAll('[data-rj]').forEach(function (b) {
        b.addEventListener('click', function () {
          var notes = prompt('Motivo del rechazo (opcional):') || '';
          API.request('/api/admin/hr-requests/' + this.getAttribute('data-rj') + '/reject', { method: 'POST', body: JSON.stringify({ notes: notes }) })
            .then(function () { showAlert('Solicitud rechazada.', 'success'); refreshBell(); load('pending'); })
            .catch(function (e) { showAlert(e.message, 'error'); });
        });
      });
    });
  }
  return load(current);
}

