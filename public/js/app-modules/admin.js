// Administración: solicitudes de créditos, usuarios, ajuste de créditos,
// configuración. Dividido del <script> monolítico de app.html.
import { API } from '../api-bridge.js';
import { state, el, esc, chipEstado, avatarHtml, loadingHtml, paintTopbarAvatar, fmtDate, isTuringtech, statusLabel, loadUsers, refreshBell } from './core.js';

export function viewAdminSolicitudes() {
  var current = viewAdminSolicitudes._status || 'pending';
  function load(status) {
    viewAdminSolicitudes._status = status;
    el('view').innerHTML = '<div class="tabs" style="margin-bottom:16px;">' +
      ['pending', 'approved', 'rejected'].map(function (s) {
        return '<button class="tab ' + (s === status ? 'active' : '') + '" data-s="' + s + '">' + statusLabel[s] + '</button>';
      }).join('') + '</div><div id="reqList">' + loadingHtml() + '</div>';
    document.querySelectorAll('.tab[data-s]').forEach(function (t) {
      t.addEventListener('click', function () { load(this.getAttribute('data-s')); });
    });
    return API.getAdminRequests(status).then(function (r) {
      var list = r.requests || [];
      el('reqList').innerHTML = list.map(function (rq) {
        var actions = status === 'pending'
          ? '<div style="display:flex;gap:8px;margin-top:10px;"><button class="btn btn-success btn-small" data-approve="' + rq.id + '">Aprobar</button>' +
            '<button class="btn btn-error btn-small" data-reject="' + rq.id + '">Rechazar</button></div>' : '';
        return '<div class="glass-panel" style="padding:18px;margin-bottom:12px;">' +
          '<div style="color:var(--color-white);font-weight:700;">' + esc(rq.project_description) + '</div>' +
          '<div class="text-gray text-sm" style="margin-top:6px;">' + esc(rq.user_name) + ' (' + esc(rq.user_email) + ')' +
          (rq.user_company ? ' &middot; ' + esc(rq.user_company) : '') + '</div>' +
          '<div class="text-sm" style="margin-top:4px;">Créditos: <strong class="text-accent">' + (rq.requested_credits || 0).toLocaleString() + '</strong>' +
          ' &middot; ' + fmtDate(rq.created_at) + '</div>' + actions + '</div>';
      }).join('') || '<p class="text-gray text-center" style="padding:28px 0;">No se encontraron registros.</p>';
      document.querySelectorAll('[data-approve]').forEach(function (b) {
        b.addEventListener('click', function () {
          API.approveRequest(this.getAttribute('data-approve')).then(function () {
            showAlert('Solicitud aprobada.', 'success'); state.users = null; state.dashboard = null; refreshBell(); load('pending');
          }).catch(function (e) { showAlert(e.message, 'error'); });
        });
      });
      document.querySelectorAll('[data-reject]').forEach(function (b) {
        b.addEventListener('click', function () {
          var notes = prompt('Motivo del rechazo (opcional):') || '';
          API.rejectRequest(this.getAttribute('data-reject'), notes).then(function () {
            showAlert('Solicitud rechazada.', 'success'); state.dashboard = null; refreshBell(); load('pending');
          }).catch(function (e) { showAlert(e.message, 'error'); });
        });
      });
    });
  }
  return load(current);
}

export function userCard(u) {
  var inactive = u.active === false;
  var badge = u.role === 'admin' ? chipEstado('ADMIN', { variante: 'accent', solido: true, style: 'font-size:10px;margin-left:6px;' }) : '';
  var offBadge = inactive ? chipEstado('DESACTIVADO', { variante: 'error', solido: true, style: 'font-size:10px;margin-left:6px;' }) : '';
  var pend = Number(u.pending_requests) > 0 ? chipEstado(u.pending_requests + ' pend.', { variante: 'info', solido: true, style: 'font-size:10px;margin-left:6px;' }) : '';
  var toggleCls = inactive ? 'btn-success' : 'btn-error';
  var toggleTxt = inactive ? 'Activar' : 'Desactivar';
  return '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);border-radius:10px;' + (inactive ? 'opacity:0.6;' : '') + '">' +
    '<div style="flex:1;min-width:200px;"><div style="color:var(--color-white);font-weight:600;font-size:14px;">' + esc(u.name) + badge + offBadge + pend + '</div>' +
    '<div class="text-gray text-xs">' + esc(u.email) + (u.position ? ' | ' + esc(u.position) : '') + ' | ' + esc(u.company || 'Sin empresa') + ' | ' + (u.account_type === 'colaborador' ? 'Colaborador' : 'Cliente') + '</div></div>' +
    '<div style="text-align:right;">' +
      '<div style="color:var(--color-accent);font-weight:700;font-size:16px;">' + (u.credits || 0).toLocaleString() +
        ' <span class="text-gray text-xs" style="font-weight:400;">' + (u.account_type === 'colaborador' ? 'Turingcoins' : 'créditos') + '</span></div>' +
      '<div style="display:flex;gap:6px;margin-top:8px;justify-content:flex-end;flex-wrap:wrap;">' +
        '<button class="btn btn-secondary btn-small" data-edit="' + u.id + '">Modificar</button>' +
        '<button class="btn ' + toggleCls + ' btn-small" data-toggle="' + u.id + '" data-make="' + (inactive ? '1' : '0') + '">' + toggleTxt + '</button>' +
      '</div>' +
    '</div></div>';
}

