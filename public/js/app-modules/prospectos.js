// Prospectos: CRM de prospección B2B Ecuador — listado, formulario, gestión
// individual (interacciones + actividades) y catálogo admin. Dividido del
// <script> monolítico de app.html.
// Dependencias circulares con board.js (boardState al abrir una tarea del
// tablero desde un prospecto) y con crmkanban.js (volver al kanban); son
// seguras porque solo se usan dentro de funciones invocadas en runtime, nunca
// en el cuerpo top-level del módulo.
import { API } from '../api-bridge.js';
import { el, esc, chipEstado, emptyState, loadingHtml, parseDateLocal, fmtDate, pasteState } from './core.js';
import { boardState } from './board.js';
import { ACT_ICONO, ACT_LABEL } from './crmdash.js';
import { viewCrmTablero, prosActChip } from './crmkanban.js';

export var SECTORES = window.SECTORES || [];
export var PILARES = window.PILARES || ['RPA', 'IA', 'BI', 'Software a la Medida', 'App Móvil Offline'];
export var FUENTES = window.FUENTES || ['LinkedIn', 'PBX', 'Referido'];
export var FASES_SOP = window.FASES_SOP || [];
export var PATRONES_EMAIL = window.PATRONES_EMAIL || [];
export var EJEMPLOS_EMAIL = window.EJEMPLOS_EMAIL || [];
export var PROS = { list: [], meta: {}, tab: 'gestion', sectorId: '', sc: { vend: '', cont: '', emp: '' }, filtro: { sector: '', q: '', estado: '', owner: '', orden: '' }, sel: null, view: null, from: null, kbq: '' };
export var sectorById = function (id) { return SECTORES.filter(function (s) { return s.id === id; })[0]; };

// estados y tipos vienen del backend (catálogo editable por admin). Fallback por si aún no cargó meta.
export var PROS_ESTADOS_FALLBACK = [
  { slug: 'nuevo', label: 'Nuevo', color: '#94a3b8' }, { slug: 'contactado', label: 'Contactado', color: '#3b82f6' },
  { slug: 'en_seguimiento', label: 'En seguimiento', color: '#a78bfa' }, { slug: 'reunion', label: 'Reunión agendada', color: '#f59e0b' },
  { slug: 'propuesta', label: 'Propuesta enviada', color: '#f97316' }, { slug: 'ganado', label: 'Ganado', color: '#10b981' },
  { slug: 'perdido', label: 'Perdido', color: '#ef4444' }, { slug: 'no_responde', label: 'No responde', color: '#64748b' }
];
export var prosEstados = function () { return (PROS.meta.estados && PROS.meta.estados.length) ? PROS.meta.estados : PROS_ESTADOS_FALLBACK; };
export var prosTipos = function () { return PROS.meta.tipos || [{ slug: 'nota', label: 'Nota', icono: 'fa-solid fa-note-sticky' }]; };
export var prosEstadoDe = function (slug) { return prosEstados().filter(function (e) { return e.slug === slug; })[0] || prosEstados()[0] || { label: slug, color: '#94a3b8' }; };
export var prosTipoDe = function (slug) { return prosTipos().filter(function (t) { return t.slug === slug; })[0] || { label: slug, icono: 'fa-solid fa-note-sticky' }; };
export var INTER_RESULTADOS = [
  { id: 'contacto', label: 'Contacté' }, { id: 'no_contesto', label: 'No contestó' },
  { id: 'agendo', label: 'Agendó reunión' }, { id: 'propuesta', label: 'Envié propuesta' },
  { id: 'descartado', label: 'Descartado' }, { id: 'otro', label: 'Otro' }
];
export var INTER_RES = {}; INTER_RESULTADOS.forEach(function (r) { INTER_RES[r.id] = r.label; });
export var prosById = function (id) { return PROS.list.filter(function (p) { return String(p.id) === String(id); })[0]; };
export function fmtRel(d) {
  if (!d) return '—';
  var diff = Date.now() - new Date(d).getTime();
  var dias = Math.floor(diff / 86400000);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 30) return 'hace ' + dias + ' días';
  return fmtDate(d);
}
export function prosEstadoChip(slug) {
  var e = prosEstadoDe(slug);
  return chipEstado(e.label, { color: e.color, clase: 'chip-sm' });
}

export function personalizarScript(s, vend, cont, emp) {
  var out = String(s || '');
  out = out.replace('[Nombre]', (cont || '').trim() || '[Nombre]');
  out = out.replace('[Nombre]', (vend || '').trim() || '[Nombre]');
  out = out.split('[Empresa]').join((emp || '').trim() || '[Empresa]');
  return out;
}

export function viewProspectos() {
  PROS.view = null; PROS.from = null;
  return API.request('/api/prospectos').then(function (r) {
    PROS.list = r.prospectos || [];
    PROS.meta = r.meta || {};
    prosRender();
  });
}

export function prosRender() {
  // "Gestión" es la acción principal (donde se trabaja); "Cómo investigar" y
  // "Guía por sector" son contenido de referencia y quedan en 2do plano: van
  // aparte, empujadas a la derecha y con estilo .tab-sec (más chicas/apagadas).
  var tabPrimary = '<button class="tab ' + (PROS.tab === 'gestion' ? 'active' : '') + '" data-pt="gestion">Gestión' +
    '<span class="pros-tab-count">' + PROS.list.length + '</span></button>';
  var tabsSec = [['sop', 'Cómo investigar'], ['guia', 'Guía por sector']]
    .map(function (t) { return '<button class="tab tab-sec ' + (PROS.tab === t[0] ? 'active' : '') + '" data-pt="' + t[0] + '">' + esc(t[1]) + '</button>'; })
    .join('');
  el('view').innerHTML =
    '<div class="tabs" style="margin-bottom:16px;flex-wrap:wrap;">' + tabPrimary + tabsSec + '</div><div id="prosBody"></div>';
  document.querySelectorAll('.tab[data-pt]').forEach(function (b) {
    b.addEventListener('click', function () { PROS.tab = this.getAttribute('data-pt'); PROS.sel = null; prosRender(); });
  });
  ({ guia: prosGuia, sop: prosSop, gestion: prosGestion })[PROS.tab]();
}

export function sectorSelectHtml(id, sel) {
  return '<select id="' + id + '" class="form-input">' +
    '<option value="">— Selecciona un sector —</option>' +
    SECTORES.map(function (s) { return '<option value="' + s.id + '"' + (s.id === sel ? ' selected' : '') + '>' + esc(s.icono + ' ' + s.nombre) + '</option>'; }).join('') +
    '</select>';
}

