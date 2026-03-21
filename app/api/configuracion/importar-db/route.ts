import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import { prisma } from '@/lib/prisma'
import {
  TEMP_DIR,
  isSQLiteFile,
  isSafeTempName,
  saveTempFile,
  backupCurrentDb,
  replaceDatabaseWith,
} from '@/lib/sqlite-import'

const ALLOWED_EXTENSIONS = ['.db', '.sqlite']

// POST /api/configuracion/importar-db
// Acepta dos acciones via FormData:
//   action=validar  + file (File)     → valida y guarda en temp
//   action=importar + tempFile (string) → hace backup y reemplaza la base
export async function POST(req: Request) {
  // 1. Verificar que hay sesión activa (el middleware inyecta x-user-id)
  const userIdHeader = req.headers.get('x-user-id')
  if (!userIdHeader) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // 2. Verificar que el usuario es Admin (consulta real a la BD)
  const userId = parseInt(userIdHeader)
  if (isNaN(userId)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { rol: true, activo: true },
  })

  if (!usuario || !usuario.activo || usuario.rol !== 'Admin') {
    return NextResponse.json(
      { error: 'Solo administradores activos pueden importar la base de datos' },
      { status: 403 }
    )
  }

  // 3. Parsear el FormData
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el formulario' }, { status: 400 })
  }

  const action = formData.get('action') as string | null

  // ── ACCIÓN: VALIDAR ──────────────────────────────────────────────────────
  if (action === 'validar') {
    const file = formData.get('file') as File | null

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
    }

    // Validar extensión
    const ext = path.extname(file.name).toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: 'Solo se aceptan archivos con extensión .db o .sqlite' },
        { status: 400 }
      )
    }

    // Guardar en temp y validar firma SQLite
    let tempName: string
    try {
      const bytes = await file.arrayBuffer()
      tempName = saveTempFile(Buffer.from(bytes))
    } catch {
      return NextResponse.json({ error: 'Error al guardar el archivo temporalmente' }, { status: 500 })
    }

    const validation = isSQLiteFile(path.join(TEMP_DIR, tempName))
    if (!validation.valid) {
      // Borrar el temp si no es válido
      try { fs.unlinkSync(path.join(TEMP_DIR, tempName)) } catch { /* ignorar */ }
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const stat = fs.statSync(path.join(TEMP_DIR, tempName))

    return NextResponse.json({
      ok: true,
      tempFile: tempName,
      size: stat.size,
      mensaje: 'Archivo validado correctamente. Es una base de datos SQLite válida.',
    })
  }

  // ── ACCIÓN: IMPORTAR ─────────────────────────────────────────────────────
  if (action === 'importar') {
    const tempFile = formData.get('tempFile') as string | null

    // Validar que el nombre del temp es seguro (evita path traversal)
    if (!tempFile || !isSafeTempName(tempFile)) {
      return NextResponse.json({ error: 'Referencia de archivo inválida o expirada' }, { status: 400 })
    }

    const tempPath = path.join(TEMP_DIR, tempFile)
    if (!fs.existsSync(tempPath)) {
      return NextResponse.json(
        { error: 'El archivo temporal ya no existe. Vuelve a subir y validar el archivo.' },
        { status: 400 }
      )
    }

    // Re-validar antes de tocar nada (doble seguridad)
    const revalidation = isSQLiteFile(tempPath)
    if (!revalidation.valid) {
      return NextResponse.json(
        { error: 'El archivo no pasó la validación final. Importación cancelada.' },
        { status: 400 }
      )
    }

    // Crear backup de la base actual ANTES de cualquier cambio
    let backupName: string
    try {
      backupName = backupCurrentDb()
    } catch (err) {
      console.error('[importar-db] Error al crear backup:', err)
      return NextResponse.json(
        { error: 'No se pudo crear el backup de seguridad. Importación cancelada para proteger tus datos.' },
        { status: 500 }
      )
    }

    // Desconectar Prisma antes de reemplazar el archivo físico
    try {
      await prisma.$disconnect()
    } catch { /* continuar aunque falle la desconexión */ }

    // Reemplazar la base de datos
    try {
      replaceDatabaseWith(tempFile)
    } catch (err) {
      console.error('[importar-db] Error al reemplazar la base:', err)
      return NextResponse.json(
        {
          error: `Error al reemplazar la base de datos. Tu backup de seguridad está guardado como: ${backupName}`,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      backupCreado: backupName,
      mensaje: 'Base de datos importada correctamente.',
      aviso: 'Puede ser necesario reiniciar la aplicación para asegurar que el sistema conecte con la nueva base de datos.',
    })
  }

  return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
}
