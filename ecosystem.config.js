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
        DATABASE_URL: 'postgresql://gonzalva_user:CONTRASEÑA_PROD@localhost:5432/gonzalva_prod',
        JWT_SECRET: 'REEMPLAZAR_CON_64_CARACTERES_ALEATORIOS_PROD',
        GEMINI_API_KEY: '',  // Obtener en https://aistudio.google.com/apikey
        GOOGLE_SERVICE_ACCOUNT_KEY: '',  // JSON de la cuenta de servicio
        GOOGLE_DRIVE_FOLDER_ID: '',  // ID de la carpeta en Drive
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
        DATABASE_URL: 'postgresql://gonzalva_user:CONTRASEÑA_TEST@localhost:5432/gonzalva_test',
        JWT_SECRET: 'REEMPLAZAR_CON_64_CARACTERES_ALEATORIOS_TEST',
        GEMINI_API_KEY: '',  // Obtener en https://aistudio.google.com/apikey
        GOOGLE_SERVICE_ACCOUNT_KEY: '',  // JSON de la cuenta de servicio
        GOOGLE_DRIVE_FOLDER_ID: '',  // ID de la carpeta en Drive
      },
    },
  ],
}
