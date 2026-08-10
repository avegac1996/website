const db = require('../src/config/database');

async function initDatabase() {
  console.log('Inicializando base de datos TURINGTECH...\n');

  try {
    // Tabla users
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'user',
        credits INTEGER NOT NULL DEFAULT 0,
        email_verified BOOLEAN NOT NULL DEFAULT false,
        verification_token VARCHAR(255),
        company VARCHAR(200),
        phone VARCHAR(50),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('[OK] Tabla users creada');

    // Tabla credit_transactions
    await db.query(`
      CREATE TABLE IF NOT EXISTS credit_transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL,
        type VARCHAR(30) NOT NULL,
        description TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('[OK] Tabla credit_transactions creada');

    // Tabla credit_requests
    await db.query(`
      CREATE TABLE IF NOT EXISTS credit_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        project_description TEXT NOT NULL,
        requested_credits INTEGER NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        admin_notes TEXT,
        reviewed_at TIMESTAMP,
        reviewed_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('[OK] Tabla credit_requests creada');

    // Tabla notifications
    await db.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('[OK] Tabla notifications creada');

    // Tabla admin_config
    await db.query(`
      CREATE TABLE IF NOT EXISTS admin_config (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('[OK] Tabla admin_config creada');

    // Índices
    await db.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);');
    await db.query('CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON credit_transactions(user_id);');
    await db.query('CREATE INDEX IF NOT EXISTS idx_requests_user_id ON credit_requests(user_id);');
    await db.query('CREATE INDEX IF NOT EXISTS idx_requests_status ON credit_requests(status);');
    await db.query('CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);');
    console.log('[OK] Índices creados');

    console.log('\nBase de datos inicializada correctamente.');
    process.exit(0);
  } catch (err) {
    console.error('Error inicializando BD:', err.message);
    process.exit(1);
  }
}

initDatabase();
