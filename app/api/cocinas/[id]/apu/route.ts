import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runNesting, type NestPieceIn } from '@/lib/nesting'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = Params

type Params = { params: Promise<{ id: string }> }

/**
 * POST /api/cocinas/:id/apu
 *
 * Crea un APU en el catálogo a partir del proyecto de cocina.
 *
 * Estructura del APU resultante:
 * - Nombre   : nombre del proyecto (overridable por body.nombre)
 * - Descripción: informe textual con todos los módulos colocados (cantidades + dimensiones)
 * - Recursos:
 *     • Tableros: una línea por tablero, cantidad = nº de planchas calculadas por nesting
 *     • Cantos y herrajes: agregados de todos los módulos
 *
 * Body opcional: { nombre?: string, capitulo?: string }
 */
export const POST = withPermiso('cocinas', 'editar', async (request: NextRequest, { params }: Ctx) => {
  try {
    const { id } = await params
    const projectId = parseInt(id)
    if (isNaN(projectId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const project = await prisma.kitchenProject.findUnique({ where: { id: projectId }, select: { nombre: true } })
    if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

    const body = (await request.json().catch(() => ({}))) as { nombre?: string; capitulo?: string }
    const apuNombre = body.nombre?.trim() || project.nombre || `Cocina #${projectId}`
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

    // ── 1. Nesting: piezas → planchas por tablero ─────────────────────────────
    const allPieces: NestPieceIn[] = []
    const materialLookup: Record<string, { boardW: number; boardH: number; precio: number }> = {}

    for (const placement of placements) {
      const m = placement.modulo
      if (m.tipoModulo === 'Electrodoméstico') continue

      const boardW = m.anchoPlanchaCm
      const boardH = m.largoPlanchaCm
      const precio = m.materialTablero?.precio ?? 0
      const tableroNombre = m.materialTablero?.nombre ?? m.material

      if (!materialLookup[tableroNombre]) {
        materialLookup[tableroNombre] = { boardW, boardH, precio }
      }

      for (const pieza of m.piezas) {
        const matKey = pieza.material || tableroNombre
        if (!materialLookup[matKey]) {
          materialLookup[matKey] = { boardW, boardH, precio }
        }
        for (let i = 0; i < pieza.cantidad; i++) {
          allPieces.push({
            key: `p${placement.id}-${pieza.id}-${i}`,
            etiqueta: pieza.etiqueta,
            nombre: pieza.nombre,
            w: pieza.largo,
            h: pieza.ancho,
            material: matKey,
          })
        }
      }
    }

    const nestGroups = runNesting(allPieces, materialLookup, 2440, 1830, 4, true)

    // ── 2. Agregar cantos + herrajes de todos los módulos ─────────────────────
    type MatLine = { nombre: string; tipo: string; unidad: string; cantidad: number; costoSnapshot: number }
    const herrajesCantos = new Map<number, MatLine>()
    for (const placement of placements) {
      const m = placement.modulo
      if (m.tipoModulo === 'Electrodoméstico') continue
      for (const mat of m.materialesModulo) {
        const existing = herrajesCantos.get(mat.materialId)
        if (existing) {
          existing.cantidad += mat.cantidad
        } else {
          herrajesCantos.set(mat.materialId, {
            nombre: mat.material.nombre,
            tipo: mat.tipo,
            unidad: mat.unidad,
            cantidad: mat.cantidad,
            costoSnapshot: mat.costoSnapshot,
          })
        }
      }
    }

    // ── 3. Informe de módulos para la descripción del APU ─────────────────────
    type ModuloAgg = { nombre: string; tipoModulo: string; dimensiones: string; cantidad: number }
    const modulosAgg = new Map<number, ModuloAgg>()
    for (const p of placements) {
      const m = p.modulo
      const existing = modulosAgg.get(m.id)
      if (existing) {
        existing.cantidad += 1
      } else {
        modulosAgg.set(m.id, {
          nombre: m.nombre,
          tipoModulo: m.tipoModulo,
          dimensiones: `${Math.round(m.ancho)}×${Math.round(m.alto)}×${Math.round(m.profundidad)}mm`,
          cantidad: 1,
        })
      }
    }
    const modulosOrdenados = Array.from(modulosAgg.values())
      .sort((a, b) => a.tipoModulo.localeCompare(b.tipoModulo) || a.nombre.localeCompare(b.nombre))

    const totalModulos = modulosOrdenados.reduce((s, m) => s + m.cantidad, 0)
    const descripcionLines: string[] = [
      `Mueble generado desde el configurador de cocinas — proyecto #${projectId}`,
      `Total: ${totalModulos} módulo(s) (${modulosOrdenados.length} único(s))`,
      '',
      'Listado de módulos:',
    ]
    for (const m of modulosOrdenados) {
      descripcionLines.push(`• ${m.cantidad}× ${m.nombre} — ${m.tipoModulo} (${m.dimensiones})`)
    }
    const descripcion = descripcionLines.join('\n')

    // ── 4. Construir líneas de recursos del APU ───────────────────────────────
    type ApuLine = {
      descripcionLibre: string
      unidadLibre: string
      tipoLinea: string
      cantidad: number
      costoSnapshot: number
      subtotal: number
    }
    const apuLines: ApuLine[] = []

    // 4a. Tableros (una línea por tablero, cantidad = planchas)
    for (const g of nestGroups) {
      const lookup = materialLookup[g.tablero]
      const precio = lookup?.precio ?? 0
      const numPlanchas = g.sheets.length
      apuLines.push({
        descripcionLibre: `Tablero ${g.tablero}`,
        unidadLibre: 'plancha',
        tipoLinea: 'materiales',
        cantidad: numPlanchas,
        costoSnapshot: precio,
        subtotal: Math.round(numPlanchas * precio * 100) / 100,
      })
    }

    // 4b. Cantos y herrajes (ordenados: cantos primero, luego herrajes, alfabético)
    const matsOrdenados = Array.from(herrajesCantos.values()).sort((a, b) => {
      if (a.tipo !== b.tipo) return a.tipo === 'canto' ? -1 : 1
      return a.nombre.localeCompare(b.nombre)
    })
    for (const mat of matsOrdenados) {
      const cantidad = Math.round(mat.cantidad * 100) / 100
      apuLines.push({
        descripcionLibre: `${mat.tipo === 'canto' ? 'Canto' : 'Herraje'} — ${mat.nombre}`,
        unidadLibre: mat.unidad,
        tipoLinea: 'materiales',
        cantidad,
        costoSnapshot: mat.costoSnapshot,
        subtotal: Math.round(cantidad * mat.costoSnapshot * 100) / 100,
      })
    }

    // ── 5. Calcular totales del APU ───────────────────────────────────────────
    const indirectos = 10
    const utilidad = 20
    const desperdicioApu = 5
    const costoDirecto = apuLines.reduce((s, l) => s + l.subtotal, 0)
    const costoTotal = costoDirecto * (1 + indirectos / 100)
    const precioVenta = costoTotal * (1 + utilidad / 100)

    // ── 6. Código secuencial ──────────────────────────────────────────────────
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

    // ── 7. Crear APU ──────────────────────────────────────────────────────────
    const apu = await prisma.apuCatalogo.create({
      data: {
        codigo,
        nombre: apuNombre,
        descripcion,
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
          create: apuLines.map((l, i) => ({
            tipoComponente: 'libre',
            descripcionLibre: l.descripcionLibre,
            unidadLibre: l.unidadLibre,
            tipoLinea: l.tipoLinea,
            cantidad: l.cantidad,
            costoSnapshot: l.costoSnapshot,
            subtotal: l.subtotal,
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
})
