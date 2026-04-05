import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { FacturaForm } from '@/components/contabilidad/FacturaForm'

export default async function EditarFacturaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) notFound()

  const [factura, clientes, proyectos] = await Promise.all([
    prisma.factura.findUnique({ where: { id } }),
    prisma.cliente.findMany({
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true },
    }),
    prisma.proyecto.findMany({
      where: { estado: { notIn: ['Cancelado', 'Cerrado'] } },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true },
    }),
  ])

  if (!factura) notFound()

  const facturaData = {
    id: factura.id,
    numero: factura.numero,
    ncf: factura.ncf || '',
    tipo: factura.tipo,
    fecha: factura.fecha.toISOString().slice(0, 10),
    fechaVencimiento: factura.fechaVencimiento ? factura.fechaVencimiento.toISOString().slice(0, 10) : '',
    proveedor: factura.proveedor || '',
    rncProveedor: factura.rncProveedor || '',
    clienteId: factura.clienteId?.toString() || '',
    destinoTipo: factura.destinoTipo || 'general',
    proyectoId: factura.proyectoId?.toString() || '',
    descripcion: factura.descripcion || '',
    subtotal: factura.subtotal,
    impuesto: factura.impuesto,
    total: factura.total,
    observaciones: factura.observaciones || '',
    archivoUrl: factura.archivoUrl,
  }

  return <FacturaForm clientes={clientes} proyectos={proyectos} factura={facturaData} />
}
