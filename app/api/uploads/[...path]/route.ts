import { NextRequest, NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
import path from 'path'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = { params: Promise<{ path: string[] }> }

const MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
}

const UPLOADS_ROOT = path.resolve(process.cwd(), 'public', 'uploads')

export const GET = withPermiso('dashboard', 'ver', async (_request: NextRequest, { params }: Ctx) => {
  const segments = (await params).path

  // Canonicalización: resolver y verificar que la ruta caiga dentro del root.
  // path.resolve normaliza "..", encoding, separadores mixtos, etc.
  const filePath = path.resolve(UPLOADS_ROOT, ...segments)
  if (!filePath.startsWith(UPLOADS_ROOT + path.sep) && filePath !== UPLOADS_ROOT) {
    return NextResponse.json({ error: 'Ruta inválida' }, { status: 400 })
  }

  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  const contentType = MIME_TYPES[ext] || 'application/octet-stream'

  try {
    await stat(filePath)
    const buffer = await readFile(filePath)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        // Uploads son privados (facturas, comprobantes) — no cachear en proxies/CDN compartidos.
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
  }
})
