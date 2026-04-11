#!/bin/bash
# ─────────────────────────────────────────────────────────────
# deploy.sh — Gonzalva ERP
# Uso:
#   ./deploy.sh          → actualiza PRODUCCIÓN  (crm-prod)
#   ./deploy.sh test     → actualiza TEST        (crm-test)
#   ./deploy.sh all      → actualiza ambos
# ─────────────────────────────────────────────────────────────

set -e  # salir si cualquier comando falla

TARGET="${1:-prod}"
APP_DIR="/var/www/crm"

echo "========================================="
echo " Gonzalva ERP — Deploy: $TARGET"
echo "========================================="

cd "$APP_DIR"

# Cargar variables de entorno del servidor (nunca en git)
# Este archivo debe existir en la VPS con las URLs de PostgreSQL
if [ -f "$APP_DIR/.env.server" ]; then
  set -a  # auto-export all variables so npm run build can read them
  source "$APP_DIR/.env.server"
  set +a
else
  echo "⚠️  ADVERTENCIA: no existe $APP_DIR/.env.server"
  echo "   Crea ese archivo con DATABASE_URL_PROD y DATABASE_URL_TEST"
  echo "   Ver instrucciones en README-v1.4.md"
fi

# 1. Traer últimos cambios (stash local changes like ecosystem.config.js)
echo ""
echo "→ git pull..."
git stash --quiet 2>/dev/null || true
git pull origin main
git stash pop --quiet 2>/dev/null || true

# 2. Instalar dependencias (si cambiaron)
echo ""
echo "→ npm install..."
npm install --production=false

# 3. Migrar base(s) de datos
echo ""
if [ "$TARGET" = "prod" ] || [ "$TARGET" = "all" ]; then
    echo "→ prisma db push (prod)..."
    DATABASE_URL="$DATABASE_URL_PROD" npx prisma db push --skip-generate
fi

if [ "$TARGET" = "test" ] || [ "$TARGET" = "all" ]; then
    echo "→ prisma db push (test)..."
    DATABASE_URL="$DATABASE_URL_TEST" npx prisma db push --skip-generate
fi

# 3b. Regenerar cliente Prisma (una sola vez, independiente del TARGET)
echo ""
echo "→ prisma generate..."
npx prisma generate

# 4. Build
echo ""
echo "→ next build..."
npm run build

# 5. Reiniciar proceso(s) PM2
echo ""
if [ "$TARGET" = "prod" ] || [ "$TARGET" = "all" ]; then
    echo "→ pm2 restart crm-prod..."
    pm2 restart crm-prod
fi

if [ "$TARGET" = "test" ] || [ "$TARGET" = "all" ]; then
    echo "→ pm2 restart crm-test..."
    pm2 restart crm-test
fi

# 6. Guardar estado de PM2
pm2 save

echo ""
echo "✓ Deploy completado: $TARGET"
echo "========================================="
