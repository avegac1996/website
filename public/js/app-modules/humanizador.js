// Humanizador de texto/docx. Dividido del <script> monolítico de app.html.
import { API } from '../api-bridge.js';
import { el, esc } from './core.js';

/* ===== Humanizador de texto ===== */
export var HUM = { version: 'v2', text: '', filename: '', docx_base64: null, result: null, stats: null, busy: false };

export function viewHumanizador() {
  humRender();
  return Promise.resolve();
}

export function humRender() {
  el('view').innerHTML =
    '<div class="glass-panel" style="padding:24px;margin-bottom:18px;">' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:16px;">' +
        '<span class="text-gray text-sm">Versión:</span>' +
        '<div class="tabs" style="margin:0;border:none;">' +
          '<button class="tab ' + (HUM.version === 'v1' ? 'active' : '') + '" data-hv="v1">v1 · Original</button>' +
          '<button class="tab ' + (HUM.version === 'v2' ? 'active' : '') + '" data-hv="v2">v2 · Mejorada</button>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px;">' +
        '<input type="file" id="hm_file" accept=".txt,.md,.markdown,.text,.docx" style="display:none;">' +
        '<button class="btn btn-secondary btn-small" id="hm_pick"><i class="fa-solid fa-file-arrow-up"></i> Insertar archivo (.txt, .md, .docx)</button>' +
        '<span class="text-gray text-xs" id="hm_fname">' + (HUM.filename ? esc(HUM.filename) : 'o pega el texto abajo') + '</span>' +
      '</div>' +
      '<textarea id="hm_text" class="form-input" rows="9" placeholder="Pega aquí el texto a humanizar...">' + esc(HUM.text) + '</textarea>' +
      '<div style="margin-top:14px;display:flex;gap:10px;align-items:center;">' +
        '<button class="btn btn-primary" id="hm_run" ' + (HUM.busy ? 'disabled' : '') + '><i class="fa-solid fa-wand-magic-sparkles"></i> ' + (HUM.busy ? 'Procesando...' : 'Humanizar') + '</button>' +
        '<button class="btn btn-secondary btn-small" id="hm_clear">Limpiar</button>' +
      '</div>' +
      '<div id="hm_prog" class="hm-progress" style="display:none;">' +
        '<div class="hm-prog-bar"><div class="hm-prog-fill" id="hm_prog_fill"></div></div>' +
        '<div class="hm-prog-label"><span id="hm_prog_stage">Procesando…</span><span id="hm_prog_pct">0%</span></div>' +
      '</div>' +
    '</div>' +
    '<div id="hm_out"></div>';

  document.querySelectorAll('[data-hv]').forEach(function (b) {
    b.addEventListener('click', function () { HUM.version = this.getAttribute('data-hv'); humRender(); });
  });
  el('hm_pick').addEventListener('click', function () { el('hm_file').click(); });
  el('hm_text').addEventListener('input', function () { HUM.text = this.value; HUM.filename = ''; HUM.docx_base64 = null; });
  el('hm_clear').addEventListener('click', function () { HUM = { version: HUM.version, text: '', filename: '', docx_base64: null, result: null, stats: null, busy: false }; humRender(); });
  el('hm_file').addEventListener('change', function () {
    var f = this.files && this.files[0]; if (!f) return;
    HUM.filename = f.name;
    var isDocx = /\.docx$/i.test(f.name);
    var reader = new FileReader();
    reader.onload = function (ev) {
      if (isDocx) {
        var dataUrl = String(ev.target.result || '');
        HUM.docx_base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
        HUM.text = '';
        el('hm_text').value = ''; el('hm_text').placeholder = '(.docx cargado: ' + f.name + ')';
      } else {
        HUM.text = ev.target.result; HUM.docx_base64 = null;
        el('hm_text').value = HUM.text;
      }
      el('hm_fname').textContent = f.name;
    };
    reader.onerror = function () { showAlert('No se pudo leer el archivo.', 'error'); };
    if (isDocx) reader.readAsDataURL(f); else reader.readAsText(f);
  });
  el('hm_run').addEventListener('click', humRun);
  if (HUM.result != null) humRenderOut();
}

