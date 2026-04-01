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

# 1. Traer últimos cambios
echo ""
echo "→ git pull..."
git pull origin main

# 2. Instalar dependencias (si cambiaron)
echo ""
echo "→ npm install..."
npm install --production=false

# 3. Migrar base(s) de datos
echo ""
if [ "$TARGET" = "prod" ] || [ "$TARGET" = "all" ]; then
    echo "→ prisma db push (prod)..."
    DATABASE_URL="file:$APP_DIR/prisma/data/prod.db" npx prisma db push --skip-generate
fi

if [ "$TARGET" = "test" ] || [ "$TARGET" = "all" ]; then
    echo "→ prisma db push (test)..."
    DATABASE_URL="file:$APP_DIR/prisma/data/test.db" npx prisma db push --skip-generate
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
    echo "→ pm2 reload crm-prod..."
    pm2 reload crm-prod
fi

if [ "$TARGET" = "test" ] || [ "$TARGET" = "all" ]; then
    echo "→ pm2 reload crm-test..."
    pm2 reload crm-test
fi

# 6. Guardar estado de PM2
pm2 save

echo ""
echo "✓ Deploy completado: $TARGET"
echo "========================================="
