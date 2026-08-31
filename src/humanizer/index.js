/**
 * Humanizador de Texto — portado de humanizador2.py a JS.
 *   v1: réplica del comportamiento original (3 pasadas).
 *   v2: versión mejorada (más cobertura, mejor variación de estructura,
 *       reducción de nominalizaciones y limpieza final más fina).
 * Entrada: texto plano / markdown.  Salida: texto plano.
 */
const D = require('./dictionary');

/* ---------- RNG determinista por pasada (mulberry32) ---------- */
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
const WORD = 'A-Za-zÀ-ÿ0-9';

/* ---------- 1. Signos tipográficos ---------- */
function limpiarSignos(texto) {
  for (const [signo, rep] of Object.entries(D.LIMPIEZA_SIGNOS)) {
    texto = texto.split(signo).join(rep);
  }
  return texto;
}

/* ---------- 2. Frases típicas de IA ---------- */
function eliminarFrasesIa(texto) {
  for (const [pat, rep] of D.FRASES_IA) {
    try { texto = texto.replace(new RegExp(pat, 'gi'), rep); } catch (e) {}
  }
  return texto;
}

/* ---------- 3. Reemplazo de palabras del diccionario ---------- */
function reemplazarPalabras(texto, pasada, rnd, prob) {
  const claves = Object.keys(D.DICCIONARIO).sort((a, b) => b.length - a.length);
  const usadas = new Set();
  for (const clave of claves) {
    let re;
    try {
      re = new RegExp('(?<![' + WORD + '])(' + escapeRe(clave) + ')(?![' + WORD + '])', 'gi');
    } catch (e) { continue; }
    texto = texto.replace(re, function (m) {
      if (rnd() > prob) return m;
      const syn = D.DICCIONARIO[clave];
      let pick = syn[Math.floor(rnd() * syn.length)];
      let tries = 0;
      while (usadas.has(pick.toLowerCase()) && tries < 3) { pick = syn[Math.floor(rnd() * syn.length)]; tries++; }
      usadas.add(pick.toLowerCase());
      // preservar mayúscula inicial
      if (m[0] === m[0].toUpperCase() && m[0] !== m[0].toLowerCase()) {
        return pick.charAt(0).toUpperCase() + pick.slice(1);
      }
      return pick;
    });
  }
  return texto;
}

/* ---------- líneas que no se tocan ---------- */
function esLineaProtegida(l) {
  return !l || /^#{1,6}\s/.test(l) || l.startsWith('|') || l.startsWith('```') ||
    l.startsWith('>') || /^\s*[-*+]\s/.test(l) || /^\s*\d+\.\s/.test(l) || /^-{3,}$/.test(l);
}

function splitOraciones(linea) {
  return linea.split(/(?<=[.!?])\s+/).map((o) => o.trim()).filter(Boolean);
}

/* ---------- 4. Parafraseo de oración ---------- */
function parafrasearOracion(o, rnd) {
  o = o.trim();
  if (o.length < 20) return o;
  let m;
  m = o.match(/^(Se)\s+(\S+)(\s.+)$/);
  if (m && rnd() < 0.25 && m[3].trim().length > 8) {
    o = (m[3].trim().charAt(0).toUpperCase() + m[3].trim().slice(1)) + ' se ' + m[2];
  }
  m = o.match(/^Es (?:importante|necesario|fundamental|esencial|crucial|vital)\s+(?:que|destacar|señalar|mencionar|notar)(.+)$/i);
  if (m && rnd() < 0.30) o = 'Hay que' + m[1];
  if (rnd() < 0.20) o = o.replace(/\bconsiste en\b/gi, 'trata de');
  if (rnd() < 0.15) o = o.replace(/\bpermite\b/gi, 'hace posible');
  if (rnd() < 0.20) o = o.replace(/\brequiere\b/gi, 'necesita').replace(/\brequieren\b/gi, 'necesitan');
  if (rnd() < 0.25) o = o.replace(/\butiliza\b/gi, 'usa').replace(/\butilizar\b/gi, 'usar');
  if (rnd() < 0.20) o = o.replace(/\bproporciona\b/gi, 'ofrece');
  if (rnd() < 0.15) o = o.replace(/^Además,\s*/i, rnd() < 0.5 ? 'También, ' : 'Por otro lado, ');
  if (rnd() < 0.20) o = o.replace(/\bsin embargo\b/gi, ['pero', 'aun así', 'no obstante'][Math.floor(rnd() * 3)]);
  if (rnd() < 0.20) o = o.replace(/\bpor lo tanto\b/gi, ['entonces', 'por eso', 'así que'][Math.floor(rnd() * 3)]);
  if (rnd() < 0.20) o = o.replace(/\ba través de\b/gi, rnd() < 0.5 ? 'mediante' : 'con');
  if (rnd() < 0.12) {
    m = o.match(/^(.+?)\s+(porque|ya que|dado que|pues)\s+(.+)$/i);
    if (m && m[1].length > 20 && m[3].length > 20) {
      o = m[3].charAt(0).toUpperCase() + m[3].slice(1).replace(/\.$/, '') + ', ' + m[2] + ' ' + m[1].toLowerCase();
    }
  }
  if (rnd() < 0.15) o = o.replace(/\bincluye\b/gi, ['cuenta con', 'tiene', 'lleva'][Math.floor(rnd() * 3)]);
  if (rnd() < 0.15) o = o.replace(/\bgenera\b/gi, ['crea', 'produce', 'da'][Math.floor(rnd() * 3)]);
  if (rnd() < 0.15) o = o.replace(/\bimplementa\b/gi, ['pone en marcha', 'aplica', 'hace'][Math.floor(rnd() * 3)]);
  return o;
}