export function humRun() {
  if (!HUM.docx_base64 && !el('hm_text').value.trim()) { showAlert('Inserta un archivo o pega texto.', 'warning'); return; }
  HUM.text = el('hm_text').value;
  HUM.busy = true; HUM.result = null; humRender();

  var prog = el('hm_prog'), fill = el('hm_prog_fill'), stg = el('hm_prog_stage'), pct = el('hm_prog_pct');
  prog.style.display = 'block';
  var setProg = function (f, s) {
    var p = Math.round(f * 100);
    fill.style.width = p + '%'; pct.textContent = p + '%';
    if (s) stg.textContent = s;
  };
  setProg(0.02, 'Enviando…');

  fetch('/api/humanizer?stream=1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API.token },
    body: JSON.stringify({ version: HUM.version, text: HUM.docx_base64 ? undefined : HUM.text, docx_base64: HUM.docx_base64 || undefined })
  }).then(function (resp) {
    if (!resp.ok || !resp.body || !resp.body.getReader) {
      return resp.json().then(function (j) {
        if (j.error) throw new Error(j.error);
        if (j.result != null) { HUM.result = j.result; HUM.stats = j.stats; setProg(1, 'Listo'); return; }
        throw new Error('Respuesta no válida');
      });
    }
    var reader = resp.body.getReader(), dec = new TextDecoder(), buf = '';
    function pump() {
      return reader.read().then(function (res) {
        if (res.value) buf += dec.decode(res.value, { stream: true });
        var lines = buf.split('\n'); buf = lines.pop();
        lines.forEach(function (ln) {
          if (!ln.trim()) return;
          var evt; try { evt = JSON.parse(ln); } catch (e) { return; }
          if (evt.error) throw new Error(evt.error);
          if (evt.done) { HUM.result = evt.result; HUM.stats = evt.stats; setProg(1, 'Listo'); }
          else if (typeof evt.progress === 'number') setProg(evt.progress, evt.stage);
        });
        if (res.done) return;
        return pump();
      });
    }
    return pump();
  }).then(function () {
    HUM.busy = false;
    setTimeout(function () { humRender(); }, 250);
  }).catch(function (err) {
    HUM.busy = false;
    showAlert(err.message, 'error');
    humRender();
  });
}

export function humRenderOut() {
  var s = HUM.stats || {};
  el('hm_out').innerHTML =
    '<div class="glass-panel" style="padding:24px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;">' +
        '<div class="section-heading" style="text-align:left;margin:0;">Resultado (texto plano)</div>' +
        '<div style="display:flex;gap:8px;">' +
          '<button class="btn btn-primary btn-small" id="hm_dl"><i class="fa-solid fa-download"></i> Descargar .txt</button>' +
          '<button class="btn btn-secondary btn-small" id="hm_copy">Copiar</button>' +
        '</div>' +
      '</div>' +
      '<div class="text-gray text-xs mb-2">' + esc(s.version || '') + ' · ' + (s.in_chars || 0).toLocaleString() + ' → ' + (s.out_chars || 0).toLocaleString() + ' caracteres · ' + (s.ms || 0) + ' ms</div>' +
      '<textarea class="form-input" id="hm_result" rows="16" readonly style="font-family:ui-monospace,monospace;font-size:12.5px;">' + esc(HUM.result) + '</textarea>' +
    '</div>';
  el('hm_copy').addEventListener('click', function () { navigator.clipboard.writeText(HUM.result); showAlert('Copiado.', 'success'); });
  el('hm_dl').addEventListener('click', function () {
    var base = (HUM.filename || 'texto').replace(/\.[^.]+$/, '');
    var blob = new Blob([HUM.result], { type: 'text/plain;charset=utf-8' });
    var u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = base + '_humanizado.txt'; document.body.appendChild(a); a.click();
    a.remove(); URL.revokeObjectURL(u);
  });
}

