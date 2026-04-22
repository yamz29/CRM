import { prisma } from '@/lib/prisma'
import { ReporteProyectosClient } from './ReporteProyectosClient'

interface SearchParams {
  desde?: string
  hasta?: string
  estados?: string   // csv
  tipos?: string     // csv
  archivados?: string
  pausados?: string
}

export default async function ReporteProyectosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams

  // Default: último año
  const hoy = new Date()
  const hace1Anio = new Date(hoy)
  hace1Anio.setFullYear(hace1Anio.getFullYear() - 1)

  const desde = params.desde ? new Date(params.desde) : hace1Anio
  const hasta = params.hasta ? new Date(params.hasta) : hoy
  // fin de día para hasta
  hasta.setHours(23, 59, 59, 999)

  const estadosFiltro = params.estados ? params.estados.split(',').filter(Boolean) : []
  const tiposFiltro = params.tipos ? params.tipos.split(',').filter(Boolean) : []
  const incluirArchivados = params.archivados === '1'
  const incluirPausados = params.pausados === '1'

  // Condición para el filtro por fecha: si el proyecto tiene fechaInicio, usarla.
  // Si no tiene, usar createdAt.
  // Por defecto se excluyen archivados y pausados (se consideran fuera de operación
  // activa — el usuario puede incluirlos con los toggles).
  const estadoExclusion: string[] = []
  if (!incluirPausados) estadoExclusion.push('Pausado')

  const proyectos = await prisma.proyecto.findMany({
    where: {
      ...(incluirArchivados ? {} : { archivada: false }),
      ...(estadosFiltro.length > 0
        ? { estado: { in: estadosFiltro } }
        : estadoExclusion.length > 0
          ? { estado: { notIn: estadoExclusion } }
          : {}),
      ...(tiposFiltro.length > 0 ? { tipoProyecto: { in: tiposFiltro } } : {}),
      OR: [
        { fechaInicio: { gte: desde, lte: hasta } },
        { AND: [{ fechaInicio: null }, { createdAt: { gte: desde, lte: hasta } }] },
      ],
    },
    include: {
      cliente: { select: { id: true, nombre: true } },
      gastos: { select: { monto: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Calcular métricas por proyecto
  const proyectosConMetricas = proyectos.map(p => {
    const gastado = p.gastos.reduce((s, g) => s + g.monto, 0)
    const presupuesto = p.presupuestoEstimado ?? 0
    const pctGasto = presupuesto > 0 ? (gastado / presupuesto) * 100 : 0
    const avance = p.avanceFisico ?? 0

    // Indicador de salud:
    // ✅ OK: pct gasto - avance <= 10, y pct gasto <= 100
    // ⚠️ Alerta: diferencia 10-25 o pct gasto 100-115
    // 🔴 Crítico: diferencia > 25 o pct gasto > 115
    let salud: 'ok' | 'alerta' | 'critico' = 'ok'
    if (presupuesto > 0) {
      const diff = pctGasto - avance
      if (pctGasto > 115 || diff > 25) salud = 'critico'
      else if (pctGasto > 100 || diff > 10) salud = 'alerta'
    }

    return {
      id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      cliente: p.cliente.nombre,
      clienteId: p.cliente.id,
      tipoProyecto: p.tipoProyecto,
      estado: p.estado,
      fechaInicio: p.fechaInicio?.toISOString() ?? null,
      fechaEstimada: p.fechaEstimada?.toISOString() ?? null,
      presupuesto,
      gastado,
      pctGasto,
      avance,
      salud,
      archivada: (p as { archivada?: boolean }).archivada ?? false,
    }
  })

  // Todos los tipos y estados posibles (para los selects de filtro)
  const tiposExistentes = Array.from(new Set(proyectos.map(p => p.tipoProyecto))).sort()
  const estadosExistentes = Array.from(new Set(proyectos.map(p => p.estado))).sort()

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <ReporteProyectosClient
        proyectos={proyectosConMetricas}
        desde={desde.toISOString().slice(0, 10)}
        hasta={(params.hasta ? new Date(params.hasta) : hoy).toISOString().slice(0, 10)}
        estadosFiltro={estadosFiltro}
        tiposFiltro={tiposFiltro}
        incluirArchivados={incluirArchivados}
        incluirPausados={incluirPausados}
        tiposExistentes={tiposExistentes}
        estadosExistentes={estadosExistentes}
      />
    </div>
  )
}
