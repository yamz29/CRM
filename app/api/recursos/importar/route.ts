import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface RecursoImport {
  codigo: string
  nombre: string
  tipo: string
  categoria: string
  subcategoria: string
  unidad: string
  costoUnitario: number
  proveedor: string
  marca: string
  observaciones: string
}

// POST /api/recursos/importar
// Body: { recursos: RecursoImport[] }
// Returns: { creados, omitidos, errores }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const items: RecursoImport[] = body.recursos ?? []

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No se recibieron recursos para importar' }, { status: 400 })
    }

    let creados = 0
    let omitidos = 0
    const errores: string[] = []

    for (const r of items) {
      if (!r.nombre?.trim()) { errores.push(`Recurso sin nombre omitido`); continue }

      try {
        // Si tiene código, verificar si ya existe
        if (r.codigo?.trim()) {
          const exists = await prisma.recurso.findFirst({ where: { codigo: r.codigo.trim() } })
          if (exists) { omitidos++; continue }
        }

        await prisma.recurso.create({
          data: {
            codigo:       r.codigo?.trim() || null,
            nombre:       r.nombre.trim(),
            tipo:         r.tipo || 'materiales',
            categoria:    r.categoria?.trim() || null,
            subcategoria: r.subcategoria?.trim() || null,
            unidad:       r.unidad?.trim() || 'ud',
            costoUnitario: parseFloat(String(r.costoUnitario)) || 0,
            proveedor:    r.proveedor?.trim() || null,
            marca:        r.marca?.trim() || null,
            observaciones: r.observaciones?.trim() || null,
            activo: true,
          },
        })
        creados++
      } catch {
        errores.push(`Error al crear "${r.nombre}"`)
      }
    }

    return NextResponse.json({ creados, omitidos, errores })
  } catch (error) {
    console.error('[importar recursos]', error)
    return NextResponse.json({ error: 'Error al importar recursos' }, { status: 500 })
  }
}