export function wireUserActions() {
  document.querySelectorAll('[data-toggle]').forEach(function (b) {
    b.addEventListener('click', function () {
      var id = this.getAttribute('data-toggle');
      var make = this.getAttribute('data-make') === '1';
      API.request('/api/admin/users/' + id + '/active', { method: 'PATCH', body: JSON.stringify({ active: make }) })
        .then(function () { showAlert(make ? 'Usuario activado.' : 'Usuario desactivado.', 'success'); state.users = null; viewAdminUsuarios(); })
        .catch(function (e) { showAlert(e.message, 'error'); });
    });
  });
  document.querySelectorAll('[data-edit]').forEach(function (b) {
    b.addEventListener('click', function () {
      var id = this.getAttribute('data-edit');
      var u = (state.users || []).filter(function (x) { return String(x.id) === String(id); })[0];
      if (u) viewAdminUsuarioEdit(u);
    });
  });
}

export function viewAdminUsuarioEdit(u) {
  el('view').innerHTML =
    '<button class="btn btn-secondary btn-small" id="euBack"><i class="fa-solid fa-arrow-left"></i> Volver a usuarios</button>' +
    '<div class="glass-panel" style="padding:28px;max-width:600px;margin-top:14px;">' +
      '<div class="section-heading" style="text-align:left;margin-bottom:16px;">Modificar: ' + esc(u.name) + '</div>' +
      '<form id="euForm"><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">' +
        '<div class="form-group"><label for="eu_name">Nombre <span class="form-required-marker">*</span></label><input id="eu_name" class="form-input" value="' + esc(u.name) + '" required></div>' +
        '<div class="form-group"><label for="eu_email">Email <span class="form-required-marker">*</span></label><input id="eu_email" type="email" class="form-input" value="' + esc(u.email) + '" required></div>' +
        '<div class="form-group"><label for="eu_type">Tipo de cuenta</label><select id="eu_type" class="form-input">' +
          '<option value="cliente"' + (u.account_type !== 'colaborador' ? ' selected' : '') + '>Cliente (portal de créditos)</option>' +
          '<option value="colaborador"' + (u.account_type === 'colaborador' ? ' selected' : '') + '>Colaborador TURINGTECH (portal RRHH)</option>' +
        '</select></div>' +
        '<div class="form-group"><label for="eu_role">Rol</label><select id="eu_role" class="form-input">' +
          '<option value="user"' + (u.role !== 'admin' ? ' selected' : '') + '>Usuario</option>' +
          '<option value="admin"' + (u.role === 'admin' ? ' selected' : '') + '>Administrador</option>' +
        '</select></div>' +
        '<div class="form-group"><label for="eu_position">Cargo</label><input id="eu_position" class="form-input" value="' + esc(u.position || '') + '"></div>' +
        '<div class="form-group"><label for="eu_company">Empresa</label><input id="eu_company" class="form-input" value="' + esc(u.company || '') + '"></div>' +
        '<div class="form-group"><label for="eu_phone">Teléfono</label><input id="eu_phone" class="form-input" value="' + esc(u.phone || '') + '"></div>' +
        '<div class="form-group"><label for="eu_pass">Nueva contraseña</label><input id="eu_pass" type="text" class="form-input" placeholder="vacío = no cambiar" minlength="6"></div>' +
        '<div class="form-group eu-col"><label for="eu_vt">Días de vacaciones (total)</label><input id="eu_vt" type="number" min="0" class="form-input" value="' + (u.vacation_total || 0) + '"></div>' +
        '<div class="form-group eu-col"><label for="eu_vu">Vacaciones gozadas</label><input id="eu_vu" type="number" min="0" class="form-input" value="' + (u.vacation_used || 0) + '"></div>' +
      '</div>' +
      '<p class="text-gray text-xs mt-1">Los ' + (u.account_type === 'colaborador' ? 'Turingcoins' : 'créditos') + ' se ajustan en <strong>Administración → Modificar créditos</strong>.</p>' +
      '<button type="submit" class="btn btn-primary" id="eu_btn">Guardar cambios</button></form>' +
    '</div>';

  el('euBack').addEventListener('click', function () { viewAdminUsuarios(); });
  el('euForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = el('eu_btn'); btn.disabled = true; btn.textContent = 'Guardando...';
    if (el('eu_type').value === 'colaborador' && !el('eu_position').value.trim()) {
      showAlert('El cargo es obligatorio para colaboradores.', 'warning');
      btn.disabled = false; btn.textContent = 'Guardar cambios'; return;
    }
    var body = {
      name: el('eu_name').value.trim(), email: el('eu_email').value.trim(),
      role: el('eu_role').value, account_type: el('eu_type').value,
      position: el('eu_position').value.trim(),
      company: el('eu_company').value.trim(), phone: el('eu_phone').value.trim(),
      vacation_total: parseInt(el('eu_vt').value, 10) || 0,
      vacation_used: parseInt(el('eu_vu').value, 10) || 0
    };
    var pass = el('eu_pass').value;
    API.request('/api/admin/users/' + u.id, { method: 'PUT', body: JSON.stringify(body) })
      .then(function () {
        if (pass && pass.length >= 6) {
          return API.request('/api/admin/users/' + u.id + '/password', { method: 'PUT', body: JSON.stringify({ password: pass }) });
        }
      })
      .then(function () {
        showAlert('Usuario actualizado.', 'success');
        state.users = null; state.dashboard = null;
        viewAdminUsuarios();
      })
      .catch(function (err) { showAlert(err.message, 'error'); btn.disabled = false; btn.textContent = 'Guardar cambios'; });
  });
}

