import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'

// GET /api/compras/rutas — lista de rutas de compra
export async function GET(request: NextRequest) {
  const denied = await checkPermiso(request, 'compras', 'ver')
  if (denied) return denied

  const { searchParams } = new URL(request.url)
  const estado = searchParams.get('estado')

  const where: Record<string, unknown> = {}
  if (estado) where.estado = estado

  const rutas = await prisma.rutaCompra.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      items: {
        select: { proveedorId: true, proveedorTexto: true, precioEstimado: true, precioReal: true },
      },
    },
  })

  // Derivar métricas por ruta: # paradas (suplidores distintos), # items, totales
  const data = rutas.map((r) => {
    const paradas = new Set(
      r.items.map((i) => (i.proveedorId ? `id:${i.proveedorId}` : i.proveedorTexto ? `t:${i.proveedorTexto}` : 'sin'))
    )
    const totalEstimado = r.items.reduce((s, i) => s + (i.precioEstimado ?? 0), 0)
    const totalReal = r.items.reduce((s, i) => s + (i.precioReal ?? 0), 0)
    return {
      id: r.id,
      codigo: r.codigo,
      titulo: r.titulo,
      fecha: r.fecha,
      estado: r.estado,
      comprador: r.comprador,
      numParadas: paradas.size,
      numItems: r.items.length,
      totalEstimado,
      totalReal,
    }
  })

  return NextResponse.json(data)
}

// POST /api/compras/rutas — crear ruta (cabecera + items opcionales)
export async function POST(request: NextRequest) {
  const denied = await checkPermiso(request, 'compras', 'editar')
  if (denied) return denied

  try {
    const body = await request.json()

    // Generar código secuencial RC-YYYY-NNNN
    const year = new Date().getFullYear()
    const prefix = `RC-${year}-`
    const last = await prisma.rutaCompra.findFirst({
      where: { codigo: { startsWith: prefix } },
      orderBy: { codigo: 'desc' },
      select: { codigo: true },
    })
    const seq = last ? parseInt(last.codigo.slice(prefix.length)) + 1 : 1
    const codigo = `${prefix}${String(seq).padStart(4, '0')}`

    const items = Array.isArray(body.items) ? body.items : []

    const ruta = await prisma.rutaCompra.create({
      data: {
        codigo,
        titulo: body.titulo?.toString().trim() || null,
        comprador: body.comprador?.toString().trim() || null,
        fecha: body.fecha ? new Date(body.fecha) : new Date(),
        notas: body.notas?.toString().trim() || null,
        items: {
          create: items.map((it: Record<string, unknown>, idx: number) => ({
            descripcion: String(it.descripcion ?? '').trim() || 'Material',
            cantidad: parseFloat(String(it.cantidad)) || 1,
            unidad: String(it.unidad ?? 'ud').trim() || 'ud',
            proyectoId: it.proyectoId ? parseInt(String(it.proyectoId)) : null,
            proveedorId: it.proveedorId ? parseInt(String(it.proveedorId)) : null,
            proveedorTexto: it.proveedorTexto ? String(it.proveedorTexto).trim() : null,
            urgencia: ['alta', 'media', 'baja'].includes(String(it.urgencia)) ? String(it.urgencia) : 'media',
            precioEstimado: it.precioEstimado != null && it.precioEstimado !== '' ? parseFloat(String(it.precioEstimado)) : null,
            notas: it.notas ? String(it.notas).trim() : null,
            orden: idx,
          })),
        },
      },
      select: { id: true, codigo: true },
    })

    return NextResponse.json(ruta)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al crear'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
