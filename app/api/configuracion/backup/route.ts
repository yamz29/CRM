import { NextResponse, type NextRequest } from 'next/server'
import path from 'path'
import fs from 'fs'
import archiver from 'archiver'
import { withPermiso } from '@/lib/with-permiso'

// Rutas absolutas basadas en el directorio raíz del proyecto (CRM/)
const BACKUPS_DIR = path.join(process.cwd(), 'backups')
const DB_PATH = path.join(process.cwd(), 'prisma', 'dev.db')
const UPLOADS_PATH = path.join(process.cwd(), 'public', 'uploads')

function ensureBackupsDir() {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true })
  }
}

// GET /api/configuracion/backup — listar backups existentes
export const GET = withPermiso('configuracion', 'ver', async (_req: NextRequest) => {
  try {
    ensureBackupsDir()

    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.endsWith('.zip'))
      .map(filename => {
        const stat = fs.statSync(path.join(BACKUPS_DIR, filename))
        return {
          filename,
          size: stat.size,
          createdAt: stat.mtime.toISOString(),
        }
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({ backups: files })
  } catch (err) {
    console.error('[backup GET]', err)
    return NextResponse.json({ error: 'Error al listar los backups' }, { status: 500 })
  }
})

// POST /api/configuracion/backup — crear nuevo backup
export const POST = withPermiso('configuracion', 'editar', async (_req: NextRequest) => {
  try {
    ensureBackupsDir()

    // Nombre del archivo: backup-2026-03-20-22-15.zip
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const filename = `backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}.zip`
    const zipPath = path.join(BACKUPS_DIR, filename)

    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(zipPath)
      const archive = archiver('zip', { zlib: { level: 6 } })

      output.on('close', resolve)
      archive.on('error', (err) => {
        // Si algo falla, intentar borrar el zip parcial
        try { fs.unlinkSync(zipPath) } catch { /* ignore */ }
        reject(err)
      })

      archive.pipe(output)

      // Agregar la base de datos SQLite
      if (fs.existsSync(DB_PATH)) {
        archive.file(DB_PATH, { name: 'database/dev.db' })
      }

      // Agregar la carpeta de uploads (no falla si está vacía o no existe)
      if (fs.existsSync(UPLOADS_PATH)) {
        archive.directory(UPLOADS_PATH, 'uploads')
      }

      archive.finalize()
    })

    const stat = fs.statSync(zipPath)

    return NextResponse.json({
      ok: true,
      filename,
      size: stat.size,
    })
  } catch (err) {
    console.error('[backup POST]', err)
    return NextResponse.json({ error: 'Error al crear el backup' }, { status: 500 })
  }
})
