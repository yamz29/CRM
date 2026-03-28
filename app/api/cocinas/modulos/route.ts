import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ── GET: List modules (no piezas for performance) ─────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo')

    // Build filter
    type WhereClause = { tipoModulo?: { contains: string } }
    const where: WhereClause = {}

    if (tipo) {
      const tipoMap: Record<string, string> = {
        base: 'Base',
        aereo: 'Aéreo',
        torre: 'Torre',
        columna: 'Columna',
        otro: 'Otro',
      }
      const tipoFilter = tipoMap[tipo.toLowerCase()] ?? tipo
      where.tipoModulo = { contains: tipoFilter }
    }

    const modulos = await prisma.moduloMelaminaV2.findMany({
      where,
      select: {
        id: true,
        nombre: true,
        tipoModulo: true,
        ancho: true,
        alto: true,
        profundidad: true,
        colorAcabado: true,
        materialTableroId: true,
      },
      orderBy: [{ tipoModulo: 'asc' }, { nombre: 'asc' }],
    })

    return NextResponse.json(modulos)
  } catch (error) {
    console.error('Error fetching modulos for kitchen:', error)
    return NextResponse.json({ error: 'Error al obtener módulos' }, { status: 500 })
  }
}