export function viewAdminUsuarios() {
  return loadUsers(true).then(function (users) {
    var staff = users.filter(isTuringtech);
    var clients = users.filter(function (u) { return !isTuringtech(u); });
    var block = function (title, icon, arr) {
      return '<div class="glass-panel" style="padding:24px;margin-bottom:22px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
        '<h2 style="color:var(--color-white);font-size:18px;font-weight:700;"><i class="fa-solid ' + icon + '" style="color:var(--color-accent);margin-right:8px;"></i>' + title + '</h2>' +
        chipEstado(String(arr.length), { variante: 'secondary', solido: true }) + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:10px;">' +
        (arr.map(userCard).join('') || '<p class="text-gray text-center" style="padding:24px 0;">Sin usuarios.</p>') + '</div></div>';
    };

    var form =
      '<div class="glass-panel" style="padding:24px;margin-bottom:22px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
          '<h2 style="color:var(--color-white);font-size:18px;font-weight:700;"><i class="fa-solid fa-user-plus" style="color:var(--color-accent);margin-right:8px;"></i>Crear usuario</h2>' +
          '<button class="btn btn-secondary btn-small" id="nuToggle">Nuevo usuario</button>' +
        '</div>' +
        '<form id="nuForm" style="display:none;margin-top:18px;">' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">' +
            '<div class="form-group"><label for="nu_name">Nombre <span class="form-required-marker">*</span></label><input type="text" id="nu_name" class="form-input" required></div>' +
            '<div class="form-group"><label for="nu_email">Email <span class="form-required-marker">*</span></label><input type="email" id="nu_email" class="form-input" placeholder="nombre@turingtech.com.ec" required></div>' +
            '<div class="form-group"><label for="nu_pass">Contraseña <span class="form-required-marker">*</span></label><input type="text" id="nu_pass" class="form-input" placeholder="mín. 6 caracteres" required minlength="6"></div>' +
            '<div class="form-group"><label for="nu_type">Tipo de cuenta <span class="form-required-marker">*</span></label><select id="nu_type" class="form-input">' +
              '<option value="cliente">Cliente (portal de créditos)</option>' +
              '<option value="colaborador">Colaborador TURINGTECH (portal RRHH)</option>' +
            '</select></div>' +
            '<div class="form-group"><label for="nu_role">Rol <span class="form-required-marker">*</span></label><select id="nu_role" class="form-input">' +
              '<option value="user">Usuario</option>' +
              '<option value="admin">Administrador (panel completo)</option>' +
            '</select></div>' +
            '<div class="form-group" id="nu_position_g"><label for="nu_position">Cargo <span class="form-required-marker" id="nu_pos_req" style="display:none;">*</span></label><input type="text" id="nu_position" class="form-input" placeholder="Data Engineer, Contadora..."></div>' +
            '<div class="form-group"><label for="nu_company">Empresa</label><input type="text" id="nu_company" class="form-input" value="TURINGTECH Ecuador"></div>' +
            '<div class="form-group"><label for="nu_phone">Teléfono</label><input type="tel" id="nu_phone" class="form-input"></div>' +
            '<div class="form-group"><label for="nu_credits">Saldo inicial (créditos / Turingcoins)</label><input type="number" id="nu_credits" class="form-input" value="0" min="0"></div>' +
            '<div class="form-group nu-col" style="display:none;"><label for="nu_vt">Días de vacaciones (total)</label><input type="number" id="nu_vt" class="form-input" value="10" min="0"></div>' +
            '<div class="form-group nu-col" style="display:none;"><label for="nu_vu">Vacaciones gozadas</label><input type="number" id="nu_vu" class="form-input" value="0" min="0"></div>' +
          '</div>' +
          '<button type="submit" class="btn btn-primary" id="nu_btn"><i class="fa-solid fa-check"></i> Crear usuario</button>' +
        '</form>' +
      '</div>';

    el('view').innerHTML = form + block('Clientes', 'fa-briefcase', clients) + block('Usuarios TURINGTECH', 'fa-shield-halved', staff);

    wireUserActions();

    var nuSync = function () {
      var col = el('nu_type').value === 'colaborador';
      el('nu_pos_req').style.display = col ? 'inline' : 'none';
      document.querySelectorAll('.nu-col').forEach(function (n) { n.style.display = col ? 'block' : 'none'; });
    };
    el('nu_type').addEventListener('change', nuSync); nuSync();

    el('nuToggle').addEventListener('click', function () {
      var f = el('nuForm');
      f.style.display = f.style.display === 'none' ? 'block' : 'none';
    });
    el('nuForm').addEventListener('submit', function (e) {
      e.preventDefault();
      if (el('nu_type').value === 'colaborador' && !el('nu_position').value.trim()) {
        showAlert('El cargo es obligatorio para colaboradores.', 'warning'); return;
      }
      var btn = el('nu_btn'); btn.disabled = true; btn.textContent = 'Creando...';
      API.request('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          name: el('nu_name').value.trim(),
          email: el('nu_email').value.trim(),
          password: el('nu_pass').value,
          role: el('nu_role').value,
          account_type: el('nu_type').value,
          position: el('nu_position').value.trim(),
          company: el('nu_company').value.trim(),
          phone: el('nu_phone').value.trim(),
          credits: parseInt(el('nu_credits').value, 10) || 0,
          vacation_total: parseInt(el('nu_vt').value, 10) || 0,
          vacation_used: parseInt(el('nu_vu').value, 10) || 0
        })
      }).then(function () {
        showAlert('Usuario creado.', 'success');
        state.users = null;
        viewAdminUsuarios();
      }).catch(function (err) {
        showAlert(err.message, 'error');
        btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-check"></i> Crear usuario';
      });
    });
  });
}

