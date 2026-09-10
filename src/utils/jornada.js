// Lógica de timbrado / jornada compartida por timbrado.routes.js y el resumen del admin.

// entrada -> almuerzo -> regreso -> salida
const TIPOS = ['entrada', 'almuerzo', 'regreso', 'salida'];
const TIPO_LABEL = { entrada: 'Entrada', almuerzo: 'Salida a almuerzo', regreso: 'Regreso de almuerzo', salida: 'Salida' };

// Ecuador es UTC-5 todo el año
const EC_MS = 5 * 3600 * 1000;
const hoyISO = () => new Date(Date.now() - EC_MS).toISOString().slice(0, 10);
const horaEc = (ts) => new Date(new Date(ts).getTime() - EC_MS).toISOString().slice(11, 16);
const diaDe = (ts) => new Date(new Date(ts).getTime() - EC_MS).toISOString().slice(0, 10);

const fmtHM = (min) => {
  const h = Math.floor(min / 60), m = min % 60;
  return (h ? h + 'h ' : '') + m + 'm';
};

// Resume las marcas de un día (ya ordenadas por ts asc) -> horas efectivas.
// Efectivo = (salida - entrada) - (regreso - almuerzo), con tramos parciales tolerados.
function calcDia(entries, esHoy) {
  const first = (tipo) => entries.find((e) => e.tipo === tipo);
  const last = (tipo) => [...entries].reverse().find((e) => e.tipo === tipo);
  const entrada = first('entrada');
  const almuerzo = first('almuerzo');
  const regreso = first('regreso');
  const salida = last('salida');

  let minutos = 0;
  let abierto = false;
  if (entrada) {
    const ini = new Date(entrada.ts).getTime();
    let finTrabajo;
    if (salida) finTrabajo = new Date(salida.ts).getTime();
    else if (esHoy) { finTrabajo = Date.now(); abierto = true; }
    else {
      const ult = entries[entries.length - 1];
      finTrabajo = ult ? new Date(ult.ts).getTime() : ini;
    }
    const bruto = Math.max(0, finTrabajo - ini);
    let pausa = 0;
    if (almuerzo) {
      const pIni = new Date(almuerzo.ts).getTime();
      const pFin = regreso ? new Date(regreso.ts).getTime()
        : (esHoy && !salida ? Date.now() : finTrabajo);
      pausa = Math.max(0, Math.min(pFin, finTrabajo) - pIni);
    }
    minutos = Math.round((bruto - pausa) / 60000);
    if (minutos < 0) minutos = 0;
  }

  return {
    entrada: entrada ? horaEc(entrada.ts) : null,
    almuerzo: almuerzo ? horaEc(almuerzo.ts) : null,
    regreso: regreso ? horaEc(regreso.ts) : null,
    salida: salida ? horaEc(salida.ts) : null,
    minutos,
    abierto,
  };
}

function sugerido(entries) {
  const tiene = (t) => entries.some((e) => e.tipo === t);
  if (!tiene('entrada')) return 'entrada';
  if (!tiene('almuerzo')) return 'almuerzo';
  if (!tiene('regreso')) return 'regreso';
  if (!tiene('salida')) return 'salida';
  return null;
}

// rowsPorUsuario: filas { tipo, ts, dia } ya ordenadas por dia, ts
function resumenRango(rowsPorUsuario, desde, hasta) {
  const porDia = {};
  rowsPorUsuario.forEach((e) => {
    const d = String(e.dia).slice(0, 10);
    (porDia[d] = porDia[d] || []).push(e);
  });
  const hoy = hoyISO();
  const dias = Object.keys(porDia).sort().map((d) => {
    const c = calcDia(porDia[d], d === hoy);
    return { dia: d, entrada: c.entrada, salida: c.salida, minutos: c.minutos, horas: fmtHM(c.minutos), abierto: c.abierto };
  });
  const totalMin = dias.reduce((a, x) => a + x.minutos, 0);
  return { desde, hasta, dias, total_min: totalMin, total_horas: fmtHM(totalMin), dias_con_marca: dias.length };
}

function rangoDefault(q, spanDias) {
  q = q || {};
  const hasta = /^\d{4}-\d{2}-\d{2}$/.test(q.hasta || '') ? q.hasta : hoyISO();
  let desde = /^\d{4}-\d{2}-\d{2}$/.test(q.desde || '') ? q.desde : null;
  if (!desde) {
    const back = (spanDias || 14) - 1;
    desde = new Date(new Date(hasta + 'T00:00:00Z').getTime() - back * 86400000).toISOString().slice(0, 10);
  }
  return { desde, hasta };
}

// lunes de la semana ISO que contiene `refISO` (YYYY-MM-DD)
function lunesDeSemana(refISO) {
  const d = new Date((refISO || hoyISO()) + 'T00:00:00Z');
  const dow = (d.getUTCDay() + 6) % 7; // 0 = lunes
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

module.exports = {
  TIPOS, TIPO_LABEL, EC_MS,
  hoyISO, horaEc, diaDe, fmtHM,
  calcDia, sugerido, resumenRango, rangoDefault, lunesDeSemana,
};