/* ---------- 5. Variar estructura ---------- */
function variarEstructura(texto, rnd, opts) {
  const noTrans = opts && opts.noTrans;
  return texto.split('\n').map(function (linea) {
    linea = linea.replace(/\s+$/, '');
    if (esLineaProtegida(linea.trim())) return linea;
    const oraciones = splitOraciones(linea);
    const nuevas = [];
    for (let i = 0; i < oraciones.length; i++) {
      let o = oraciones[i];
      if (!o) continue;
      if (i > 0 && rnd() < 0.15) {
        const c = D.CONECTORES_NATURALES[Math.floor(rnd() * D.CONECTORES_NATURALES.length)];
        o = c + o.charAt(0).toLowerCase() + o.slice(1);
      }
      if (!noTrans && i > 0 && rnd() < 0.07 && o.length > 45 && o.indexOf(',') > 12) {
        // insertar transición justo después de la primera coma (posición natural)
        const ci = o.indexOf(',');
        o = o.slice(0, ci + 1) + ' ' + D.TRANSICIONES_HUMANAS[Math.floor(rnd() * D.TRANSICIONES_HUMANAS.length)] + o.slice(ci + 1);
      }
      if (o.length > 120 && rnd() < 0.45) {
        const cuts = [];
        const rx = /[,;]\s+(?:y|o|pero|porque|aunque|mientras|cuando|donde|que|e|ni)\s+/g;
        let mm;
        while ((mm = rx.exec(o))) cuts.push(mm.index);
        if (cuts.length) {
          const c = cuts[Math.floor(rnd() * cuts.length)];
          const a = o.slice(0, c).replace(/[,;]$/, '');
          let b = o.slice(c).replace(/^[,;\s]+/, '').trim();
          if (b && a.length > 25 && b.length > 25) { b = b.charAt(0).toUpperCase() + b.slice(1); nuevas.push(a + '.'); o = b; }
        }
      }
      nuevas.push(o);
    }
    return nuevas.filter(Boolean).join(' ');
  }).join('\n');
}

/* ---------- 6. Romper uniformidad (burstiness) ---------- */
function romperUniformidad(texto, rnd) {
  return texto.split('\n').map(function (linea) {
    linea = linea.trim();
    if (esLineaProtegida(linea)) return linea;
    let oraciones = splitOraciones(linea);
    if (oraciones.length < 3) return linea;
    if (rnd() < 0.25) {
      const idx = 1 + Math.floor(rnd() * (oraciones.length - 1));
      const o = oraciones[idx];
      const comas = [];
      const rx = /,\s+/g; let mm;
      while ((mm = rx.exec(o))) comas.push(mm.index);
      if (comas.length && o.length > 70) {
        const c = comas[Math.floor(rnd() * comas.length)];
        const a = o.slice(0, c).replace(/,$/, '').trim();
        let b = o.slice(c).replace(/^[,\s]+/, '').trim();
        if (b && a.length > 24 && b.length > 24) oraciones[idx] = a + '. ' + b.charAt(0).toUpperCase() + b.slice(1);
      }
    }
    if (rnd() < 0.20 && oraciones.length >= 2) {
      const idx = Math.floor(rnd() * (oraciones.length - 1));
      const o1 = oraciones[idx].replace(/\.$/, '');
      const o2 = oraciones[idx + 1];
      if (o2) {
        const con = [' y ', ', además ', ', también ', '. ', '. '][Math.floor(rnd() * 5)];
        oraciones[idx] = o1 + con + o2.charAt(0).toLowerCase() + o2.slice(1);
        oraciones[idx + 1] = '';
      }
    }
    return oraciones.filter(Boolean).join(' ');
  }).join('\n');
}