// Definición de los campos del formulario de prospecto, compartida entre el
// alta (prosRegistrar, prefijo de id "px_") y la edición (prosGestionar,
// prefijo "pg_f_") para no mantener 17 campos copy-pasteados en dos lugares.
// suf: sufijo de id (el id real es prefix + suf). key: propiedad del objeto
// de datos del prospecto que lee/escribe el campo.
// type: 'sector' (usa sectorSelectHtml), 'cargo' (input + <datalist> de
// cargos sugeridos del sector), 'select' (opts fijas en f.opciones),
// 'fase' (opciones de FASES_SOP), 'date', 'email', o texto plano por defecto.
// group: agrupa visualmente los campos en prosFormFieldsHTML (ver PROS_GRUPOS
// para el heading de cada uno) — deben venir contiguos por grupo, que es como
// están listados abajo. icon: clase Font Awesome mostrada como prefijo del
// campo. "Notas" queda fuera de este array: ocupa el ancho completo del form
// y se arma aparte en prosFormFieldsHTML.
export var PROS_GRUPOS = {
  empresa: '🏢 Empresa',
  contacto: '👤 Contacto',
  seguimiento: '🎯 Seguimiento comercial',
  avanzado: '⚙️ Datos opcionales'
};
export var PROS_CAMPOS = [
  { suf: 'sector', key: 'sector_id', label: 'Sector', type: 'sector', group: 'empresa', icon: 'fa-solid fa-industry' },
  { suf: 'empresa', key: 'empresa', label: 'Empresa', required: true, group: 'empresa', icon: 'fa-solid fa-building' },
  { suf: 'web', key: 'web', label: 'Página web', placeholder: 'https://...', group: 'empresa', icon: 'fa-solid fa-globe' },
  { suf: 'cn', key: 'contacto_nombre', label: 'Contacto — nombre', group: 'contacto', icon: 'fa-solid fa-user' },
  { suf: 'ca', key: 'contacto_apellido', label: 'Contacto — apellido', group: 'contacto', icon: 'fa-solid fa-user' },
  { suf: 'cargo', key: 'cargo', label: 'Cargo', type: 'cargo', group: 'contacto', icon: 'fa-solid fa-briefcase' },
  { suf: 'email', key: 'email', label: 'Email corporativo', type: 'email', group: 'contacto', icon: 'fa-solid fa-envelope' },
  { suf: 'tel', key: 'telefono', label: 'Teléfono / extensión', placeholder: 'Ej: 099 123 4567', group: 'contacto', icon: 'fa-solid fa-phone' },
  { suf: 'li', key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/...', group: 'contacto', icon: 'fa-brands fa-linkedin' },
  { suf: 'fuente', key: 'fuente', label: 'Fuente', type: 'select', opciones: FUENTES, group: 'seguimiento', icon: 'fa-solid fa-signal' },
  { suf: 'pilar', key: 'pilar', label: 'Pilar', type: 'select', opciones: PILARES, group: 'seguimiento', icon: 'fa-solid fa-chess-rook' },
  // Campos de bajo uso posterior (no alimentan ningún dashboard, filtro ni
  // columna de lista hoy — ver análisis en git log) — se agrupan aparte y se
  // muestran colapsados por defecto para no competir con los campos de arriba.
  { suf: 'ruc', key: 'ruc', label: 'RUC', placeholder: '13 dígitos', group: 'avanzado', icon: 'fa-solid fa-id-card' },
  { suf: 'fase', key: 'fase_sop', label: 'Fase del SOP', type: 'fase', group: 'avanzado', icon: 'fa-solid fa-route' },
  { suf: 'fecha', key: 'fecha_fase', label: 'Fecha de la fase', type: 'date', group: 'avanzado', icon: 'fa-solid fa-calendar-days' },
  { suf: 'ext', key: 'extension_pbx', label: 'Extensión PBX', group: 'avanzado', icon: 'fa-solid fa-phone-volume' },
  { suf: 'hora', key: 'horario_preferido', label: 'Horario preferido', placeholder: 'Ej: Mañanas 9-12h', group: 'avanzado', icon: 'fa-solid fa-clock' }
];
// Arma las secciones de campos (agrupadas por PROS_GRUPOS) + el textarea de
// Notas. prefix es "px_" (alta) o "pg_f_" (edición); d es el objeto de datos
// del prospecto (o {} en alta sin prellenar). Sector no lleva asterisco de
// obligatorio: ni el backend (columna nullable) ni este formulario lo validan
// como tal.
export function prosFormFieldsHTML(prefix, d) {
  d = d || {};
  var opt = function (arr, v) { return arr.map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join(''); };
  var html = '';
  var grupoActual = null;
  var cierreActual = '';
  PROS_CAMPOS.forEach(function (f) {
    var id = prefix + f.suf;
    var control;
    if (f.type === 'sector') {
      control = sectorSelectHtml(id, d.sector_id);
    } else if (f.type === 'cargo') {
      var sec = sectorById(d.sector_id);
      var dlId = prefix + 'dl_cargos';
      var dl = sec ? '<datalist id="' + dlId + '">' + sec.cargosLinkedIn.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist>' : '';
      control = '<input id="' + id + '" class="form-input" list="' + dlId + '" value="' + esc(d.cargo || '') + '">' + dl;
    } else if (f.type === 'select') {
      control = '<select id="' + id + '" class="form-input"><option value="">—</option>' + opt(f.opciones, d[f.key]) + '</select>';
    } else if (f.type === 'fase') {
      var faseOpts = '<option value="">—</option>' + FASES_SOP.map(function (fx) { return '<option value="' + fx.id + '"' + (String(d.fase_sop) === String(fx.id) ? ' selected' : '') + '>' + esc(fx.nombre) + '</option>'; }).join('');
      control = '<select id="' + id + '" class="form-input">' + faseOpts + '</select>';
    } else if (f.type === 'date') {
      var v = d[f.key] || '';
      control = '<input type="date" id="' + id + '" class="form-input" value="' + esc(v.slice ? v.slice(0, 10) : '') + '">';
    } else {
      var typeAttr = f.type === 'email' ? ' type="email"' : '';
      // Sin atributo HTML "required": la validación la hace el submit handler
      // (showAlert + prosMarcarErrorEmpresa) para mostrar un error inline
      // consistente con el resto de la app en vez del tooltip nativo del navegador.
      var ph = f.placeholder ? ' placeholder="' + f.placeholder + '"' : '';
      control = '<input id="' + id + '"' + typeAttr + ' class="form-input"' + ph + ' value="' + esc(d[f.key] || '') + '">';
    }
    if (f.icon) control = '<div class="field-icon"><i class="' + f.icon + '"></i>' + control + '</div>';
    var reqMark = f.required ? ' <span class="form-required-marker">*</span>' : '';
    var campoHtml = '<div class="form-group"><label for="' + id + '">' + f.label + reqMark + '</label>' + control + '</div>';
    if (f.group !== grupoActual) {
      if (grupoActual !== null) html += cierreActual;
      // El grupo "avanzado" (campos de bajo uso posterior) se renderiza
      // colapsado por defecto con <details>/<summary> en vez del <div> normal.
      if (f.group === 'avanzado') {
        html += '<details class="pros-form-section pros-form-section-collapsible"><summary class="pros-form-section-head">' + PROS_GRUPOS[f.group] + '</summary><div class="pros-form-section-grid">';
        cierreActual = '</div></details>';
      } else {
        html += '<div class="pros-form-section"><div class="pros-form-section-head">' + PROS_GRUPOS[f.group] + '</div><div class="pros-form-section-grid">';
        cierreActual = '</div></div>';
      }
      grupoActual = f.group;
    }
    html += campoHtml;
  });
  if (grupoActual !== null) html += cierreActual;
  var notasId = prefix + 'notas';
  return html +
    '<div class="form-group" style="margin-top:4px;"><label for="' + notasId + '">Notas</label><textarea id="' + notasId + '" class="form-input" rows="3">' + esc(d.notas || '') + '</textarea></div>';
}
// Lee del DOM los valores cargados por prosFormFieldsHTML(prefix, ...) y arma
// el objeto a enviar al backend. Mismo prefix usado al generar el HTML.
export function prosFormCollect(prefix) {
  var g = function (suf) { return el(prefix + suf).value; };
  var sec = sectorById(g('sector'));
  return {
    sector_id: g('sector'), sector_nombre: sec ? sec.nombre : '',
    empresa: g('empresa').trim(), ruc: g('ruc').trim(), web: g('web').trim(),
    contacto_nombre: g('cn').trim(), contacto_apellido: g('ca').trim(), cargo: g('cargo').trim(),
    email: g('email').trim(), telefono: g('tel').trim(), linkedin: g('li').trim(),
    fuente: g('fuente'), pilar: g('pilar'), fase_sop: g('fase'),
    fecha_fase: g('fecha') || null, extension_pbx: g('ext').trim(), horario_preferido: g('hora').trim(),
    notas: g('notas').trim()
  };
}
// Marca el campo "empresa" con error inline (borde rojo + mensaje bajo el
// label) y hace foco+scroll hacia él. Se usa junto al showAlert() existente
// en el alta (prosRegistrar) y en "Guardar datos" (prosGestionar) cuando
// falta ese campo obligatorio. prefix: "px_" o "pg_f_".
function prosMarcarErrorEmpresa(prefix) {
  var input = el(prefix + 'empresa');
  input.classList.add('error');
  var grp = input.closest('.form-group');
  if (!grp.querySelector('.error-message')) {
    var msg = document.createElement('span');
    msg.className = 'error-message';
    msg.textContent = 'El nombre de la empresa es obligatorio.';
    grp.appendChild(msg);
  }
  input.focus();
  input.scrollIntoView({ behavior: 'smooth', block: 'center' });
  input.addEventListener('input', function limpiar() {
    input.classList.remove('error');
    var m = grp.querySelector('.error-message'); if (m) m.remove();
    input.removeEventListener('input', limpiar);
  });
}

export function prosGuia() {
  var s = sectorById(PROS.sectorId);
  var html = '<div class="glass-panel" style="padding:20px;margin-bottom:18px;max-width:520px;">' +
    '<label for="fx_sector" class="text-gray text-sm" style="display:block;margin-bottom:6px;">Sector objetivo</label>' +
    sectorSelectHtml('fx_sector', PROS.sectorId) + '</div>';
  if (s) {
    var tags = function (arr) { return '<div style="display:flex;flex-wrap:wrap;gap:6px;">' + arr.map(function (x) { return chipEstado(x, { variante: 'secondary', solido: true, style: 'font-weight:500;' }); }).join('') + '</div>'; };
    var card = function (title, inner) { return '<div class="glass-panel" style="padding:18px;"><div class="section-heading" style="text-align:left;font-size:13px;margin-bottom:10px;">' + title + '</div>' + inner + '</div>'; };
    var scriptPers = personalizarScript(s.script, PROS.sc.vend, PROS.sc.cont, PROS.sc.emp);
    html +=
      '<h2 style="color:var(--color-white);font-size:20px;font-weight:800;margin-bottom:14px;">' + esc(s.icono + ' ' + s.nombre) + '</h2>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;">' +
        card('🏢 Cuentas objetivo', tags(s.cuentas)) +
        card('😣 Dolor principal', '<p class="text-sm">' + esc(s.dolor) + '</p>') +
        card('🧩 Pilar a vender', '<p class="text-sm text-accent">' + esc(s.pilar) + '</p>') +
        card('👤 Decisor a contactar', '<p class="text-sm">' + esc(s.decisor) + '</p>') +
        card('🔎 Cargos para filtro LinkedIn', tags(s.cargosLinkedIn)) +
      '</div>' +
      card('💬 Script de abordaje',
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px;">' +
          '<input id="sc_vend" class="form-input" placeholder="Tu nombre (vendedor)" value="' + esc(PROS.sc.vend) + '">' +
          '<input id="sc_cont" class="form-input" placeholder="Nombre del contacto" value="' + esc(PROS.sc.cont) + '">' +
          '<input id="sc_emp" class="form-input" placeholder="Empresa (opcional)" value="' + esc(PROS.sc.emp) + '">' +
        '</div>' +
        '<blockquote class="pros-script" id="sc_preview">' + esc(scriptPers) + '</blockquote>' +
        '<div style="display:flex;gap:8px;margin-top:10px;">' +
          '<button class="btn btn-primary btn-small" id="sc_copy">📋 Copiar mensaje</button>' +
          '<button class="btn btn-secondary btn-small" id="sc_copy_orig">Copiar original</button>' +
          '<button class="btn btn-secondary btn-small" id="sc_go">Registrar prospecto en este sector →</button>' +
        '</div>'
      );
  } else {
    html += '<p class="text-gray text-center" style="padding:30px 0;">Selecciona un sector para ver su ficha completa.</p>';
  }
  el('prosBody').innerHTML = html;

  el('fx_sector').addEventListener('change', function () { PROS.sectorId = this.value; prosGuia(); });
  if (s) {
    ['vend', 'cont', 'emp'].forEach(function (k) {
      var inp = el('sc_' + k);
      inp.addEventListener('input', function () {
        PROS.sc[k] = this.value;
        el('sc_preview').textContent = personalizarScript(s.script, PROS.sc.vend, PROS.sc.cont, PROS.sc.emp);
      });
    });
    el('sc_copy').addEventListener('click', function () { navigator.clipboard.writeText(el('sc_preview').textContent); showAlert('Mensaje copiado.', 'success'); });
    el('sc_copy_orig').addEventListener('click', function () { navigator.clipboard.writeText(s.script); showAlert('Script original copiado.', 'success'); });
    el('sc_go').addEventListener('click', function () { PROS.tab = 'gestion'; PROS.sel = null; prosRender(); setTimeout(function () { prosRegistrar(null); }, 0); });
  }
}

// Alta de prospecto. `pre` (opcional) = valores ya tipeados a preservar al cambiar de sector.
export function prosRegistrar(pre) {
  var d = pre || { sector_id: PROS.sectorId || '' };
  var s = sectorById(d.sector_id);

  var intel = '<div class="glass-panel pros-intel">' + (s
    ? '<div class="section-heading" style="text-align:left;font-size:12px;margin-bottom:10px;">' + esc(s.icono + ' ' + s.nombre) + '</div>' +
      '<p class="text-xs"><strong>Decisor:</strong> ' + esc(s.decisor) + '</p>' +
      '<p class="text-xs" style="margin-top:6px;"><strong>Pilar a vender:</strong> <span class="text-accent">' + esc(s.pilar) + '</span></p>' +
      '<p class="text-xs" style="margin-top:8px;"><strong>Cargos (clic para usar):</strong></p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:4px;">' +
        s.cargosLinkedIn.map(function (c) { return '<button type="button" class="mini-chip" data-cargo="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div>' +
      '<p class="text-xs" style="margin-top:10px;"><strong>Script:</strong></p>' +
      '<blockquote class="pros-script" style="font-size:11.5px;margin-top:4px;">' + esc(s.script) + '</blockquote>' +
      '<button type="button" class="btn btn-secondary btn-small" id="px_copyscript" style="margin-top:6px;">📋 Copiar script</button>'
    : '<div class="pros-intel-empty"><i class="fa-solid fa-lightbulb"></i>Elegí un sector para ver información de inteligencia comercial: decisor, pilar recomendado, cargos objetivo y script de abordaje.</div>'
  ) + '</div>';

  el('prosBody').innerHTML =
    '<button class="btn btn-secondary btn-small" id="px_back" style="margin-bottom:12px;"><i class="fa-solid fa-arrow-left"></i> Volver a la lista</button>' +
    '<div class="pros-form-wrap">' +
    '<div class="glass-panel" style="padding:26px;">' +
      '<div class="section-heading" style="text-align:left;margin-bottom:4px;">Nuevo prospecto</div>' +
      '<p class="text-gray text-xs" style="margin-bottom:18px;">Completá los datos que tengas — podés dejar campos vacíos y completarlos después desde la ficha del prospecto.</p>' +
      '<form id="prosForm">' +
      prosFormFieldsHTML('px_', d) +
      '<div style="margin-top:24px;padding-top:18px;border-top:1px solid rgba(255,255,255,0.07);">' +
        '<button type="submit" class="btn btn-primary" id="px_save"><i class="fa-solid fa-floppy-disk"></i> Guardar prospecto</button>' +
      '</div>' +
    '</form></div>' + intel + '</div>';

  el('px_back').addEventListener('click', function () { PROS.tab = 'gestion'; prosRender(); });
  el('px_sector').addEventListener('change', function () {
    PROS.sectorId = this.value;
    prosRegistrar(Object.assign(prosFormCollect('px_'), { sector_id: this.value }));  // preserva lo tipeado
  });
  document.querySelectorAll('[data-cargo]').forEach(function (b) {
    b.addEventListener('click', function () { el('px_cargo').value = this.getAttribute('data-cargo'); });
  });
  if (el('px_copyscript')) el('px_copyscript').addEventListener('click', function () { navigator.clipboard.writeText(s.script); showAlert('Script copiado.', 'success'); });

  el('prosForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var b = prosFormCollect('px_');
    if (!b.empresa) { showAlert('El nombre de la empresa es obligatorio.', 'warning'); prosMarcarErrorEmpresa('px_'); return; }
    var btn = el('px_save'); btn.disabled = true; btn.textContent = 'Guardando...';
    API.request('/api/prospectos', { method: 'POST', body: JSON.stringify(b) })
      .then(function (r) {
        showAlert('Prospecto guardado.', 'success');
        PROS.tab = 'gestion'; PROS.sel = (r.prospecto || {}).id || null; viewProspectos();
      }).catch(function (err) { showAlert(err.message, 'error'); btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar prospecto'; });
  });
}

export function prosSop() {
  var fases = FASES_SOP.map(function (f) {
    return '<div class="glass-panel" style="padding:16px;"><div style="color:var(--color-accent);font-weight:700;font-size:13px;">' + esc(f.nombre) + '</div>' +
      '<p class="text-sm text-gray" style="margin-top:6px;">' + esc(f.desc) + '</p></div>';
  }).join('');
  var patrones = PATRONES_EMAIL.map(function (p) { return chipEstado(p, { variante: 'secondary', solido: true, style: 'font-family:monospace;font-weight:500;' }); }).join(' ');
  var ejemplos = EJEMPLOS_EMAIL.map(function (e) { return '<tr><td>' + esc(e.empresa) + '</td><td style="font-family:monospace;">' + esc(e.patron) + '</td></tr>'; }).join('');
  el('prosBody').innerHTML =
    '<h2 style="color:var(--color-white);font-size:18px;font-weight:700;margin-bottom:6px;">SOP de Inteligencia e Investigación de Contactos</h2>' +
    '<p class="text-gray text-sm mb-3">Procedimiento para encontrar nombres, cargos y correos de decisores B2B en Ecuador, validando la información antes del primer contacto.</p>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-bottom:18px;">' + fases + '</div>' +
    '<div class="glass-panel" style="padding:18px;margin-bottom:14px;"><div class="section-heading" style="text-align:left;font-size:13px;margin-bottom:10px;">📧 Patrones de correo corporativo ecuatoriano</div>' +
      '<p class="text-gray text-xs mb-2">Probar las variantes más comunes. Descartar correos genéricos como info@…</p><div style="display:flex;flex-wrap:wrap;gap:6px;">' + patrones + '</div></div>' +
    '<div class="glass-panel" style="padding:18px;margin-bottom:14px;"><div class="section-heading" style="text-align:left;font-size:13px;margin-bottom:10px;">📚 Ejemplos reales por empresa</div>' +
      '<div class="table-container"><table class="table"><thead><tr><th>Empresa</th><th>Patrón</th></tr></thead><tbody>' + ejemplos + '</tbody></table></div></div>' +
    '<div class="glass-panel" style="padding:18px;border-left:3px solid var(--color-warning);"><div style="color:var(--color-warning);font-weight:700;font-size:13px;">⚠️ Regla de oro</div>' +
      '<p class="text-sm" style="margin-top:6px;">Nunca se realiza un primer contacto comercial sin haber confirmado el nombre completo del decisor, su cargo y su correo corporativo.</p></div>' +
    '<div class="glass-panel" style="padding:18px;margin-top:14px;border-left:3px solid var(--color-info);"><div style="color:var(--color-info);font-weight:700;font-size:13px;">🛡️ Cumplimiento LOPDP Ecuador</div>' +
      '<p class="text-sm" style="margin-top:6px;">Toda prospección se realiza bajo modalidad B2B, usando exclusivamente información de contacto corporativa y perfiles profesionales públicos (Ley Orgánica de Protección de Datos Personales).</p></div>';
}

/* ---- Gestión: lista compacta de clientes / prospectos ---- */
export function prosGestion() {
  if (PROS.sel) { var pp = prosById(PROS.sel); if (pp) return prosGestionar(pp); PROS.sel = null; }
  var f = PROS.filtro;
  var secs = Array.from(new Set(PROS.list.map(function (p) { return p.sector_nombre; }).filter(Boolean))).sort();
  var owners = (PROS.meta.colaboradores || []);
  var list = PROS.list.filter(function (p) {
    if (f.sector && p.sector_nombre !== f.sector) return false;
    if (f.estado && p.estado !== f.estado) return false;
    if (f.owner === '__none') { if (p.owner_id) return false; }
    else if (f.owner && String(p.owner_id) !== String(f.owner)) return false;
    if (f.q) {
      var hay = (p.empresa + ' ' + (p.contacto_nombre || '') + ' ' + (p.contacto_apellido || '') + ' ' + (p.email || '') + ' ' + (p.cargo || '')).toLowerCase();
      if (hay.indexOf(f.q.toLowerCase()) === -1) return false;
    }
    return true;
  });

  // Orden por urgencia: atrasados primero, luego pendientes por fecha más
  // próxima, y sin actividad al final — mismo criterio de act_atrasadas/
  // act_pendientes/act_proxima que ya usa el badge del kanban (prosActChip).
  if (f.orden === 'urgencia') {
    var rango = function (p) {
      if ((p.act_atrasadas || 0) > 0) return 0;
      if ((p.act_pendientes || 0) > 0) return 1;
      return 2;
    };
    list = list.slice().sort(function (a, b) {
      var ra = rango(a), rb = rango(b);
      if (ra !== rb) return ra - rb;
      if (ra === 1) return (a.act_proxima || '').localeCompare(b.act_proxima || '');
      return 0;
    });
  }

  var rows = list.map(function (p) {
    var contacto = ((p.contacto_nombre || '') + ' ' + (p.contacto_apellido || '')).trim();
    return '<tr data-id="' + p.id + '" style="cursor:pointer;">' +
      '<td style="color:var(--color-white);font-weight:600;">' + esc(p.empresa) + (p.task_id ? ' <i class="fa-solid fa-list-check" title="Tiene tarea en el tablero" style="color:var(--color-accent);font-size:11px;"></i>' : '') + '</td>' +
      '<td>' + esc(contacto || '—') + (p.cargo ? '<div class="text-gray text-xs">' + esc(p.cargo) + '</div>' : '') + '</td>' +
      '<td>' + prosEstadoChip(p.estado) + '</td>' +
      '<td>' + (p.owner_nombre ? esc(p.owner_nombre) : '<span class="text-gray">Sin asignar</span>') + '</td>' +
      '<td class="text-gray text-xs">' + fmtRel(p.ultima_gestion) + (p.interacciones ? ' · ' + p.interacciones + ' gest.' : '') + '</td>' +
      '<td>' + prosActChip(p) + '</td>' +
      '<td style="text-align:right;color:var(--color-gray);"><i class="fa-solid fa-chevron-right"></i></td>' +
    '</tr>';
  }).join('') || emptyState('Sin prospectos con estos filtros.', { colspan: 7 });

  var estadoOpts = '<option value="">Todos los estados</option>' + prosEstados().map(function (e) { return '<option value="' + e.slug + '"' + (f.estado === e.slug ? ' selected' : '') + '>' + esc(e.label) + '</option>'; }).join('');
  var ownerOpts = '<option value="">Todos los responsables</option><option value="__none"' + (f.owner === '__none' ? ' selected' : '') + '>Sin asignar</option>' +
    owners.map(function (o) { return '<option value="' + o.id + '"' + (String(f.owner) === String(o.id) ? ' selected' : '') + '>' + esc(o.name) + '</option>'; }).join('');

  el('prosBody').innerHTML =
    '<div class="bt-toolbar">' +
      '<input id="pr_q" class="form-input" placeholder="Buscar empresa, contacto, email..." style="max-width:230px;padding:8px 12px;font-size:13px;" value="' + esc(f.q) + '">' +
      '<select id="pr_estado" class="form-input" style="width:auto;min-width:150px;padding:8px 10px;font-size:13px;">' + estadoOpts + '</select>' +
      '<select id="pr_owner" class="form-input" style="width:auto;min-width:150px;padding:8px 10px;font-size:13px;">' + ownerOpts + '</select>' +
      '<select id="pr_sec" class="form-input" style="width:auto;min-width:140px;padding:8px 10px;font-size:13px;"><option value="">Todos los sectores</option>' +
        secs.map(function (o) { return '<option' + (o === f.sector ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>' +
      '<select id="pr_orden" class="form-input" style="width:auto;min-width:150px;padding:8px 10px;font-size:13px;">' +
        '<option value=""' + (f.orden === '' ? ' selected' : '') + '>Más recientes</option>' +
        '<option value="urgencia"' + (f.orden === 'urgencia' ? ' selected' : '') + '>Urgencia</option>' +
      '</select>' +
      '<div style="flex:1;"></div>' +
      '<button class="btn btn-secondary btn-small" id="pr_export"><i class="fa-solid fa-download"></i> .txt</button>' +
      '<button class="btn btn-primary btn-small" id="pr_new"><i class="fa-solid fa-plus"></i> Nuevo prospecto</button>' +
    '</div>' +
    '<div class="glass-panel" style="padding:0;overflow:hidden;"><div class="table-container"><table class="table table-pipeline">' +
      '<thead><tr><th>Empresa</th><th>Contacto</th><th>Estado</th><th>Responsable</th><th>Última gestión</th><th>Próximo seguimiento</th><th></th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div></div>' +
    '<div class="text-gray text-xs" style="margin-top:8px;">' + list.length + ' de ' + PROS.list.length + ' prospectos · clic en una fila para gestionar</div>';

  el('pr_q').addEventListener('input', function () { f.q = this.value; prosGestion(); setTimeout(function () { var q = el('pr_q'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }, 0); });
  el('pr_estado').addEventListener('change', function () { f.estado = this.value; prosGestion(); });
  el('pr_owner').addEventListener('change', function () { f.owner = this.value; prosGestion(); });
  el('pr_sec').addEventListener('change', function () { f.sector = this.value; prosGestion(); });
  el('pr_orden').addEventListener('change', function () { f.orden = this.value; prosGestion(); });
  el('pr_new').addEventListener('click', function () { prosRegistrar(null); });
  el('pr_export').addEventListener('click', function () {
    var btn = this; btn.disabled = true;
    fetch('/api/prospectos/export', { headers: { Authorization: 'Bearer ' + API.token } })
      .then(function (r) { if (!r.ok) throw new Error('No se pudo exportar'); return r.blob(); })
      .then(function (b) {
        var u = URL.createObjectURL(b), a = document.createElement('a');
        a.href = u; a.download = 'prospeccion_ecuador.txt'; document.body.appendChild(a); a.click();
        a.remove(); URL.revokeObjectURL(u);
      })
      .catch(function (err) { showAlert(err.message, 'error'); })
      .then(function () { btn.disabled = false; });
  });
  document.querySelectorAll('#prosBody tbody tr[data-id]').forEach(function (tr) {
    tr.addEventListener('click', function () { PROS.sel = Number(tr.getAttribute('data-id')); prosGestion(); });
  });
}

/* ---- Panel Gestionar: pipeline + historial + tarea ---- */
export function prosGestionar(p, editarDatos) {
  var s = sectorById(p.sector_id);
  var contacto = ((p.contacto_nombre || '') + ' ' + (p.contacto_apellido || '')).trim();
  var owners = (PROS.meta.colaboradores || []);
  var ownerSel = '<option value="">— Sin asignar —</option>' + owners.map(function (o) {
    return '<option value="' + o.id + '"' + (String(p.owner_id) === String(o.id) ? ' selected' : '') + '>' + esc(o.name) + '</option>';
  }).join('');
  var estadoSel = prosEstados().map(function (e) {
    return '<option value="' + e.slug + '"' + (p.estado === e.slug ? ' selected' : '') + '>' + esc(e.label) + '</option>';
  }).join('');
  var links = [
    p.telefono ? '<a href="tel:' + esc(p.telefono) + '" class="pill-link"><i class="fa-solid fa-phone"></i> ' + esc(p.telefono) + '</a>' : '',
    p.email ? '<a href="mailto:' + esc(p.email) + '" class="pill-link"><i class="fa-solid fa-envelope"></i> ' + esc(p.email) + '</a>' : '',
    p.web ? '<a href="' + esc(p.web) + '" target="_blank" rel="noopener" class="pill-link"><i class="fa-solid fa-globe"></i> web</a>' : '',
    p.linkedin ? '<a href="' + esc(p.linkedin) + '" target="_blank" rel="noopener" class="pill-link"><i class="fa-brands fa-linkedin"></i> LinkedIn</a>' : ''
  ].filter(Boolean).join('');

  var tareaBtn = p.task_id
    ? '<button class="btn btn-secondary btn-small" id="pg_vertarea"><i class="fa-solid fa-up-right-from-square"></i> Ver en el tablero</button>'
    : '<button class="btn btn-primary btn-small" id="pg_convertir"><i class="fa-solid fa-list-check"></i> Convertir en tarea</button>';

  el('prosBody').innerHTML =
    '<button class="btn btn-secondary btn-small" id="pg_back" style="margin-bottom:12px;"><i class="fa-solid fa-arrow-left"></i> ' + (PROS.from === 'kanban' ? 'Volver al tablero' : 'Volver a la lista') + '</button>' +
    '<div class="glass-panel" style="padding:24px;margin-bottom:16px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;">' +
        '<div>' +
          '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
            '<span class="mini-chip">PROSPECTO</span>' +
            (p.task_id ? '<span class="mini-chip" style="background:rgba(255,107,0,.15);color:#ffb27a;">→ TAREA' + (p.task_estado ? ' · ' + esc(p.task_estado) : '') + '</span>' : '') +
          '</div>' +
          '<h2 style="color:var(--color-white);font-size:20px;font-weight:800;margin:6px 0 0;">' + esc(p.empresa) + '</h2>' +
          '<div class="text-gray text-sm" style="margin-top:4px;">' + esc(s ? s.icono + ' ' + s.nombre : (p.sector_nombre || 'Sin sector')) +
            (contacto ? ' · ' + esc(contacto) : '') + (p.cargo ? ' (' + esc(p.cargo) + ')' : '') + '</div>' +
          (links ? '<div class="pill-row" style="margin-top:10px;">' + links + '</div>' : '') +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;">' + tareaBtn +
          '<button class="btn btn-error btn-small" id="pg_del"><i class="fa-solid fa-trash"></i></button>' +
        '</div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:18px;max-width:520px;">' +
        '<div><label for="pg_estado" class="text-gray text-xs" style="display:block;margin-bottom:6px;">Estado</label>' +
          '<select id="pg_estado" class="form-input">' + estadoSel + '</select></div>' +
        '<div><label for="pg_owner" class="text-gray text-xs" style="display:block;margin-bottom:6px;">Responsable comercial</label>' +
          '<select id="pg_owner" class="form-input">' + ownerSel + '</select></div>' +
      '</div>' +
    '</div>' +

    '<div class="glass-panel" id="pg_act_panel" style="padding:20px;margin-bottom:16px;"></div>' +

    '<div class="glass-panel" style="padding:20px;margin-bottom:16px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px;">' +
        '<div class="section-heading" style="text-align:left;font-size:13px;margin:0;">Datos del prospecto</div>' +
        (editarDatos
          ? '<div style="display:flex;gap:8px;"><button class="btn btn-secondary btn-small" id="pg_canceldatos">Cancelar</button>' +
            '<button class="btn btn-primary btn-small" id="pg_savedatos"><i class="fa-solid fa-floppy-disk"></i> Guardar datos</button></div>'
          : '<button class="btn btn-secondary btn-small" id="pg_editdatos"><i class="fa-solid fa-pen"></i> Modificar</button>') +
      '</div>' +
      '<div id="pg_datos">' + prosFormFieldsHTML('pg_f_', p) + '</div>' +
    '</div>' +

    '<div class="pros-gest-grid">' +
      '<div class="glass-panel" style="padding:20px;">' +
        '<div class="section-heading" style="text-align:left;font-size:13px;margin-bottom:12px;">Registrar interacción</div>' +
        '<select id="pg_tipo" class="form-input">' + prosTipos().map(function (t) { return '<option value="' + t.slug + '">' + esc(t.label) + '</option>'; }).join('') + '</select>' +
        '<select id="pg_res" class="form-input" style="margin-top:10px;"><option value="">Resultado (opcional)…</option>' +
          INTER_RESULTADOS.map(function (r) { return '<option value="' + r.id + '">' + esc(r.label) + '</option>'; }).join('') + '</select>' +
        '<textarea id="pg_nota" class="form-input" rows="3" placeholder="¿Qué pasó? Anotá lo relevante de la conversación…" style="margin-top:10px;"></textarea>' +
        '<div class="bt-drop" id="pg_drop" style="margin-top:10px;"><i class="fa-solid fa-arrow-up-from-bracket"></i>' +
          'Pegá (Ctrl+V), arrastrá o hacé clic para adjuntar imagen o PDF' +
          '<input type="file" id="pg_file_input" accept="image/*,application/pdf" multiple hidden></div>' +
        '<div id="pg_pend" class="files-grid" style="margin-top:8px;"></div>' +
        '<button class="btn btn-primary btn-small" id="pg_addint" style="margin-top:12px;"><i class="fa-solid fa-plus"></i> Agregar al historial</button>' +
      '</div>' +
      '<div class="glass-panel" style="padding:20px;">' +
        '<div class="section-heading" style="text-align:left;font-size:13px;margin-bottom:12px;">Historial</div>' +
        '<div id="pg_timeline">' + loadingHtml() + '</div>' +
      '</div>' +
    '</div>';

  el('pg_back').addEventListener('click', function () {
    if (PROS.from === 'kanban') { PROS.from = null; PROS.sel = null; return viewCrmTablero(); }
    PROS.sel = null; refrescarProspectos(function () { prosGestion(); });
  });
  el('pg_del').addEventListener('click', function () {
    if (!confirm('¿Eliminar el prospecto "' + p.empresa + '" y su historial?')) return;
    API.request('/api/prospectos/' + p.id, { method: 'DELETE' })
      .then(function () { showAlert('Prospecto eliminado.', 'success'); PROS.sel = null; viewProspectos(); })
      .catch(function (err) { showAlert(err.message, 'error'); });
  });

  // ---- estado (select) — sin re-render ----
  el('pg_estado').addEventListener('change', function () {
    var estado = this.value, prev = p.estado; p.estado = estado;
    API.request('/api/prospectos/' + p.id + '/estado', { method: 'PATCH', body: JSON.stringify({ estado: estado }) })
      .then(function () { showAlert('Estado actualizado.', 'success'); })
      .catch(function (err) { showAlert(err.message, 'error'); p.estado = prev; el('pg_estado').value = prev; });
  });
  // ---- responsable (select) — sin re-render ----
  el('pg_owner').addEventListener('change', function () {
    var v = this.value || null, prev = p.owner_id;
    p.owner_id = v ? Number(v) : null;
    p.owner_nombre = v ? (owners.filter(function (o) { return String(o.id) === String(v); })[0] || {}).name : null;
    API.request('/api/prospectos/' + p.id + '/owner', { method: 'PATCH', body: JSON.stringify({ owner_id: v }) })
      .then(function () { showAlert('Responsable actualizado.', 'success'); })
      .catch(function (err) { showAlert(err.message, 'error'); p.owner_id = prev; el('pg_owner').value = prev || ''; });
  });

  // ---- datos del prospecto: bloqueados salvo que se pulse "Modificar" ----
  function bloquearCampos(b) {
    el('pg_datos').querySelectorAll('input, select, textarea').forEach(function (f) { f.disabled = b; });
  }
  if (!editarDatos) {
    bloquearCampos(true);
    el('pg_editdatos').addEventListener('click', function () { prosGestionar(p, true); });
  } else {
    var onSectorChange = function () {
      // re-dibuja la grilla con el sector nuevo (datalist de cargos) preservando lo tipeado
      var vals = prosFormCollect('pg_f_');
      el('pg_datos').innerHTML = prosFormFieldsHTML('pg_f_', Object.assign({}, p, vals, { sector_id: el('pg_f_sector').value }));
      bloquearCampos(false);
      el('pg_f_sector').addEventListener('change', onSectorChange);
    };
    el('pg_f_sector').addEventListener('change', onSectorChange);
    el('pg_canceldatos').addEventListener('click', function () { prosGestionar(p, false); });
    el('pg_savedatos').addEventListener('click', function () {
      var sd = this;
      var b = prosFormCollect('pg_f_');
      if (!b.empresa) { showAlert('La empresa es obligatoria.', 'warning'); prosMarcarErrorEmpresa('pg_f_'); return; }
      sd.disabled = true; sd.textContent = 'Guardando...';
      API.request('/api/prospectos/' + p.id, { method: 'PUT', body: JSON.stringify(b) })
        .then(function (r) {
          Object.assign(p, r.prospecto || b);
          showAlert('Datos guardados.', 'success');
          prosGestionar(p, false);
        })
        .catch(function (err) { showAlert(err.message, 'error'); sd.disabled = false; sd.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar datos'; });
    });
  }

  if (el('pg_convertir')) el('pg_convertir').addEventListener('click', function () {
    var b = this; b.disabled = true;
    API.request('/api/prospectos/' + p.id + '/convertir-tarea', { method: 'POST', body: '{}' })
      .then(function (r) {
        p.task_id = r.task_id; p.task_project_id = r.project_id;
        showAlert('Tarea creada en el cronograma de Turingtech.', 'success');
        boardState.proyectoId = r.project_id;
        boardState.tab = 'cronograma';
        boardState._openTask = r.task_id;
        location.hash = '#/board';
      })
      .catch(function (err) { showAlert(err.message, 'error'); b.disabled = false; });
  });
  if (el('pg_vertarea')) el('pg_vertarea').addEventListener('click', function () {
    if (p.task_project_id) { boardState.proyectoId = p.task_project_id; boardState.tab = 'cronograma'; }
    boardState._openTask = p.task_id;
    location.hash = '#/board';
  });

  renderActividades(p);

  // ---- adjuntos de la interacción: pegar / arrastrar / elegir ----
  var pgPend = [];
  function pgRenderPend() {
    el('pg_pend').innerHTML = pgPend.map(function (f, i) {
      var esImg = /^data:image\//.test(f.data);
      return '<div class="file-card pending"><span class="file-tag">nueva</span>' +
        '<span class="file-open">' + (esImg ? '<img src="' + f.data + '" alt="">' : '<div class="file-pdf"><i class="fa-solid fa-file-pdf"></i></div>') + '</span>' +
        '<div class="file-cap"><span>' + esc((f.nombre || '').slice(0, 16)) + '</span>' +
        '<button type="button" class="file-del" data-pp="' + i + '"><i class="fa-solid fa-xmark"></i></button></div></div>';
    }).join('');
    el('pg_pend').querySelectorAll('[data-pp]').forEach(function (b) {
      b.addEventListener('click', function () { pgPend.splice(Number(b.getAttribute('data-pp')), 1); pgRenderPend(); });
    });
  }
  function pgEncolar(list) {
    Array.prototype.slice.call(list || []).forEach(function (file) {
      if (!/^image\/|^application\/pdf/.test(file.type || '')) { showAlert('"' + (file.name || 'archivo') + '": tipo no admitido.', 'warning'); return; }
      if (file.size > 5 * 1024 * 1024) { showAlert('"' + (file.name || 'archivo') + '" supera 5 MB.', 'warning'); return; }
      var rd = new FileReader();
      rd.onload = function () { pgPend.push({ nombre: file.name || ('captura-' + Date.now() + '.png'), data: rd.result }); pgRenderPend(); };
      rd.readAsDataURL(file);
    });
  }
  var pgDrop = el('pg_drop');
  pgDrop.addEventListener('click', function (e) { if (e.target.tagName !== 'INPUT') el('pg_file_input').click(); });
  pgDrop.addEventListener('dragover', function (e) { e.preventDefault(); pgDrop.classList.add('drag'); });
  pgDrop.addEventListener('dragleave', function () { pgDrop.classList.remove('drag'); });
  pgDrop.addEventListener('drop', function (e) { e.preventDefault(); pgDrop.classList.remove('drag'); pgEncolar(e.dataTransfer.files); });
  el('pg_file_input').addEventListener('change', function () { pgEncolar(this.files); this.value = ''; });
  if (pasteState.handler) document.removeEventListener('paste', pasteState.handler);
  pasteState.handler = function (e) {
    if (!document.getElementById('pg_drop')) { document.removeEventListener('paste', pasteState.handler); pasteState.handler = null; return; }
    var items = (e.clipboardData || {}).items || [], fs = [];
    for (var i = 0; i < items.length; i++) { if (items[i].kind === 'file') fs.push(items[i].getAsFile()); }
    if (fs.length) { e.preventDefault(); pgEncolar(fs); }
  };
  document.addEventListener('paste', pasteState.handler);

  // ---- registrar interacción — recarga solo el timeline ----
  el('pg_addint').addEventListener('click', function () {
    var nota = el('pg_nota').value.trim(), resultado = el('pg_res').value, tipo = el('pg_tipo').value;
    if (!nota && !resultado && !pgPend.length) { showAlert('Escribí una nota, elegí un resultado o adjuntá una imagen.', 'warning'); return; }
    var b = this; b.disabled = true;
    var body = { tipo: tipo, resultado: resultado || null, nota: nota || null, files: pgPend };
    API.request('/api/prospectos/' + p.id + '/interacciones', { method: 'POST', body: JSON.stringify(body) })
      .then(function () {
        el('pg_nota').value = ''; el('pg_res').value = '';
        pgPend = []; pgRenderPend();
        p.interacciones = (p.interacciones || 0) + 1; p.ultima_gestion = new Date().toISOString();
        showAlert('Interacción registrada.', 'success'); cargarTimeline();
      })
      .catch(function (err) { showAlert(err.message, 'error'); })
      .then(function () { b.disabled = false; });
  });

  function cargarTimeline() {
    API.request('/api/prospectos/' + p.id + '/interacciones').then(function (r) {
      var tl = el('pg_timeline'); if (!tl) return;
      var eventos = [];

      // evento: convertido en tarea (al principio de la lista, es lo más reciente si aplica)
      if (p.task_id && p.task_created_at) {
        eventos.push('<div class="tl-item">' +
          '<span class="tl-icon" style="background:rgba(255,107,0,.15);"><i class="fa-solid fa-list-check"></i></span>' +
          '<div style="flex:1;"><div style="font-size:12px;"><strong style="color:var(--color-white);">Convertido en tarea</strong>' +
            ' <span class="text-gray">— ' + fmtRel(p.task_created_at) + '</span></div>' +
            '<div class="text-sm" style="margin-top:3px;">' + esc(p.task_titulo || ('Tarea #' + p.task_id)) +
            (p.task_estado ? ' · <span class="text-accent">' + esc(p.task_estado) + '</span>' : '') + '</div></div></div>');
      }

      (r.interacciones || []).forEach(function (it) {
        var ti = prosTipoDe(it.tipo);
        var imgs = (it.files || []).map(function (f) {
          var esImg = /^image\//.test(f.mime || '');
          return '<div class="file-card" data-fid="' + f.id + '" data-iid="' + it.id + '">' +
            '<a href="' + f.data + '" target="_blank" rel="noopener" class="file-open">' +
              (esImg ? '<img src="' + f.data + '" alt="">' : '<div class="file-pdf"><i class="fa-solid fa-file-pdf"></i></div>') + '</a>' +
            '<div class="file-cap"><span>' + esc((f.nombre || '').slice(0, 14)) + '</span>' +
            '<button type="button" class="file-del" data-delf="' + f.id + '" data-inter="' + it.id + '"><i class="fa-solid fa-xmark"></i></button></div></div>';
        }).join('');
        eventos.push('<div class="tl-item">' +
          '<span class="tl-icon"><i class="' + (ti.icono || 'fa-solid fa-note-sticky') + '"></i></span>' +
          '<div style="flex:1;">' +
            '<div style="font-size:12px;"><strong style="color:var(--color-white);">' + esc(ti.label) + '</strong>' +
              (it.resultado ? ' · <span class="text-accent">' + esc(INTER_RES[it.resultado] || it.resultado) + '</span>' : '') +
              ' <span class="text-gray">— ' + fmtRel(it.created_at) + (it.usuario ? ' · ' + esc(it.usuario) : '') + '</span></div>' +
            (it.nota ? '<div class="text-sm" style="margin-top:3px;white-space:pre-wrap;">' + esc(it.nota) + '</div>' : '') +
            (imgs ? '<div class="files-grid" style="margin-top:6px;">' + imgs + '</div>' : '') +
          '</div>' +
          '<button class="tl-del" data-del="' + it.id + '" title="Eliminar"><i class="fa-solid fa-xmark"></i></button>' +
        '</div>');
      });

      // evento: creado como prospecto (siempre el más antiguo, al final)
      eventos.push('<div class="tl-item">' +
        '<span class="tl-icon" style="background:rgba(148,163,184,.15);"><i class="fa-solid fa-flag"></i></span>' +
        '<div style="flex:1;"><div style="font-size:12px;"><strong style="color:var(--color-white);">Registrado como prospecto</strong>' +
          ' <span class="text-gray">— ' + fmtRel(p.ts || p.created_at) + '</span></div></div></div>');

      tl.innerHTML = eventos.join('');
      tl.querySelectorAll('[data-del]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (!confirm('¿Eliminar esta interacción del historial?')) return;
          API.request('/api/prospectos/' + p.id + '/interacciones/' + this.getAttribute('data-del'), { method: 'DELETE' })
            .then(function () { p.interacciones = Math.max(0, (p.interacciones || 1) - 1); cargarTimeline(); }).catch(function (err) { showAlert(err.message, 'error'); });
        });
      });
      tl.querySelectorAll('[data-delf]').forEach(function (b) {
        b.addEventListener('click', function (e) {
          e.preventDefault();
          if (!confirm('¿Quitar esta imagen?')) return;
          API.request('/api/prospectos/' + p.id + '/interacciones/' + b.getAttribute('data-inter') + '/files/' + b.getAttribute('data-delf'), { method: 'DELETE' })
            .then(cargarTimeline).catch(function (err) { showAlert(err.message, 'error'); });
        });
      });
    });
  }
  cargarTimeline();
}

/* ---- Panel de actividades programadas del prospecto ---- */
export function renderActividades(p) {
  var box = el('pg_act_panel'); if (!box) return;
  var tipos = (PROS.meta.actividadTipos || ['llamada', 'linkedin', 'whatsapp', 'reunion', 'otro']);
  function pintar(acts) {
    var hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    var pend = acts.filter(function (a) { return !a.hecha; });
    var banner = pend.length === 0
      ? '<div class="act-banner"><i class="fa-solid fa-circle-exclamation"></i> Este prospecto no tiene ninguna actividad programada.</div>' : '';
    var lista = acts.map(function (a) {
      var d = parseDateLocal(a.deadline);
      var venc = !a.hecha && d && d < hoy;
      return '<div class="act-row' + (a.hecha ? ' done' : '') + (venc ? ' late' : '') + '">' +
        '<button class="act-check ' + (a.hecha ? 'on' : '') + '" data-done="' + a.id + '" title="' + (a.hecha ? 'Reabrir' : 'Marcar hecha') + '"><i class="fa-solid ' + (a.hecha ? 'fa-circle-check' : 'fa-circle') + '"></i></button>' +
        '<span class="act-ico"><i class="' + (ACT_ICONO[a.tipo] || 'fa-solid fa-thumbtack') + '"></i></span>' +
        '<span class="act-main"><strong>' + esc(ACT_LABEL[a.tipo] || a.tipo) + '</strong>' + (a.titulo ? ' · ' + esc(a.titulo) : '') +
          '<span class="act-date">' + (a.deadline ? fmtDate(a.deadline) : 'sin fecha') + (venc ? ' · vencida' : '') + '</span></span>' +
        '<button class="act-del" data-del="' + a.id + '" title="Eliminar"><i class="fa-solid fa-xmark"></i></button>' +
      '</div>';
    }).join('') || '<p class="text-gray text-xs" style="margin:4px 0 8px;">Sin actividades.</p>';

    box.innerHTML =
      '<div class="section-heading" style="text-align:left;font-size:13px;margin-bottom:10px;">Actividades ' +
        (pend.length ? '<span class="text-gray text-xs">(' + pend.length + ' pendiente' + (pend.length > 1 ? 's' : '') + ')</span>' : '') + '</div>' +
      banner +
      '<div class="act-list">' + lista + '</div>' +
      '<form id="act_form" class="act-form">' +
        '<select id="act_tipo" class="form-input">' + tipos.map(function (t) { return '<option value="' + t + '">' + esc(ACT_LABEL[t] || t) + '</option>'; }).join('') + '</select>' +
        '<input id="act_titulo" class="form-input" placeholder="Detalle (opcional)">' +
        '<input type="date" id="act_deadline" class="form-input" required title="Fecha límite">' +
        '<button class="btn btn-primary btn-small" type="submit"><i class="fa-solid fa-plus"></i></button>' +
      '</form>';

    box.querySelectorAll('[data-done]').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = acts.filter(function (x) { return String(x.id) === b.getAttribute('data-done'); })[0];
        API.request('/api/prospectos/' + p.id + '/actividades/' + b.getAttribute('data-done'), { method: 'PATCH', body: JSON.stringify({ hecha: !a.hecha }) })
          .then(cargar).catch(function (err) { showAlert(err.message, 'error'); });
      });
    });
    box.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!confirm('¿Eliminar esta actividad?')) return;
        API.request('/api/prospectos/' + p.id + '/actividades/' + b.getAttribute('data-del'), { method: 'DELETE' })
          .then(cargar).catch(function (err) { showAlert(err.message, 'error'); });
      });
    });
    el('act_form').addEventListener('submit', function (e) {
      e.preventDefault();
      var body = { tipo: el('act_tipo').value, titulo: el('act_titulo').value.trim() || null, deadline: el('act_deadline').value || null };
      if (!body.deadline) { showAlert('Poné una fecha límite.', 'warning'); return; }
      API.request('/api/prospectos/' + p.id + '/actividades', { method: 'POST', body: JSON.stringify(body) })
        .then(function () { showAlert('Actividad agregada.', 'success'); cargar(); })
        .catch(function (err) { showAlert(err.message, 'error'); });
    });
  }
  function cargar() {
    return API.request('/api/prospectos/' + p.id + '/actividades').then(function (r) {
      var acts = r.actividades || [];
      p.act_pendientes = acts.filter(function (a) { return !a.hecha; }).length;
      pintar(acts);
    });
  }
  cargar();
}

