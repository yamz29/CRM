import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

// Rutas del sistema — consistentes con app/api/configuracion/backup/route.ts
export const DB_PATH = path.join(process.cwd(), 'prisma', 'dev.db')
export const BACKUPS_DIR = path.join(process.cwd(), 'backups')
export const TEMP_DIR = path.join(process.cwd(), 'backups', 'temp')

export function ensureDirs() {
  if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true })
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })
}

/**
 * Verifica que un archivo es una base de datos SQLite válida.
 * Todos los archivos SQLite comienzan con la firma: "SQLite format 3\000"
 */
export function isSQLiteFile(filePath: string): { valid: boolean; error?: string } {
  try {
    const stat = fs.statSync(filePath)
    if (stat.size < 100) {
      return { valid: false, error: 'El archivo está vacío o es demasiado pequeño para ser una base de datos SQLite' }
    }

    const buf = Buffer.alloc(16)
    const fd = fs.openSync(filePath, 'r')
    fs.readSync(fd, buf, 0, 16, 0)
    fs.closeSync(fd)

    if (buf.slice(0, 6).toString('ascii') !== 'SQLite') {
      return { valid: false, error: 'El archivo no es una base de datos SQLite válida (firma incorrecta)' }
    }

    return { valid: true }
  } catch {
    return { valid: false, error: 'No se pudo leer el archivo para validarlo' }
  }
}

/**
 * Guarda el archivo recibido como Buffer en el directorio temporal.
 * Devuelve el nombre del archivo temporal (token aleatorio para seguridad).
 */
export function saveTempFile(buffer: Buffer): string {
  ensureDirs()
  const token = crypto.randomBytes(8).toString('hex')
  const tempName = `import-${token}.db`
  fs.writeFileSync(path.join(TEMP_DIR, tempName), buffer)
  return tempName
}

/**
 * Crea un backup de la base de datos actual antes de reemplazarla.
 * Incluye también los archivos WAL/SHM si existen, para un backup completo.
 * El nombre lleva prefijo "pre-import-" para distinguirlo de los backups manuales.
 */
export function backupCurrentDb(): string {
  ensureDirs()
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const name = [
    'pre-import',
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('-') + '.db'

  fs.copyFileSync(DB_PATH, path.join(BACKUPS_DIR, name))
  return name
}

/**
 * Reemplaza la base de datos actual con el archivo temporal validado.
 *
 * IMPORTANTE — archivos WAL/SHM:
 * SQLite en modo WAL crea archivos auxiliares (.db-wal, .db-shm).
 * Si existen del servidor anterior, se aplican automáticamente sobre
 * cualquier archivo .db que se abra, destruyendo los datos importados.
 * Por eso se eliminan después de copiar el nuevo archivo.
 */
export function replaceDatabaseWith(tempName: string): void {
  const tempPath = path.join(TEMP_DIR, tempName)
  if (!fs.existsSync(tempPath)) {
    throw new Error('El archivo temporal no existe. Vuelve a subir el archivo.')
  }

  // 1. Copiar el nuevo archivo sobre el actual
  fs.copyFileSync(tempPath, DB_PATH)

  // 2. Eliminar archivos WAL y SHM residuales del servidor
  //    Si no se eliminan, SQLite los aplicaría sobre el nuevo DB y borraría los datos importados
  const walPath = DB_PATH + '-wal'
  const shmPath = DB_PATH + '-shm'
  if (fs.existsSync(walPath)) {
    try { fs.unlinkSync(walPath) } catch { /* ignorar si no se puede borrar */ }
  }
  if (fs.existsSync(shmPath)) {
    try { fs.unlinkSync(shmPath) } catch { /* ignorar si no se puede borrar */ }
  }

  // 3. Limpiar el archivo temporal
  try { fs.unlinkSync(tempPath) } catch { /* ignorar */ }
}

/**
 * Valida que el nombre de un archivo temporal sea seguro (sin path traversal).
 * Solo acepta el formato exacto: import-[16 hex chars].db
 */
export function isSafeTempName(name: string): boolean {
  return /^import-[a-f0-9]{16}\.db$/.test(name)
}