export function viewAdminCreditos() {
  return loadUsers().then(function (users) {
    var opts = users.map(function (u) { return '<option value="' + u.id + '">' + esc(u.name) + ' — ' + esc(u.email) + ' (' + (u.credits || 0).toLocaleString() + ')</option>'; }).join('');
    el('view').innerHTML = '<div class="glass-panel" style="padding:28px;max-width:520px;"><form id="mcForm">' +
      '<div class="form-group"><label for="mc_user">Usuario <span class="form-required-marker">*</span></label><select id="mc_user" class="form-input" required>' + opts + '</select></div>' +
      '<div class="form-group"><label for="mc_amount">Cantidad (positivo o negativo) <span class="form-required-marker">*</span></label><input type="number" id="mc_amount" class="form-input" placeholder="500" required></div>' +
      '<div class="form-group"><label for="mc_reason">Motivo <span class="form-required-marker">*</span></label><input type="text" id="mc_reason" class="form-input" placeholder="Bonificación por proyecto" required></div>' +
      '<button type="submit" class="btn btn-primary btn-block" id="mc_btn">Aplicar</button></form></div>';
    el('mcForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = el('mc_btn'); btn.disabled = true; btn.textContent = 'Aplicando...';
      API.adjustUserCredits(el('mc_user').value, parseInt(el('mc_amount').value, 10), el('mc_reason').value).then(function () {
        showAlert('Créditos actualizados.', 'success'); state.users = null; state.dashboard = null; refreshBell(); location.hash = '#/admin-usuarios';
      }).catch(function (err) { showAlert(err.message, 'error'); })
        .then(function () { btn.disabled = false; btn.textContent = 'Aplicar'; });
    });
  });
}

