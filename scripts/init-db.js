/**
 * init-db  —  crea/actualiza el ESQUEMA completo de la base `turingtech`.
 *
 *   npm run init-db
 *
 * Idempotente: CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS, así que
 * sirve tanto en una base nueva como para poner al día una existente.
 * Para cargar además los DATOS usa `npm run init:iniciar` (o `npm run seed`).
 */
const db = require('../src/config/database');

async function initDatabase() {
  console.log('Inicializando esquema de la base TURINGTECH...\n');

  try {
    // ---------------- users ----------------
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'user',
        account_type VARCHAR(20) NOT NULL DEFAULT 'cliente',   -- cliente | colaborador
        credits INTEGER NOT NULL DEFAULT 0,                    -- saldo (se muestra como "créditos" o "Turingcoins")
        handycoins INTEGER NOT NULL DEFAULT 0,                 -- espejo de credits (compat.)
        email_verified BOOLEAN NOT NULL DEFAULT false,
        active BOOLEAN NOT NULL DEFAULT true,
        verification_token VARCHAR(255),
        company VARCHAR(200),
        position VARCHAR(120),                                 -- cargo (colaboradores)
        phone VARCHAR(50),
        photo TEXT,                                            -- foto de perfil (data URL)
        vacation_total INTEGER NOT NULL DEFAULT 10,
        vacation_used INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    // columnas añadidas después (por si la tabla ya existía)
    for (const [col, ddl] of [
      ['account_type', "VARCHAR(20) NOT NULL DEFAULT 'cliente'"],
      ['handycoins', 'INTEGER NOT NULL DEFAULT 0'],
      ['active', 'BOOLEAN NOT NULL DEFAULT true'],
      ['position', 'VARCHAR(120)'],
      ['photo', 'TEXT'],
      ['vacation_total', 'INTEGER NOT NULL DEFAULT 10'],
      ['vacation_used', 'INTEGER NOT NULL DEFAULT 0'],
    ]) {
      await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col} ${ddl}`);
    }
    console.log('[OK] Tabla users');

    // ---------------- créditos ----------------
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
    console.log('[OK] Tablas credit_transactions / credit_requests');

    // ---------------- RRHH (Talento y Cultura) ----------------
    await db.query(`
      CREATE TABLE IF NOT EXISTS hr_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(40) NOT NULL,                 -- certificado_laboral | rol_pagos | vacaciones | permiso | adelanto
        details TEXT,
        start_date DATE,
        end_date DATE,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        admin_notes TEXT,
        reviewed_at TIMESTAMP,
        reviewed_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('[OK] Tabla hr_requests');

    // ---------------- Tablero de proyectos (estilo Jira) ----------------
    await db.query(`
      CREATE TABLE IF NOT EXISTS board_projects (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(200) NOT NULL,
        descripcion TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS board_project_members (
        project_id INTEGER NOT NULL REFERENCES board_projects(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (project_id, user_id)
      );
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS board_tasks (
        id SERIAL PRIMARY KEY,
        titulo TEXT NOT NULL,
        project_id INTEGER REFERENCES board_projects(id),
        proyecto VARCHAR(200),                     -- nombre de proyecto (legado / cache)
        assignee_id INTEGER REFERENCES users(id),
        responsable VARCHAR(60),                   -- primer nombre para mostrar
        tipo VARCHAR(40),
        estado VARCHAR(30) NOT NULL DEFAULT 'Tareas por hacer',
        fecha DATE,
        fecha_fin DATE,
        horas NUMERIC,
        observaciones TEXT,
        orden INTEGER NOT NULL DEFAULT 0,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    for (const [col, ddl] of [
      ['fecha_fin', 'DATE'],
      ['project_id', 'INTEGER REFERENCES board_projects(id)'],
      ['assignee_id', 'INTEGER REFERENCES users(id)'],
    ]) {
      await db.query(`ALTER TABLE board_tasks ADD COLUMN IF NOT EXISTS ${col} ${ddl}`);
    }
    console.log('[OK] Tablas board_projects / board_project_members / board_tasks');

    // ---------------- Prospectos (Matriz B2B Ecuador) ----------------
    await db.query(`
      CREATE TABLE IF NOT EXISTS prospectos (
        id SERIAL PRIMARY KEY,
        ts TIMESTAMP NOT NULL DEFAULT NOW(),
        sector_id VARCHAR(40),
        sector_nombre VARCHAR(140),
        empresa TEXT NOT NULL,
        ruc VARCHAR(30),
        web TEXT,
        contacto_nombre VARCHAR(140),
        contacto_apellido VARCHAR(140),
        cargo TEXT,
        email VARCHAR(200),
        telefono VARCHAR(60),
        linkedin TEXT,
        fuente VARCHAR(40),
        pilar VARCHAR(60),
        fase_sop VARCHAR(10),
        fecha_fase DATE,
        extension_pbx VARCHAR(60),
        horario_preferido VARCHAR(140),
        notas TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('[OK] Tabla prospectos');

    // ---------------- notificaciones ----------------
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
    console.log('[OK] Tabla notifications');

    // ---------------- config ----------------
    await db.query(`
      CREATE TABLE IF NOT EXISTS admin_config (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('[OK] Tabla admin_config');

    // ---------------- índices ----------------
    const indices = [
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON credit_transactions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_requests_user_id ON credit_requests(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_requests_status ON credit_requests(status)',
      'CREATE INDEX IF NOT EXISTS idx_hr_requests_user ON hr_requests(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_hr_requests_status ON hr_requests(status)',
      'CREATE INDEX IF NOT EXISTS idx_board_estado ON board_tasks(estado)',
      'CREATE INDEX IF NOT EXISTS idx_board_project_id ON board_tasks(project_id)',
      'CREATE INDEX IF NOT EXISTS idx_prospectos_sector ON prospectos(sector_id)',
      'CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)',
    ];
    for (const q of indices) await db.query(q);
    console.log('[OK] Índices');

    console.log('\nEsquema listo.');
    process.exit(0);
  } catch (err) {
    console.error('Error inicializando el esquema:', err.message);
    process.exit(1);
  }
}

initDatabase();
