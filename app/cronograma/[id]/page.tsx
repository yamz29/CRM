import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { ArrowLeft, FolderOpen, FileText, CalendarRange, AlertTriangle } from 'lucide-react'
import { CronogramaClient } from '@/components/cronograma/CronogramaClient'

export default async function CronogramaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const numId = parseInt(id)
  if (isNaN(numId)) notFound()

  const cronograma = await prisma.cronograma.findUnique({
    where: { id: numId },
    include: {
      proyecto: { select: { id: true, nombre: true, fechaEstimada: true } },
      presupuesto: { select: { id: true, numero: true } },
      actividades: {
        include: {
          avances: { orderBy: { fecha: 'desc' }, take: 3 },
          dependencia: { select: { id: true, nombre: true } },
        },
        orderBy: [{ orden: 'asc' }, { fechaInicio: 'asc' }],
      },
    },
  })

  if (!cronograma) notFound()

  // Presupuestos disponibles para generar actividades
  const presupuestosDisponibles = await prisma.presupuesto.findMany({
    where: {
      OR: [
        { proyectoId: cronograma.proyectoId ?? undefined },
        { id: cronograma.presupuestoId ?? undefined },
      ],
    },
    select: { id: true, numero: true, total: true },
    orderBy: { createdAt: 'desc' },
  })

  // Usuarios para asignación de avances
  const usuarios = await prisma.usuario.findMany({
    where: { activo: true },
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  })

  // Auto-calcular estado de actividades
  const hoy = new Date()
  const actividades = cronograma.actividades.map(a => ({
    ...a,
    estado: a.pctAvance >= 100
      ? 'Completado'
      : a.pctAvance > 0
        ? (new Date(a.fechaFin) < hoy ? 'Atrasado' : 'En Ejecución')
        : (new Date(a.fechaFin) < hoy ? 'Atrasado' : 'Pendiente'),
  }))

  // Alerta de desbordamiento: ¿el cronograma termina después de la fecha
  // estimada del proyecto? Avisa al usuario para que ajuste presupuesto,
  // renegocie la fecha con el cliente o acelere tareas críticas.
  let desbordamiento: { fechaFinCronograma: Date; fechaEstimada: Date; diasExceso: number } | null = null
  if (cronograma.proyecto?.fechaEstimada && actividades.length > 0) {
    const fechaFinCronograma = actividades.reduce(
      (max, a) => (new Date(a.fechaFin) > max ? new Date(a.fechaFin) : max),
      new Date(0)
    )
    const fechaEst = new Date(cronograma.proyecto.fechaEstimada)
    if (fechaFinCronograma > fechaEst) {
      const MS_DAY = 86_400_000
      const diasExceso = Math.ceil((fechaFinCronograma.getTime() - fechaEst.getTime()) / MS_DAY)
      desbordamiento = { fechaFinCronograma, fechaEstimada: fechaEst, diasExceso }
    }
  }

  const stats = {
    total: actividades.length,
    completadas: actividades.filter(a => a.estado === 'Completado').length,
    atrasadas: actividades.filter(a => a.estado === 'Atrasado').length,
    enEjecucion: actividades.filter(a => a.estado === 'En Ejecución').length,
    pctGeneral: actividades.length > 0
      ? Math.round(actividades.reduce((s, a) => s + a.pctAvance, 0) / actividades.length)
      : 0,
  }

  return (
    <div className="space-y-6 max-w-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link href="/cronograma"
            className="flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted transition-colors mt-0.5 shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{cronograma.nombre}</h1>
            <div className="flex items-center gap-4 mt-1 flex-wrap">
              {cronograma.proyecto && (
                <Link href={`/proyectos/${cronograma.proyecto.id}`}
                  className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1">
                  <FolderOpen className="w-3.5 h-3.5" />{cronograma.proyecto.nombre}
                </Link>
              )}
              {cronograma.presupuesto && (
                <Link href={`/presupuestos/${cronograma.presupuesto.id}`}
                  className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />{cronograma.presupuesto.numero}
                </Link>
              )}
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <CalendarRange className="w-3.5 h-3.5" />
                {formatDate(cronograma.fechaInicio)}
                {cronograma.fechaFinEstimado && ` → ${formatDate(cronograma.fechaFinEstimado)}`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Aviso de desbordamiento de fecha del proyecto */}
      {desbordamiento && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              El cronograma excede la fecha estimada del proyecto en {desbordamiento.diasExceso} día{desbordamiento.diasExceso !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
              Fecha estimada del proyecto: <strong>{formatDate(desbordamiento.fechaEstimada)}</strong>.
              Última actividad termina: <strong>{formatDate(desbordamiento.fechaFinCronograma)}</strong>.
              Considera ajustar la fecha del proyecto, acortar la ruta crítica, o renegociar el plazo con el cliente.
            </p>
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Actividades', value: stats.total, color: 'text-foreground' },
          { label: 'Completadas', value: stats.completadas, color: 'text-green-600' },
          { label: 'En Ejecución', value: stats.enEjecucion, color: 'text-blue-600' },
          { label: 'Atrasadas', value: stats.atrasadas, color: 'text-red-600' },
          { label: 'Avance general', value: `${stats.pctGeneral}%`, color: stats.pctGeneral >= 80 ? 'text-green-600' : stats.pctGeneral >= 40 ? 'text-blue-600' : 'text-foreground' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl px-4 py-3">
            <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
            <p className={`text-2xl font-black mt-0.5 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Barra de progreso general */}
      <div className="bg-card border border-border rounded-xl px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-foreground">Progreso general</span>
          <span className="text-sm font-bold text-foreground">{stats.pctGeneral}%</span>
        </div>
        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${stats.pctGeneral >= 100 ? 'bg-green-500' : stats.pctGeneral >= 60 ? 'bg-blue-500' : 'bg-amber-400'}`}
            style={{ width: `${stats.pctGeneral}%` }}
          />
        </div>
      </div>

      {/* Client component: Gantt + tabla */}
      <CronogramaClient
        cronograma={{ ...cronograma, actividades }}
        presupuestosDisponibles={presupuestosDisponibles}
        usuarios={usuarios}
      />
    </div>
  )
}
