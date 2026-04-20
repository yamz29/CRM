import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'

// POST /api/programa/[itemId]/promover-a-oc
// Crea una OrdenCompra en estado "borrador" desde un item de programa tipo "compra".
// Body opcional: { proveedorId?: number, precioUnitario?: number, cantidadNum?: number }
// Actualiza el item: estado=Completado, ordenCompraId=<nueva OC>.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const denied = await checkPermiso(request, 'proyectos', 'editar')
  if (denied) return denied

  const { itemId: idStr } = await params
  const itemId = parseInt(idStr)
  if (isNaN(itemId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const item = await prisma.itemProgramaProyecto.findUnique({ where: { id: itemId } })
  if (!item) return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 })
  if (item.tipo !== 'compra') return NextResponse.json({ error: 'Solo las compras pueden promoverse a OC' }, { status: 400 })
  if (item.ordenCompraId) return NextResponse.json({ error: 'Esta compra ya fue promovida' }, { status: 400 })

  let body: { proveedorId?: number | null; precioUnitario?: number; cantidadNum?: number } = {}
  try { body = await request.json() } catch { /* body opcional */ }

  const proveedorId = typeof body.proveedorId === 'number' ? body.proveedorId : null
  const precioUnitario = typeof body.precioUnitario === 'number' && body.precioUnitario >= 0 ? body.precioUnitario : 0
  // Intenta extraer número de la cantidad texto libre ("20 sacos" → 20). Si viene del body, prioridad.
  const cantidadNum = typeof body.cantidadNum === 'number' && body.cantidadNum > 0
    ? body.cantidadNum
    : (() => {
        const m = item.cantidad?.match(/(\d+(?:[.,]\d+)?)/)
        return m ? parseFloat(m[1].replace(',', '.')) : 1
      })()

  // Generar número de OC (OC-YYYY-NNNN)
  const year = new Date().getFullYear()
  const lastOc = await prisma.ordenCompra.findFirst({
    where: { numero: { startsWith: `OC-${year}-` } },
    orderBy: { numero: 'desc' },
    select: { numero: true },
  })
  let nextNum = 1
  if (lastOc) {
    const parts = lastOc.numero.split('-')
    const n = parseInt(parts[2] || '0')
    if (!isNaN(n)) nextNum = n + 1
  }
  const numero = `OC-${year}-${String(nextNum).padStart(4, '0')}`

  // Extraer unidad del cantidad texto libre (ej: "20 sacos" → "sacos")
  const unidadMatch = item.cantidad?.match(/^\s*\d+(?:[.,]\d+)?\s*(.+)$/)
  const unidad = unidadMatch?.[1]?.trim() || 'ud'

  const subtotal = cantidadNum * precioUnitario

  const oc = await prisma.ordenCompra.create({
    data: {
      numero,
      proveedorId,
      proyectoId: item.proyectoId,
      estado: 'borrador',
      fechaEmision: new Date(),
      fechaEntrega: item.fechaObjetivo ?? null,
      moneda: 'RD$',
      subtotal,
      impuesto: 0,
      total: subtotal,
      notas: item.notas ?? null,
      items: {
        create: {
          descripcion: item.descripcion,
          unidad,
          cantidad: cantidadNum,
          precioUnitario,
          subtotal,
        },
      },
    },
    include: { items: true },
  })

  // Marcar el item como completado y linkearlo
  await prisma.itemProgramaProyecto.update({
    where: { id: itemId },
    data: {
      estado: 'Completado',
      completedAt: new Date(),
      ordenCompraId: oc.id,
    },
  })

  return NextResponse.json({ ordenCompra: oc })
}
