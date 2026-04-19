// PM2 Ecosystem — Gonzalva ERP
//
// Producción:  pm2 start ecosystem.config.js --only crm-prod
// Test:        pm2 start ecosystem.config.js --only crm-test
// Ambos:       pm2 start ecosystem.config.js
// Reiniciar:   pm2 reload ecosystem.config.js
//
// ⚠️ Los secretos NO viven aquí. Se cargan desde /var/www/crm/.env.server
// (en .gitignore). Ese archivo debe contener al menos:
//
//   DATABASE_URL_PROD=postgresql://...
//   DATABASE_URL_TEST=postgresql://...
//   JWT_SECRET=<64+ caracteres aleatorios>
//   GEMINI_API_KEY=
//   GOOGLE_SERVICE_ACCOUNT_KEY=
//   GOOGLE_DRIVE_FOLDER_ID=
//   NEXT_PUBLIC_AZURE_CLIENT_ID=
//   NEXT_PUBLIC_AZURE_TENANT_ID=
//   NEXT_PUBLIC_SP_HOSTNAME=
//   NEXT_PUBLIC_SP_SITE_PATH=
//   NEXT_PUBLIC_SP_ROOT_FOLDER=
//
// Ver .env.server.example para la plantilla completa.

const fs = require('fs')
const path = require('path')

// Carga manual del .env.server (evita dependencia de dotenv en el ecosystem).
function loadEnv(filePath) {
  const env = {}
  if (!fs.existsSync(filePath)) {
    console.warn(`[ecosystem] ${filePath} no existe — la app no arrancará sin DATABASE_URL y JWT_SECRET`)
    return env
  }
  const content = fs.readFileSync(filePath, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    // Remover comillas externas si las hay
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

const SHARED = loadEnv(path.resolve(__dirname, '.env.server'))

// Variables que ambas apps comparten (todo excepto DATABASE_URL y PORT).
const {
  DATABASE_URL_PROD,
  DATABASE_URL_TEST,
  ...shared
} = SHARED

module.exports = {
  apps: [
    // ── PRODUCCIÓN ────────────────────────────────────────────────
    {
      name: 'crm-prod',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/var/www/crm',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        ...shared,
        NODE_ENV: 'production',
        PORT: 3000,
        DATABASE_URL: DATABASE_URL_PROD,
      },
    },

    // ── TEST / STAGING ────────────────────────────────────────────
    {
      name: 'crm-test',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/var/www/crm',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        ...shared,
        NODE_ENV: 'production',
        PORT: 3001,
        DATABASE_URL: DATABASE_URL_TEST,
      },
    },
  ],
}
