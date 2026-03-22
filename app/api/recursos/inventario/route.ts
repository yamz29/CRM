import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/recursos/inventario
// Devuelve todos los recursos con controlarStock=true, ordenados por nivel de alerta
export async function GET() {
  try {
    const recursos = await prisma.recurso.findMany({
      where: { controlarStock: true, activo: true },
      orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
    })

    // Calcular estado de alerta por recurso
    const conEstado = recursos.map((r) => {
      let alerta: 'ok' | 'bajo' | 'critico'
      if (r.stockMinimo <= 0) {
        alerta = 'ok'
      } else if (r.stock <= 0) {
        alerta = 'critico'
      } else if (r.stock <= r.stockMinimo) {
        alerta = 'bajo'
      } else {
        alerta = 'ok'
      }
      return { ...r, alerta }
    })

    // Ordenar: critico → bajo → ok
    const orden = { critico: 0, bajo: 1, ok: 2 }
    conEstado.sort((a, b) => orden[a.alerta] - orden[b.alerta])

    return NextResponse.json(conEstado)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al obtener inventario' }, { status: 500 })
  }
}
