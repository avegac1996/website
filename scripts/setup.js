const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function log(msg, color = RESET) {
  console.log(`${color}${msg}${RESET}`);
}

function run(cmd, label) {
  log(`\n▶ ${label}...`, CYAN);
  try {
    execSync(cmd, { stdio: 'inherit', cwd: __dirname + '/..' });
    log(`✓ ${label} completado`, GREEN);
  } catch (err) {
    log(`✗ Error en: ${label}`, RED);
    log(err.message, RED);
    process.exit(1);
  }
}

async function main() {
  log('\n========================================', CYAN);
  log('  TURINGTECH - Setup Automático', CYAN);
  log('========================================\n', CYAN);

  // 1. Verificar .env
  const envPath = path.join(__dirname, '..', '.env');
  const envExample = path.join(__dirname, '..', '.env.example');
  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(envExample)) {
      fs.copyFileSync(envExample, envPath);
      log('✓ .env creado desde .env.example', GREEN);
      log('  IMPORTANTE: Edita .env con tus credenciales de PostgreSQL y SMTP', YELLOW);
    } else {
      log('✗ No se encontró .env ni .env.example', RED);
      process.exit(1);
    }
  } else {
    log('✓ .env ya existe', GREEN);
  }

  // 2. npm install
  run('npm install', 'Instalando dependencias');

  // 3. Crear base de datos PostgreSQL
  require('dotenv').config({ path: envPath });
  const dbName = process.env.DB_NAME || 'turingtech';
  const dbUser = process.env.DB_USER || 'postgres';
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = process.env.DB_PORT || 5432;

  log(`\n▶ Creando base de datos '${dbName}'...`, CYAN);
  try {
    execSync(
      `psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -c "CREATE DATABASE ${dbName};"`,
      { stdio: 'inherit', cwd: __dirname + '/..' }
    );
    log(`✓ Base de datos '${dbName}' creada`, GREEN);
  } catch (err) {
    log(`⚠ La base de datos '${dbName}' ya existe o no se pudo crear`, YELLOW);
    log('  Si ya existe, esto es normal. Continuando...', YELLOW);
  }

  // 4. init-db
  run('npm run init-db', 'Creando tablas');

  // 5. seed
  run('npm run seed', 'Creando admin y configuración inicial');

  log('\n========================================', GREEN);
  log('  ¡Setup completado!', GREEN);
  log('========================================\n', GREEN);
  log('Credenciales admin:', CYAN);
  log('  Email:    admin@turingtech.com.ec', RESET);
  log('  Password: turingtech2026', RESET);
  log('\nPara iniciar el servidor:', CYAN);
  log('  npm start    (producción)', RESET);
  log('  npm run dev  (desarrollo con nodemon)\n', RESET);
}

main();
