const db = require('../../config/database');
const { ESTADO_FINAL, COIN_PREMIO, COIN_CASTIGO, COIN_REABRIR } = require('./constants');
const { hoyISO, soloFecha } = require('./helpers');

/* ---- Turingcoins por cumplimiento de fechas ---- */

// ajusta el saldo del usuario + registra transacción + notificación
async function ajustarTuringcoins(userId, delta, tipo, descripcion, notifTitulo, notifMensaje) {
  await db.query(
    'UPDATE users SET credits = credits + $1, handycoins = credits + $1, updated_at = NOW() WHERE id = $2',
    [delta, userId]
  );
  await db.query(
    `INSERT INTO credit_transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)`,
    [userId, delta, tipo, descripcion]
  );
  await db.query(
    `INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)`,
    [userId, notifTitulo, notifMensaje, delta >= 0 ? 'reward' : 'penalty']
  );
}

// Reglas de turingcoins dada la tarea ANTES del cambio (old) y los valores nuevos.
//   +COIN_PREMIO           : pasa a "Finalizada" a tiempo (una sola vez; deadline = fecha_fin propia o, si no, la del sprint)
//   -(COIN_PREMIO+REABRIR)  : se reabre una tarea que ya recibió el premio (se revierte + penaliza; nunca más +2)
//   -COIN_CASTIGO           : se extiende fecha_fin propia sin finalizar
async function reglaTuringcoins(old, nuevoEstado, nuevaFechaFin) {
  if (!old || !old.assignee_id) return;
  const eraFinal = old.estado === ESTADO_FINAL;
  const esFinal = nuevoEstado === ESTADO_FINAL;
  const finPrevio = soloFecha(old.fecha_fin);
  const finNuevo = nuevaFechaFin ? soloFecha(nuevaFechaFin) : finPrevio;
  const limite = finNuevo || soloFecha(old.sprint_fin);   // deadline efectivo

  if (esFinal && !eraFinal && !old.recompensa_dada && !old.recompensa_revertida && (!limite || hoyISO() <= limite)) {
    await ajustarTuringcoins(
      old.assignee_id, COIN_PREMIO, 'reward',
      `Reto cumplido: ${old.titulo}`, 'Reto cumplido 🎉',
      `Terminaste "${old.titulo}" a tiempo. Ganaste +${COIN_PREMIO} Turingcoins.`
    );
    await db.query('UPDATE board_tasks SET recompensa_dada = true WHERE id = $1', [old.id]);
  }

  if (eraFinal && !esFinal && old.recompensa_dada && !old.recompensa_revertida) {
    await ajustarTuringcoins(
      old.assignee_id, -(COIN_PREMIO + COIN_REABRIR), 'penalty',
      `Tarea reabierta: ${old.titulo}`, 'Tarea reabierta',
      `Volviste "${old.titulo}" a proceso después de finalizarla: se revierten los +${COIN_PREMIO} y −${COIN_REABRIR} de penalización.`
    );
    await db.query('UPDATE board_tasks SET recompensa_revertida = true WHERE id = $1', [old.id]);
  }

  if (finPrevio && finNuevo > finPrevio && !esFinal && !eraFinal) {
    await ajustarTuringcoins(
      old.assignee_id, -COIN_CASTIGO, 'penalty',
      `Extensión de fecha: ${old.titulo}`, 'No lo lograste a tiempo',
      `Se movió la fecha de fin de "${old.titulo}". Perdiste -${COIN_CASTIGO} Turingcoins.`
    );
  }
}

// trae la tarea con todo lo que necesita reglaTuringcoins
async function tareaParaRegla(id) {
  const r = await db.query(
    `SELECT t.id, t.titulo, t.estado, t.fecha, t.fecha_fin, t.fecha_fin_set_at, t.assignee_id, t.recompensa_dada, t.recompensa_revertida,
            t.project_id, t.sprint_id, s.fecha_fin AS sprint_fin
     FROM board_tasks t LEFT JOIN board_sprints s ON s.id = t.sprint_id
     WHERE t.id = $1`,
    [id]
  );
  return r.rows[0] || null;
}

module.exports = { ajustarTuringcoins, reglaTuringcoins, tareaParaRegla };
