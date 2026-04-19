// PM2 Ecosystem — Gonzalva ERP
//
// Producción:  pm2 start ecosystem.config.js --only crm-prod
// Test:        pm2 start ecosystem.config.js --only crm-test
// Ambos:       pm2 start ecosystem.config.js
// Reiniciar:   pm2 reload ecosystem.config.js
//
// ⚠️ Los secretos (DATABASE_URL, JWT_SECRET, API keys) NO deben vivir en este archivo.
// Cada app lee sus variables de un archivo .env propio en el servidor:
//   /var/www/crm/.env.server.prod      (producción)
//   /var/www/crm/.env.server.test      (staging / test)
//
// Esos archivos están en .gitignore y deben crearse manualmente en el VPS
// usando .env.server.example como plantilla.

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
      env_file: '/var/www/crm/.env.server.prod',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
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
      env_file: '/var/www/crm/.env.server.test',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
  ],
}
