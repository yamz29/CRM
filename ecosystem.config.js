// PM2 Ecosystem — Gonzalva ERP
// Producción:  pm2 start ecosystem.config.js --only crm-prod
// Test:        pm2 start ecosystem.config.js --only crm-test
// Ambos:       pm2 start ecosystem.config.js
// Reiniciar:   pm2 reload ecosystem.config.js

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
        NODE_ENV: 'production',
        PORT: 3000,
        DATABASE_URL: 'file:/var/www/crm/prisma/data/prod.db',
        JWT_SECRET: 'REEMPLAZAR_CON_SECRET_PRODUCCION',
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
        NODE_ENV: 'production',
        PORT: 3001,
        DATABASE_URL: 'file:/var/www/crm/prisma/data/test.db',
        JWT_SECRET: 'REEMPLAZAR_CON_SECRET_TEST',
      },
    },
  ],
}
