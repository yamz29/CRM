import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { withPermiso } from '@/lib/with-permiso'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export const POST = withPermiso('configuracion', 'editar', async (request: NextRequest) => {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Formato no permitido. Use PNG, JPG, WEBP o SVG.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'El archivo supera el límite de 5MB' }, { status: 400 })
    }

    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'logos')
    await mkdir(uploadsDir, { recursive: true })

    // Generate unique filename
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const filename = `logo-${Date.now()}.${ext}`
    const filepath = path.join(uploadsDir, filename)

    // Write file
    const bytes = await file.arrayBuffer()
    await writeFile(filepath, Buffer.from(bytes))

    const logoUrl = `/uploads/logos/${filename}`

    // Save URL to Empresa record
    const empresa = await prisma.empresa.findFirst()
    if (empresa) {
      await prisma.empresa.update({ where: { id: empresa.id }, data: { logoUrl } })
    } else {
      await prisma.empresa.create({ data: { nombre: 'Gonzalva Group', logoUrl } })
    }

    return NextResponse.json({ ok: true, logoUrl })
  } catch (error) {
    console.error('Error uploading logo:', error)
    return NextResponse.json({ error: 'Error al subir el archivo' }, { status: 500 })
  }
})
