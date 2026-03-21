import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'

const BACKUPS_DIR = path.join(process.cwd(), 'backups')

// Solo se permiten nombres con este formato exacto: backup-YYYY-MM-DD-HH-mm.zip
// Esto evita path traversal (ej: ../../etc/passwd)
const SAFE_FILENAME = /^backup-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}\.zip$/

type Params = { params: Promise<{ filename: string }> }

// GET /api/configuracion/backup/[filename] — descargar backup
export async function GET(_req: Request, { params }: Params) {
  const { filename } = await params

  if (!SAFE_FILENAME.test(filename)) {
    return NextResponse.json({ error: 'Nombre de archivo inválido' }, { status: 400 })
  }

  const filePath = path.join(BACKUPS_DIR, filename)

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
  }

  try {
    const fileBuffer = await fs.promises.readFile(filePath)
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(fileBuffer.length),
      },
    })
  } catch (err) {
    console.error('[backup download]', err)
    return NextResponse.json({ error: 'Error al descargar el backup' }, { status: 500 })
  }
}

// DELETE /api/configuracion/backup/[filename] — eliminar backup
export async function DELETE(_req: Request, { params }: Params) {
  const { filename } = await params

  if (!SAFE_FILENAME.test(filename)) {
    return NextResponse.json({ error: 'Nombre de archivo inválido' }, { status: 400 })
  }

  const filePath = path.join(BACKUPS_DIR, filename)

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
  }

  try {
    await fs.promises.unlink(filePath)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[backup delete]', err)
    return NextResponse.json({ error: 'Error al eliminar el backup' }, { status: 500 })
  }
}