// refresco silencioso de la lista de prospectos (sin re-render)
export function refrescarProspectos(cb) {
  API.request('/api/prospectos').then(function (r) {
    PROS.list = r.prospectos || []; PROS.meta = r.meta || PROS.meta;
    if (cb) cb();
  }).catch(function () { if (cb) cb(); });
}

/* ---- Admin: catálogo de estados y tipos de interacción ---- */
export function viewAdminProspectos() {
  return API.request('/api/prospectos/catalogo').then(function (r) {
    var be = r.board_estados || ['Tareas por hacer', 'En curso', 'Client Review', 'Control de calidad', 'Finalizada', 'Bloqueado'];

    function estadoRow(e) {
      var isNew = !e.id;
      var beOpts = be.map(function (b) { return '<option' + (b === (e.board_estado || 'En curso') ? ' selected' : '') + '>' + esc(b) + '</option>'; }).join('');
      var KB = [['por_prospectar', 'Por prospectar'], ['prospectando', 'Prospectando'], ['exitoso', 'Exitosos'], ['rechazado', 'Rechazados']];
      var kbOpts = KB.map(function (k) { return '<option value="' + k[0] + '"' + ((e.kanban || 'prospectando') === k[0] ? ' selected' : '') + '>' + k[1] + '</option>'; }).join('');
      return '<div class="cat-row" data-id="' + (e.id || '') + '">' +
        '<input type="color" class="cat-color" value="' + (e.color || '#94a3b8') + '">' +
        '<input class="form-input cat-label" placeholder="Nombre del estado" value="' + esc(e.label || '') + '">' +
        '<select class="form-input cat-be" title="Estado equivalente en el tablero">' + beOpts + '</select>' +
        '<select class="form-input cat-kanban" title="Columna del tablero CRM">' + kbOpts + '</select>' +
        '<input type="number" class="form-input cat-orden" title="Orden" value="' + (e.orden || 0) + '">' +
        (isNew
          ? '<button class="btn btn-primary btn-small cat-add">Agregar</button>'
          : '<label class="cat-act"><input type="checkbox" class="cat-activo"' + (e.activo ? ' checked' : '') + '> activo</label>' +
            '<button class="btn btn-secondary btn-small cat-save">Guardar</button>' +
            '<button class="btn btn-error btn-small cat-del" title="Eliminar">✕</button>') +
      '</div>';
    }
    function tipoRow(t) {
      var isNew = !t.id;
      return '<div class="cat-row cat-row-tipo" data-id="' + (t.id || '') + '">' +
        '<span class="cat-icoprev"><i class="' + esc(t.icono || 'fa-solid fa-note-sticky') + '"></i></span>' +
        '<input class="form-input cat-label" placeholder="Nombre" value="' + esc(t.label || '') + '">' +
        '<input class="form-input cat-icono" placeholder="fa-solid fa-phone" value="' + esc(t.icono || '') + '">' +
        '<input type="number" class="form-input cat-orden" title="Orden" value="' + (t.orden || 0) + '">' +
        (isNew
          ? '<button class="btn btn-primary btn-small cat-add">Agregar</button>'
          : '<label class="cat-act"><input type="checkbox" class="cat-activo"' + (t.activo ? ' checked' : '') + '> activo</label>' +
            '<button class="btn btn-secondary btn-small cat-save">Guardar</button>' +
            '<button class="btn btn-error btn-small cat-del" title="Eliminar">✕</button>') +
      '</div>';
    }

    el('view').innerHTML =
      '<div class="glass-panel" style="padding:24px;margin-bottom:16px;">' +
        '<div class="section-heading" style="text-align:left;margin-bottom:6px;">Estados del pipeline de prospectos</div>' +
        '<p class="text-gray text-xs mb-3">El color se usa en las etiquetas. "Estado en el tablero" es a qué columna del tablero pasa la tarea vinculada cuando el prospecto llega a este estado.</p>' +
        '<div id="cat_estados" class="cat-list">' + r.estados.map(estadoRow).join('') + '</div>' +
        '<div class="cat-list" style="margin-top:10px;">' + estadoRow({}) + '</div>' +
      '</div>' +
      '<div class="glass-panel" style="padding:24px;">' +
        '<div class="section-heading" style="text-align:left;margin-bottom:6px;">Tipos de interacción</div>' +
        '<p class="text-gray text-xs mb-3">El ícono es una clase de Font Awesome (ej. <code>fa-solid fa-phone</code>, <code>fa-brands fa-whatsapp</code>).</p>' +
        '<div id="cat_tipos" class="cat-list">' + r.tipos.map(tipoRow).join('') + '</div>' +
        '<div class="cat-list" style="margin-top:10px;">' + tipoRow({}) + '</div>' +
      '</div>';

    function bodyEstado(row) {
      return {
        label: row.querySelector('.cat-label').value.trim(),
        color: row.querySelector('.cat-color').value,
        board_estado: row.querySelector('.cat-be').value,
        kanban: row.querySelector('.cat-kanban') ? row.querySelector('.cat-kanban').value : 'prospectando',
        orden: Number(row.querySelector('.cat-orden').value) || 0,
        activo: row.querySelector('.cat-activo') ? row.querySelector('.cat-activo').checked : true
      };
    }
    function bodyTipo(row) {
      return {
        label: row.querySelector('.cat-label').value.trim(),
        icono: row.querySelector('.cat-icono').value.trim(),
        orden: Number(row.querySelector('.cat-orden').value) || 0,
        activo: row.querySelector('.cat-activo') ? row.querySelector('.cat-activo').checked : true
      };
    }
    function wire() {
      el('view').querySelectorAll('.cat-row').forEach(function (row) {
        var id = row.getAttribute('data-id');
        var isTipo = row.classList.contains('cat-row-tipo');
        if (row.querySelector('.cat-icono')) {
          row.querySelector('.cat-icono').addEventListener('input', function () {
            row.querySelector('.cat-icoprev').innerHTML = '<i class="' + esc(this.value || 'fa-solid fa-note-sticky') + '"></i>';
          });
        }
        var add = row.querySelector('.cat-add');
        if (add) add.addEventListener('click', function () {
          var b = (isTipo ? bodyTipo : bodyEstado)(row);
          if (!b.label) { showAlert('Escribí un nombre.', 'warning'); return; }
          API.request('/api/prospectos/catalogo/' + (isTipo ? 'tipos' : 'estados'), { method: 'POST', body: JSON.stringify(b) })
            .then(function () { showAlert('Agregado.', 'success'); viewAdminProspectos(); })
            .catch(function (err) { showAlert(err.message, 'error'); });
        });
        var sv = row.querySelector('.cat-save');
        if (sv) sv.addEventListener('click', function () {
          var b = (isTipo ? bodyTipo : bodyEstado)(row);
          if (!b.label) { showAlert('Escribí un nombre.', 'warning'); return; }
          API.request('/api/prospectos/catalogo/' + (isTipo ? 'tipos/' : 'estados/') + id, { method: 'PUT', body: JSON.stringify(b) })
            .then(function () { showAlert('Guardado.', 'success'); })
            .catch(function (err) { showAlert(err.message, 'error'); });
        });
        var dl = row.querySelector('.cat-del');
        if (dl) dl.addEventListener('click', function () {
          if (!confirm('¿Eliminar? Si está en uso, desactivalo mejor.')) return;
          API.request('/api/prospectos/catalogo/' + (isTipo ? 'tipos/' : 'estados/') + id, { method: 'DELETE' })
            .then(function () { showAlert('Eliminado.', 'success'); viewAdminProspectos(); })
            .catch(function (err) { showAlert(err.message, 'error'); });
        });
      });
    }
    wire();
  });
}

