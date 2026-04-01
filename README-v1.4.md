# Migración v1.4 — SQLite → PostgreSQL + JWT_SECRET

Ejecutar en orden. Cada paso depende del anterior.

---

## PASO 1 — Exportar datos de SQLite (ANTES de cualquier otro cambio)

Conectarse a la VPS y correr:

```bash
ssh usuario@servidor
cd /var/www/crm

# Exportar prod
DATABASE_URL="file:/var/www/crm/prisma/data/prod.db" node prisma/migrate-export.js
```

Verifica que se haya creado la carpeta `prisma/backup/` con archivos JSON.

---

## PASO 2 — Instalar PostgreSQL en la VPS

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib

# Verificar que está corriendo
sudo systemctl status postgresql
```

---

## PASO 3 — Crear usuario y bases de datos

```bash
sudo -u postgres psql << 'EOF'
CREATE USER gonzalva_user WITH PASSWORD 'PON_UNA_CONTRASEÑA_SEGURA_AQUI';
CREATE DATABASE gonzalva_prod OWNER gonzalva_user;
CREATE DATABASE gonzalva_test OWNER gonzalva_user;
GRANT ALL PRIVILEGES ON DATABASE gonzalva_prod TO gonzalva_user;
GRANT ALL PRIVILEGES ON DATABASE gonzalva_test TO gonzalva_user;
\q
EOF
```

---

## PASO 4 — Crear el archivo .env.server en la VPS

Este archivo NUNCA va a git. Contiene las URLs reales de PostgreSQL.

```bash
cat > /var/www/crm/.env.server << 'EOF'
DATABASE_URL_PROD=postgresql://gonzalva_user:PON_UNA_CONTRASEÑA_SEGURA_AQUI@localhost:5432/gonzalva_prod
DATABASE_URL_TEST=postgresql://gonzalva_user:PON_UNA_CONTRASEÑA_SEGURA_AQUI@localhost:5432/gonzalva_test
EOF
```

---

## PASO 5 — Generar JWT secrets seguros

```bash
# Genera dos secrets de 64 bytes
node -e "console.log('PROD:', require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('TEST:', require('crypto').randomBytes(64).toString('hex'))"
```

Copia los valores generados para usarlos en el siguiente paso.

---

## PASO 6 — Actualizar ecosystem.config.js en la VPS

Edita el archivo directamente en el servidor (no en git):

```bash
nano /var/www/crm/ecosystem.config.js
```

Reemplaza los placeholders con los valores reales:
- `CONTRASEÑA_PROD` → tu contraseña real
- `CONTRASEÑA_TEST` → tu contraseña real
- `REEMPLAZAR_CON_64_CARACTERES_ALEATORIOS_PROD` → el secret generado en paso 5
- `REEMPLAZAR_CON_64_CARACTERES_ALEATORIOS_TEST` → el segundo secret

---

## PASO 7 — Crear tablas en PostgreSQL (prisma db push)

```bash
cd /var/www/crm
source .env.server

DATABASE_URL="$DATABASE_URL_PROD" npx prisma db push
DATABASE_URL="$DATABASE_URL_TEST" npx prisma db push
```

---

## PASO 8 — Importar datos a PostgreSQL (prod)

```bash
DATABASE_URL="$DATABASE_URL_PROD" node prisma/migrate-import.js
```

Verifica que los conteos coincidan con el export del Paso 1.

Para test, si quieres copiar los mismos datos:
```bash
DATABASE_URL="$DATABASE_URL_TEST" node prisma/migrate-import.js
```

---

## PASO 9 — Deploy final

```bash
cd /var/www/crm
bash deploy.sh all
```

Este paso hace `git pull`, `npm install`, `prisma db push`, `next build` y reinicia PM2.

---

## PASO 10 — Verificar

```bash
# Ver logs en tiempo real
pm2 logs crm-prod --lines 50

# Verificar que la app conecta a PostgreSQL
pm2 env crm-prod | grep DATABASE_URL
```

Abre `erp.gonzalva.com.do` y verifica login y datos.

---

## Rollback (si algo falla)

Si necesitas volver a SQLite temporalmente:
1. Editar `prisma/schema.prisma`: cambiar `provider` de vuelta a `"sqlite"`
2. Editar `ecosystem.config.js` en la VPS: cambiar `DATABASE_URL` a `file:/var/www/crm/prisma/data/prod.db`
3. Correr `bash deploy.sh all`

Los datos SQLite originales siguen intactos en `prisma/data/prod.db`.
