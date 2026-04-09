import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'

// GET /api/proyectos/[id]/evm — lista de snapshots EVM
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await checkPermiso(request, 'proyectos', 'ver')
  if (denied) return denied

  const { id } = await params
  const proyectoId = parseInt(id)
  if (isNaN(proyectoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const snapshots = await prisma.eVMSnapshot.findMany({
    where: { proyectoId },
    orderBy: { fecha: 'asc' },
  })

  return NextResponse.json(snapshots)
}

// POST /api/proyectos/[id]/evm — crear snapshot (manual o auto)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await checkPermiso(request, 'proyectos', 'editar')
  if (denied) return denied

  const { id } = await params
  const proyectoId = parseInt(id)
  if (isNaN(proyectoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = await request.json()

    // Si _auto=true, calcular valores desde los datos del proyecto
    if (body._auto) {
      const proyecto = await prisma.proyecto.findUnique({
        where: { id: proyectoId },
        select: {
          presupuestoEstimado: true,
          avanceFisico: true,
          fechaInicio: true,
          fechaEstimada: true,
        },
      })
      if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

      // BAC = presupuesto estimado + adicionales aprobados
      const adicionales = await prisma.adicionalProyecto.aggregate({
        where: { proyectoId, estado: 'aprobado' },
        _sum: { monto: true },
      })
      const BAC = (proyecto.presupuestoEstimado || 0) + (adicionales._sum.monto || 0)
      const avance = proyecto.avanceFisico / 100

      // AC = costo real gastado
      const gastosAgg = await prisma.gastoProyecto.aggregate({
        where: { proyectoId },
        _sum: { monto: true },
      })
      const AC = gastosAgg._sum.monto || 0

      // EV = BAC × avance%
      const EV = BAC * avance

      // PV = BAC × (proporción temporal transcurrida)
      let PV = 0
      if (proyecto.fechaInicio && proyecto.fechaEstimada) {
        const inicio = new Date(proyecto.fechaInicio).getTime()
        const fin = new Date(proyecto.fechaEstimada).getTime()
        const ahora = Date.now()
        const duracionTotal = fin - inicio
        if (duracionTotal > 0) {
          const transcurrido = Math.min(Math.max(ahora - inicio, 0), duracionTotal)
          PV = BAC * (transcurrido / duracionTotal)
        }
      }

      const SPI = PV > 0 ? EV / PV : null
      const CPI = AC > 0 ? EV / AC : null
      const EAC = CPI && CPI > 0 ? BAC / CPI : null

      const snapshot = await prisma.eVMSnapshot.create({
        data: {
          proyectoId,
          fecha: new Date(),
          avanceFisico: proyecto.avanceFisico,
          presupuestoBase: BAC,
          valorPlanificado: Math.round(PV * 100) / 100,
          valorGanado: Math.round(EV * 100) / 100,
          costoReal: Math.round(AC * 100) / 100,
          spi: SPI ? Math.round(SPI * 1000) / 1000 : null,
          cpi: CPI ? Math.round(CPI * 1000) / 1000 : null,
          eac: EAC ? Math.round(EAC * 100) / 100 : null,
          notas: body.notas || null,
        },
      })

      return NextResponse.json(snapshot)
    }

    // Manual snapshot
    const avanceFisico = parseFloat(body.avanceFisico) || 0
    const presupuestoBase = parseFloat(body.presupuestoBase) || 0
    const valorPlanificado = parseFloat(body.valorPlanificado) || 0
    const valorGanado = parseFloat(body.valorGanado) || 0
    const costoReal = parseFloat(body.costoReal) || 0

    const SPI = valorPlanificado > 0 ? valorGanado / valorPlanificado : null
    const CPI = costoReal > 0 ? valorGanado / costoReal : null
    const EAC = CPI && CPI > 0 ? presupuestoBase / CPI : null

    const snapshot = await prisma.eVMSnapshot.create({
      data: {
        proyectoId,
        fecha: body.fecha ? new Date(body.fecha) : new Date(),
        avanceFisico,
        presupuestoBase,
        valorPlanificado,
        valorGanado,
        costoReal,
        spi: SPI ? Math.round(SPI * 1000) / 1000 : null,
        cpi: CPI ? Math.round(CPI * 1000) / 1000 : null,
        eac: EAC ? Math.round(EAC * 100) / 100 : null,
        notas: body.notas?.toString().trim() || null,
      },
    })

    return NextResponse.json(snapshot)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al crear snapshot'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
