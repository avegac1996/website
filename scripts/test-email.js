// Prueba el envío de email con la configuración actual del .env
// Uso: node scripts/test-email.js destino@ejemplo.com
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { sendEmail } = require('../src/services/email.service');

const to = process.argv[2];
if (!to) {
  console.error('Uso: node scripts/test-email.js destino@ejemplo.com');
  process.exit(1);
}

const graph = !!(process.env.MS_TENANT_ID && process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET && process.env.MAIL_SENDER);
console.log(`Modo: ${graph ? 'Microsoft Graph' : 'SMTP'}`);
if (graph) console.log(`Remitente: ${process.env.MAIL_SENDER}`);

sendEmail(
  to,
  'Prueba de envío - TURINGTECH',
  `<h2>Funciona ✅</h2><p>Email de prueba enviado ${new Date().toISOString()}.</p>`
).then((ok) => {
  console.log(ok ? 'OK: email aceptado por el proveedor' : 'FALLO: revisá el error de arriba');
  process.exit(ok ? 0 : 1);
});