/* ---------- 7. Limpieza de repeticiones ---------- */
function reducirRepeticion(texto) {
  texto = texto.replace(/ {2,}/g, ' ');
  texto = texto.replace(/\n{3,}/g, '\n\n');
  texto = texto.replace(/\b(que|de|la|el|los|las|en|un|una|y)\s+\1\b/gi, '$1');
  texto = texto.replace(/\s+([,.;:!?])/g, '$1');
  texto = texto.replace(/,\s*\./g, '.');
  texto = texto.replace(/\.\s*\./g, '.');
  // fusionar fragmentos minúsculos (". Xy corto. " -> unir con la siguiente)
  texto = texto.replace(/([.!?])\s+([A-ZÁÉÍÓÚÑ][^.!?]{0,14})([.!?])\s+/g, (m, p1, frag, p2) => p1 + ' ' + frag.toLowerCase() + ', ');
  texto = texto.replace(/,\s+y también\b/gi, '');
  texto = texto.replace(/\b(aparte|además|también),\s+(entonces|por eso|así que)\b/gi, '$2');
  // palabras adyacentes duplicadas: "de eso de eso", "activo activo"
  texto = texto.replace(/\b([a-záéíóúñ]{2,}(?:\s+[a-záéíóúñ]{1,4})?)\s+\1\b/gi, '$1');
  texto = texto.replace(/\bla (empleo|uso)\b/gi, 'el $1');
  texto = texto.replace(/\bel (base|plataforma|cimientos|mejora)\b/gi, 'la $1');
  texto = texto.replace(/\bse\s+(es decir|por ejemplo|en particular|sobre todo),\s*/gi, '');
  texto = texto.replace(/([.!?])\s+([a-záéíóúñ])/g, (m, p, c) => p + ' ' + c.toUpperCase());
  texto = texto.replace(/ {2,}/g, ' ');
  return texto;
}

/* ---------- pasada completa ---------- */
function pasada(texto, n, prob, opts) {
  const rnd = rng(n * 42 + 7);
  texto = limpiarSignos(texto);
  texto = eliminarFrasesIa(texto);
  texto = reemplazarPalabras(texto, n, rnd, prob);
  texto = texto.split('\n').map(function (l) {
    if (esLineaProtegida(l.trim())) return l;
    return splitOraciones(l).map((o) => parafrasearOracion(o, rnd)).join(' ');
  }).join('\n');
  texto = variarEstructura(texto, rnd, opts);
  texto = romperUniformidad(texto, rnd);
  texto = reducirRepeticion(texto);
  return texto;
}

