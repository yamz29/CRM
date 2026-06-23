import { prisma } from '@/lib/prisma'
import { RutaCompraBuilder } from './RutaCompraBuilder'

export default async function NuevaRutaPage() {
  const [proveedores, proyectos] = await Promise.all([
    prisma.proveedor.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } }),
    prisma.proyecto.findMany({ where: { estado: { notIn: ['Cancelado', 'Completado'] } }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } }),
  ])

  return <RutaCompraBuilder proveedores={proveedores} proyectos={proyectos} />
}
