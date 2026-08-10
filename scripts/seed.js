const bcrypt = require('bcryptjs');
const db = require('../src/config/database');

async function seed() {
  console.log('Ejecutando seed de TURINGTECH...\n');

  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@turingtech.com.ec';
    const adminPassword = process.env.ADMIN_PASSWORD || 'turingtech2026';
    const notificationEmail = process.env.NOTIFICATION_EMAIL || 'nicole.flores@turingtech.com.ec';

    // Verificar si ya existe el admin
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (existing.rows.length > 0) {
      console.log('[SKIP] Admin ya existe:', adminEmail);
    } else {
      const hash = await bcrypt.hash(adminPassword, 10);
      await db.query(
        `INSERT INTO users (name, email, password_hash, role, credits, email_verified)
         VALUES ($1, $2, $3, 'admin', 0, true)`,
        ['Administrador TURINGTECH', adminEmail, hash]
      );
      console.log('[OK] Admin creado:', adminEmail);
    }

    // Config inicial: email de notificaciones
    const configExisting = await db.query("SELECT id FROM admin_config WHERE key = 'notification_email'");
    if (configExisting.rows.length > 0) {
      console.log('[SKIP] Config notification_email ya existe:', notificationEmail);
    } else {
      await db.query(
        "INSERT INTO admin_config (key, value) VALUES ('notification_email', $1)",
        [notificationEmail]
      );
      console.log('[OK] Config notification_email =', notificationEmail);
    }

    // Config: créditos iniciales
    const creditsExisting = await db.query("SELECT id FROM admin_config WHERE key = 'initial_credits'");
    if (creditsExisting.rows.length > 0) {
      console.log('[SKIP] Config initial_credits ya existe');
    } else {
      const initialCredits = process.env.INITIAL_CREDITS || 2000;
      await db.query(
        "INSERT INTO admin_config (key, value) VALUES ('initial_credits', $1)",
        [String(initialCredits)]
      );
      console.log('[OK] Config initial_credits =', initialCredits);
    }

    console.log('\nSeed completado correctamente.');
    process.exit(0);
  } catch (err) {
    console.error('Error en seed:', err.message);
    process.exit(1);
  }
}

seed();
