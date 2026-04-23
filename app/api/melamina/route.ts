import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

export const GET = withPermiso('melamina', 'ver', async () => {
  try {
    const modulos = await prisma.moduloMelaminaV2.findMany({
      include: {
        proyecto: { select: { id: true, nombre: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(modulos)
  } catch (error) {
    console.error('Error fetching modulos melamina:', error)
    return NextResponse.json({ error: 'Error al obtener módulos' }, { status: 500 })
  }
})

export const POST = withPermiso('melamina', 'editar', async (request: NextRequest) => {
  try {
    const body = await request.json()
    const {
      proyectoId,
      codigo,
      tipoModulo,
      nombre,
      ancho,
      alto,
      profundidad,
      material,
      colorAcabado,
      herrajes,
      cantidad,
      costoMateriales,
      costoManoObra,
      costoInstalacion,
      precioVenta,
      estadoProduccion,
      observaciones,
    } = body

    if (!nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
    }

    const modulo = await prisma.moduloMelaminaV2.create({
      data: {
        proyectoId: proyectoId ? parseInt(String(proyectoId)) : null,
        codigo: codigo || null,
        tipoModulo: tipoModulo || 'Base',
        nombre: nombre.trim(),
        ancho: parseFloat(String(ancho)) || 0,
        alto: parseFloat(String(alto)) || 0,
        profundidad: parseFloat(String(profundidad)) || 0,
        material: material || 'Melamina Egger 18mm',
        colorAcabado: colorAcabado || null,
        herrajes: herrajes || null,
        cantidad: parseInt(String(cantidad)) || 1,
        costoMateriales: parseFloat(String(costoMateriales)) || 0,
        costoManoObra: parseFloat(String(costoManoObra)) || 0,
        costoInstalacion: parseFloat(String(costoInstalacion)) || 0,
        precioVenta: parseFloat(String(precioVenta)) || 0,
        estadoProduccion: estadoProduccion || 'Diseño',
        observaciones: observaciones || null,
      },
      include: {
        proyecto: { select: { id: true, nombre: true } },
      },
    })

    return NextResponse.json(modulo, { status: 201 })
  } catch (error) {
    console.error('Error creating modulo melamina:', error)
    return NextResponse.json({ error: 'Error al crear módulo' }, { status: 500 })
  }
})