/* ---------- markdown -> texto plano ---------- */
function toPlainText(texto) {
  texto = texto.replace(/^#{1,6}\s+/gm, '');
  texto = texto.replace(/\*\*(.+?)\*\*/g, '$1');
  texto = texto.replace(/\*(.+?)\*/g, '$1');
  texto = texto.replace(/__(.+?)__/g, '$1');
  texto = texto.replace(/`([^`]+)`/g, '$1');
  texto = texto.replace(/^>\s+/gm, '');
  texto = texto.replace(/^\s*[-*+]\s+/gm, '• ');
  texto = texto.replace(/^-{3,}$/gm, '-'.repeat(50));
  texto = texto.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  return texto.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/* ================= v1 (réplica) ================= */
function humanizarV1(texto) {
  for (let n = 1; n <= 3; n++) texto = pasada(texto, n, 0.60 + n * 0.15);
  return toPlainText(texto);
}

/* ================= v2 (mejorada) ================= */
// nominalizaciones -> verbos (reduce el "tono informe")
const NOMINALIZACIONES = [
  [/\bla realización de\b/gi, 'hacer'],
  [/\bla implementación de\b/gi, 'implementar'],
  [/\bla utilización de\b/gi, 'usar'],
  [/\bla creación de\b/gi, 'crear'],
  [/\bla generación de\b/gi, 'generar'],
  [/\bla optimización de\b/gi, 'mejorar'],
  [/\bla identificación de\b/gi, 'identificar'],
  [/\bla evaluación de\b/gi, 'evaluar'],
  [/\bla gestión de\b/gi, 'gestionar'],
  [/\bel desarrollo de\b/gi, 'desarrollar'],
  [/\bel análisis de\b/gi, 'analizar'],
  [/\bcon el objetivo de\b/gi, 'para'],
  [/\bde manera eficiente\b/gi, 'bien'],
  [/\bde forma efectiva\b/gi, 'bien'],
  [/\ben términos de\b/gi, 'en'],
  [/\bjuega un papel\b/gi, 'cumple un rol'],
  [/\bhoy en día\b/gi, () => (Math.random() < 0.5 ? 'hoy' : 'ahora')],
];
// aberturas repetidas de párrafo que la IA abusa
function romperAperturasRepetidas(texto) {
  const lineas = texto.split('\n');
  let prevStart = '';
  return lineas.map((l) => {
    const t = l.trim();
    if (esLineaProtegida(t) || t.length < 20) return l;
    const first = (t.split(/\s+/)[0] || '').toLowerCase().replace(/[.,;:]/, '');
    if (first && first === prevStart && /^(esto|además|también|por|en|el|la|los|las|un|una|para|con|como)$/.test(first)) {
      // reordenar: mover la segunda oración al frente si existe
      const os = splitOraciones(t);
      if (os.length >= 2) { prevStart = ''; return l.replace(t, os[1] + ' ' + os[0]); }
    }
    prevStart = first;
    return l;
  }).join('\n');
}
function humanizarV2(texto) {
  // pasada 0: normalización agresiva de nominalizaciones y muletillas
  for (const [rx, rep] of NOMINALIZACIONES) texto = texto.replace(rx, rep);
  texto = eliminarFrasesIa(texto);
  texto = limpiarSignos(texto);
  // 4 pasadas con probabilidad creciente y más alta que v1 (sin inserción de transiciones intrusivas)
  for (let n = 1; n <= 4; n++) texto = pasada(texto, n * 3, 0.72 + n * 0.06, { noTrans: true });
  texto = romperAperturasRepetidas(texto);
  texto = romperUniformidad(texto, rng(999));
  // quitar adverbios en -mente sobrantes (la IA los amontona)
  texto = texto.replace(/\b(\w+mente)\b(?=[^.!?]*\b\w+mente\b)/g, (m) => (Math.random() < 0.5 ? '' : m)).replace(/ {2,}/g, ' ');
  texto = reducirRepeticion(texto);
  return toPlainText(texto);
}

function humanizar(texto, version) {
  const t0 = Date.now();
  const out = version === 'v2' ? humanizarV2(texto) : humanizarV1(texto);
  return {
    result: out,
    stats: { version: version === 'v2' ? 'v2' : 'v1', in_chars: texto.length, out_chars: out.length, ms: Date.now() - t0 },
  };
}

/* ================= versión asíncrona con progreso ================= */
const _yield = () => new Promise((r) => setImmediate(r));

async function humanizarAsync(texto, version, onProgress) {
  const t0 = Date.now();
  const inChars = texto.length;
  const v = version === 'v2' ? 'v2' : 'v1';
  const report = (f, stage) => { if (onProgress) { try { onProgress(Math.max(0, Math.min(f, 0.99)), stage); } catch (e) {} } };

  let out;
  if (v === 'v2') {
    report(0.04, 'Preparando el texto…');
    for (const [rx, rep] of NOMINALIZACIONES) texto = texto.replace(rx, rep);
    texto = eliminarFrasesIa(texto);
    texto = limpiarSignos(texto);
    await _yield();
    const N = 4;
    for (let n = 1; n <= N; n++) {
      report(0.06 + ((n - 1) / N) * 0.78, 'Pasada ' + n + ' de ' + N + '…');
      await _yield();
      texto = pasada(texto, n * 3, 0.72 + n * 0.06, { noTrans: true });
      await _yield();
    }
    report(0.9, 'Ajustes finales…');
    await _yield();
    texto = romperAperturasRepetidas(texto);
    texto = romperUniformidad(texto, rng(999));
    texto = texto.replace(/\b(\w+mente)\b(?=[^.!?]*\b\w+mente\b)/g, (m) => (Math.random() < 0.5 ? '' : m)).replace(/ {2,}/g, ' ');
    texto = reducirRepeticion(texto);
    out = toPlainText(texto);
  } else {
    const N = 3;
    for (let n = 1; n <= N; n++) {
      report(0.05 + ((n - 1) / N) * 0.85, 'Pasada ' + n + ' de ' + N + '…');
      await _yield();
      texto = pasada(texto, n, 0.60 + n * 0.15);
      await _yield();
    }
    report(0.93, 'Convirtiendo a texto plano…');
    await _yield();
    out = toPlainText(texto);
  }
  report(1, 'Listo');
  return { result: out, stats: { version: v, in_chars: inChars, out_chars: out.length, ms: Date.now() - t0 } };
}

module.exports = { humanizar, humanizarAsync, humanizarV1, humanizarV2, toPlainText };
