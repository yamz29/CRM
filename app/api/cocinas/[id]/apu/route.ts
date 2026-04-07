import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

/**
 * POST /api/cocinas/:id/apu
 *
 * Crea un APU en el catálogo a partir del proyecto de cocina.
 * - Nombre del APU = nombre del proyecto (overridable por body.nombre)
 * - Una línea libre por módulo único (agrupando placements duplicados)
 * - Costo unitario del módulo: piezas (área proporcional al precio de plancha,
 *   con 5% de desperdicio) + cantos/herrajes asignados al módulo
 *
 * Body opcional: { nombre?: string, capitulo?: string }
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const projectId = parseInt(id)
    if (isNaN(projectId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const project = await prisma.kitchenProject.findUnique({ where: { id: projectId }, select: { nombre: true } })
    if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

    const body = (await request.json().catch(() => ({}))) as { nombre?: string; capitulo?: string }
    const apuNombre = (body.nombre?.trim() || project.nombre || `Cocina #${projectId}`)
    const capitulo = body.capitulo?.trim() || 'Cocinas'

    const placements = await prisma.kitchenModulePlacement.findMany({
      where: { kitchenProjectId: projectId },
      include: {
        modulo: {
          include: {
            piezas: true,
            materialTablero: true,
            materialesModulo: { include: { material: true } },
          },
        },
      },
    })

    if (placements.length === 0) {
      return NextResponse.json({ error: 'No hay módulos colocados en la cocina' }, { status: 400 })
    }

    // ── Calcular costo unitario por módulo ────────────────────────────────────
    // Estrategia: área de piezas × (precio plancha / área plancha) × (1 + desperdicio)
    //             + sumatoria de cantos/herrajes del módulo
    const DESPERDICIO = 0.05

    function calcularCostoModulo(placement: typeof placements[number]): number {
      const m = placement.modulo
      const tableroPrecio = m.materialTablero?.precio ?? 0
      const planchaArea = (m.anchoPlanchaCm || 2440) * (m.largoPlanchaCm || 1830)

      let costoTablero = 0
      if (planchaArea > 0 && tableroPrecio > 0) {
        for (const pieza of m.piezas) {
          const areaPieza = pieza.largo * pieza.ancho * pieza.cantidad
          costoTablero += (areaPieza / planchaArea) * tableroPrecio
        }
        costoTablero *= 1 + DESPERDICIO
      }

      let costoMateriales = 0
      for (const mat of m.materialesModulo) {
        costoMateriales += mat.cantidad * mat.costoSnapshot
      }

      return Math.round((costoTablero + costoMateriales) * 100) / 100
    }

    // Agrupar placements por moduloId (mismo módulo colocado N veces => 1 línea con cantidad=N)
    type Linea = {
      moduloId: number
      nombre: string
      tipoModulo: string
      dimensiones: string
      cantidad: number
      costoSnapshot: number
    }
    const lineasMap = new Map<number, Linea>()
    for (const p of placements) {
      const m = p.modulo
      const existing = lineasMap.get(m.id)
      if (existing) {
        existing.cantidad += 1
        continue
      }
      lineasMap.set(m.id, {
        moduloId: m.id,
        nombre: m.nombre,
        tipoModulo: m.tipoModulo,
        dimensiones: `${Math.round(m.ancho)}×${Math.round(m.alto)}×${Math.round(m.profundidad)}mm`,
        cantidad: 1,
        costoSnapshot: calcularCostoModulo(p),
      })
    }

    const lineas = Array.from(lineasMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre))

    // ── Calcular totales del APU ──────────────────────────────────────────────
    const indirectos = 10
    const utilidad = 20
    const desperdicioApu = 5
    const costoDirecto = lineas.reduce((s, l) => s + l.cantidad * l.costoSnapshot, 0)
    const costoTotal = costoDirecto * (1 + indirectos / 100)
    const precioVenta = costoTotal * (1 + utilidad / 100)

    // Generar código secuencial
    const year = new Date().getFullYear()
    const existing = await prisma.apuCatalogo.findMany({
      where: { codigo: { startsWith: `COCINA-${year}-` } },
      select: { codigo: true },
    })
    const usedSeqs = existing
      .map((a) => parseInt(a.codigo?.split('-')[2] ?? '0'))
      .filter((n) => !isNaN(n))
    const maxSeq = usedSeqs.length > 0 ? Math.max(...usedSeqs) : 0
    const codigo = `COCINA-${year}-${String(maxSeq + 1).padStart(3, '0')}`

    const apu = await prisma.apuCatalogo.create({
      data: {
        codigo,
        nombre: apuNombre,
        descripcion: `Generado automáticamente desde el configurador de cocinas (proyecto #${projectId}). ${lineas.length} módulo(s) único(s).`,
        capitulo,
        unidad: 'gl',
        indirectos,
        utilidad,
        desperdicio: desperdicioApu,
        costoDirecto,
        costoTotal,
        precioVenta,
        activo: true,
        recursos: {
          create: lineas.map((l, i) => ({
            tipoComponente: 'libre',
            descripcionLibre: `${l.nombre} — ${l.tipoModulo} (${l.dimensiones})`,
            unidadLibre: 'ud',
            tipoLinea: 'materiales',
            cantidad: l.cantidad,
            costoSnapshot: l.costoSnapshot,
            subtotal: Math.round(l.cantidad * l.costoSnapshot * 100) / 100,
            orden: i,
          })),
        },
      },
    })

    return NextResponse.json({ apuId: apu.id, codigo: apu.codigo, nombre: apu.nombre }, { status: 201 })
  } catch (error) {
    console.error('Error creating APU from kitchen:', error)
    return NextResponse.json({ error: 'Error al crear APU desde la cocina' }, { status: 500 })
  }
}
