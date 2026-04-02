#!/bin/bash
# ─────────────────────────────────────────────────────────────
# backup-db.sh  — Daily PostgreSQL backup for CRM
#
# Usage:
#   ./scripts/backup-db.sh [prod|test|all]   (default: all)
#
# Setup (run once on VPS as root or deployer user):
#   chmod +x /var/www/crm/scripts/backup-db.sh
#   crontab -e
#   # Add this line for daily backup at 3:00 AM:
#   0 3 * * * /var/www/crm/scripts/backup-db.sh all >> /var/log/crm-backup.log 2>&1
#
# Backup retention: keeps last 14 days automatically.
# ─────────────────────────────────────────────────────────────

set -euo pipefail

ENV_FILE="/var/www/crm/.env.server"
BACKUP_DIR="/var/www/crm/backups"
RETENTION_DAYS=14
TARGET="${1:-all}"

# Load DATABASE_URL_PROD and DATABASE_URL_TEST from env file
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
else
  echo "[ERROR] env file not found: $ENV_FILE"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

DATE=$(date +%Y-%m-%d_%H%M)

backup_one() {
  local env="$1"
  local url="$2"
  local outfile="${BACKUP_DIR}/crm-${env}-${DATE}.dump"

  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting backup: $env → $outfile"

  pg_dump \
    --format=custom \
    --no-acl \
    --no-owner \
    "$url" \
    -f "$outfile"

  local size
  size=$(du -sh "$outfile" | cut -f1)
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Done: $outfile ($size)"
}

# Run backups
if [[ "$TARGET" == "prod" || "$TARGET" == "all" ]]; then
  backup_one "prod" "$DATABASE_URL_PROD"
fi

if [[ "$TARGET" == "test" || "$TARGET" == "all" ]]; then
  backup_one "test" "$DATABASE_URL_TEST"
fi

# ── Cleanup old backups ──────────────────────────────────────
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleaning backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "crm-*.dump" -mtime +"$RETENTION_DAYS" -delete
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup complete."

# ── Restore instructions (for reference, NOT auto-run) ──────
# pg_restore --clean --no-acl --no-owner -d "$DATABASE_URL_PROD" /path/to/backup.dump
