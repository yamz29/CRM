import { prisma } from '@/lib/prisma'
import { FacturaForm } from '@/components/contabilidad/FacturaForm'

export default async function NuevaFacturaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const sp = await searchParams

  const [clientes, proyectos] = await Promise.all([
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

  // Pre-fill from query params (e.g. from project Cobros section)
  const prefill = (sp.tipo || sp.proyectoId || sp.clienteId) ? {
    numero: '', ncf: '', descripcion: '', observaciones: '',
    fecha: new Date().toISOString().slice(0, 10),
    fechaVencimiento: '',
    proveedor: '', rncProveedor: '',
    subtotal: 0, impuesto: 0, total: 0,
    archivoUrl: null,
    tipo: sp.tipo || 'egreso',
    clienteId: sp.clienteId || '',
    proyectoId: sp.proyectoId || '',
    destinoTipo: sp.proyectoId ? 'proyecto' : 'general',
  } : undefined

  return <FacturaForm clientes={clientes} proyectos={proyectos} factura={prefill} />
}