export function viewAdminConfig() {
  return API.getAdminConfig().then(function (r) {
    var cfg = r.config || r || {};
    var me = state.me;
    el('view').innerHTML =
      '<div class="glass-panel" style="padding:28px;max-width:520px;margin-bottom:22px;">' +
        '<div class="section-heading" style="text-align:left;margin-bottom:16px;">Mi foto</div>' +
        '<div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap;">' +
          '<div id="cfgPhoto" style="width:76px;height:76px;border-radius:50%;overflow:hidden;background:linear-gradient(135deg,var(--color-accent),var(--color-accent-hover));display:flex;align-items:center;justify-content:center;color:var(--color-white);font-weight:800;font-size:24px;">' + avatarHtml(me.name, me.photo) + '</div>' +
          '<div><input type="file" id="cfg_file" accept="image/png,image/jpeg,image/webp" style="display:none;">' +
            '<button class="btn btn-secondary btn-small" id="cfg_pick"><i class="fa-solid fa-upload"></i> Subir foto</button> ' +
            (me.photo ? '<button class="btn btn-error btn-small" id="cfg_rmphoto">Quitar</button>' : '') +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="glass-panel" style="padding:28px;max-width:520px;margin-bottom:22px;">' +
        '<div class="section-heading" style="text-align:left;margin-bottom:16px;">Email de notificaciones</div>' +
        '<form id="cfgForm">' +
          '<div class="form-group"><label for="cfg_email">Email <span class="form-required-marker">*</span></label>' +
          '<input type="email" id="cfg_email" class="form-input" value="' + esc(cfg.notification_email || '') + '" required></div>' +
          '<p class="text-gray text-sm mb-2">Las solicitudes de créditos se enviarán a este correo.</p>' +
          '<button type="submit" class="btn btn-primary" id="cfg_btn">Guardar</button>' +
        '</form>' +
      '</div>' +
      '<div class="glass-panel" style="padding:28px;max-width:520px;">' +
        '<div class="section-heading" style="text-align:left;margin-bottom:16px;">Cambiar mi contraseña</div>' +
        '<form id="pwForm">' +
          '<div class="form-group"><label for="pw_cur">Contraseña actual <span class="form-required-marker">*</span></label>' +
          '<input type="password" id="pw_cur" class="form-input" required autocomplete="current-password"></div>' +
          '<div class="form-group"><label for="pw_new">Nueva contraseña <span class="form-required-marker">*</span></label>' +
          '<input type="password" id="pw_new" class="form-input" required minlength="6" autocomplete="new-password"></div>' +
          '<div class="form-group"><label for="pw_new2">Repetir nueva contraseña <span class="form-required-marker">*</span></label>' +
          '<input type="password" id="pw_new2" class="form-input" required minlength="6" autocomplete="new-password"></div>' +
          '<button type="submit" class="btn btn-primary" id="pw_btn">Actualizar contraseña</button>' +
        '</form>' +
      '</div>';

    function savePhoto(dataUrl) {
      return API.request('/api/hr/profile', { method: 'POST', body: JSON.stringify({ photo: dataUrl }) })
        .then(function () { state.me.photo = dataUrl || null; paintTopbarAvatar(); showAlert(dataUrl ? 'Foto actualizada.' : 'Foto quitada.', 'success'); viewAdminConfig(); })
        .catch(function (e) { showAlert(e.message, 'error'); });
    }
    el('cfg_pick').addEventListener('click', function () { el('cfg_file').click(); });
    el('cfg_file').addEventListener('change', function () {
      var f = this.files && this.files[0]; if (!f) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        var img = new Image();
        img.onload = function () {
          var size = 256, c = document.createElement('canvas'); c.width = size; c.height = size;
          var ctx = c.getContext('2d'), s = Math.min(img.width, img.height);
          ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
          savePhoto(c.toDataURL('image/jpeg', 0.85));
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(f);
    });
    var rmp = el('cfg_rmphoto');
    if (rmp) rmp.addEventListener('click', function () { savePhoto(''); });

    el('cfgForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = el('cfg_btn'); btn.disabled = true; btn.textContent = 'Guardando...';
      API.updateAdminConfig('notification_email', el('cfg_email').value).then(function () {
        showAlert('Configuración guardada.', 'success');
      }).catch(function (err) { showAlert(err.message, 'error'); })
        .then(function () { btn.disabled = false; btn.textContent = 'Guardar'; });
    });

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
  });
}

