import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

/**
 * GET /api/search?q=texto
 *
 * Búsqueda global multi-modelo. Devuelve hasta 6 resultados por tipo:
 * clientes, proyectos, presupuestos, facturas. Búsqueda case-insensitive
 * en los campos más relevantes de cada modelo.
 *
 * Permiso: dashboard 'ver' (lo mínimo que todo usuario autenticado tiene).
 * El frontend filtra qué tipos mostrar según los permisos del usuario.
 */
export const GET = withPermiso('dashboard', 'ver', async (req: NextRequest) => {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) {
    return NextResponse.json({
      clientes: [], proyectos: [], presupuestos: [], facturas: [],
    })
  }

  const LIMIT = 6
  const insensitive = { contains: q, mode: 'insensitive' as const }

  const [clientes, proyectos, presupuestos, facturas] = await Promise.all([
    prisma.cliente.findMany({
      where: {
        OR: [
          { nombre: insensitive },
          { rnc: insensitive },
          { telefono: insensitive },
          { correo: insensitive },
        ],
      },
      select: { id: true, nombre: true, rnc: true, telefono: true },
      take: LIMIT,
    }),
    prisma.proyecto.findMany({
      where: {
        OR: [
          { nombre: insensitive },
          { codigo: insensitive },
          { ubicacion: insensitive },
        ],
      },
      select: {
        id: true, nombre: true, codigo: true, estado: true,
        cliente: { select: { nombre: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
    }),
    prisma.presupuesto.findMany({
      where: {
        OR: [
          { numero: insensitive },
          { cliente: { nombre: insensitive } },
        ],
      },
      select: {
        id: true, numero: true, total: true, estado: true,
        cliente: { select: { nombre: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
    }),
    prisma.factura.findMany({
      where: {
        OR: [
          { numero: insensitive },
          { ncf: insensitive },
          { proveedor: insensitive },
          { cliente: { nombre: insensitive } },
          { descripcion: insensitive },
        ],
      },
      select: {
        id: true, numero: true, ncf: true, total: true, tipo: true, estado: true, esProforma: true,
        cliente: { select: { nombre: true } },
        proveedor: true,
      },
      orderBy: { fecha: 'desc' },
      take: LIMIT,
    }),
  ])

  return NextResponse.json({ clientes, proyectos, presupuestos, facturas })
})
