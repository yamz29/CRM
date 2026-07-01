import { headers } from 'next/headers'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Card, CardContent } from '@/components/ui/card'
import { EstadoBadge } from '@/lib/estados'
import { formatDate } from '@/lib/utils'
import { CheckCircle2, Clock, AlertTriangle, CalendarDays, FolderOpen, ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface TareaMia {
  id: number
  titulo: string
  fechaLimite: Date | null
  estado: string
  proyecto: { id: number; nombre: string } | null
  cliente: { nombre: string } | null
}

function inicioDelDia(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export default async function MiDiaPage() {
  const h = await headers()
  const userId = parseInt(h.get('x-user-id') ?? '')
  const nombre = (h.get('x-user-nombre') ?? '').split(' ')[0]

  if (Number.isNaN(userId)) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center text-muted-foreground">
        No se pudo identificar tu usuario. Vuelve a iniciar sesión.
      </div>
    )
  }

  // Rango de la semana (lunes 00:00 → lunes siguiente, exclusivo)
  const hoyInicio = inicioDelDia(new Date())
  const manana = new Date(hoyInicio); manana.setDate(hoyInicio.getDate() + 1)
  const diaSemana = hoyInicio.getDay() // 0=Dom..6=Sáb
  const desdeLunes = (diaSemana + 6) % 7
  const semanaInicio = new Date(hoyInicio); semanaInicio.setDate(hoyInicio.getDate() - desdeLunes)
  const semanaFin = new Date(semanaInicio); semanaFin.setDate(semanaInicio.getDate() + 7)

  const [tareas, horas] = await Promise.all([
    prisma.tarea.findMany({
      where: {
        asignadoId: userId,
        archivada: false,
        estado: { notIn: ['Completada', 'Cancelada'] },
      },
      select: {
        id: true, titulo: true, fechaLimite: true, estado: true,
        proyecto: { select: { id: true, nombre: true } },
        cliente: { select: { nombre: true } },
      },
      orderBy: [{ fechaLimite: 'asc' }],
    }),
    prisma.registroHoras.findMany({
      where: { usuarioId: userId, fecha: { gte: semanaInicio, lt: semanaFin } },
      select: { horas: true },
    }),
  ])

  const vencidas: TareaMia[] = []
  const deHoy: TareaMia[] = []
  const proximas: TareaMia[] = []
  for (const t of tareas as TareaMia[]) {
    if (t.fechaLimite && t.fechaLimite < hoyInicio) vencidas.push(t)
    else if (t.fechaLimite && t.fechaLimite >= hoyInicio && t.fechaLimite < manana) deHoy.push(t)
    else proximas.push(t)
  }

  const totalHoras = horas.reduce((s, r) => s + r.horas, 0)

  // Proyectos en los que estoy trabajando (derivado de mis tareas abiertas)
  const proyectosMap = new Map<number, string>()
  for (const t of tareas as TareaMia[]) {
    if (t.proyecto) proyectosMap.set(t.proyecto.id, t.proyecto.nombre)
  }
  const misProyectos = Array.from(proyectosMap, ([id, nombre]) => ({ id, nombre }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {nombre ? `Hola, ${nombre}` : 'Mi día'}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Tu resumen personal de hoy.</p>
      </div>

      {/* Métricas rápidas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard icon={AlertTriangle} tono="rojo" valor={vencidas.length} label="Tareas vencidas" />
        <MetricCard icon={CalendarDays} tono="azul" valor={deHoy.length} label="Para hoy" />
        <MetricCard icon={Clock} tono="amber" valor={proximas.length} label="Próximas" />
        <MetricCard icon={CheckCircle2} tono="verde" valor={`${totalHoras.toFixed(1)}h`} label="Horas esta semana" />
      </div>

      {/* Mis tareas */}
      <div className="space-y-4">
        {tareas.length === 0 ? (
          <Card>
            <CardContent className="py-10 flex items-center justify-center gap-3 text-muted-foreground">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <p className="text-sm">No tienes tareas pendientes asignadas.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <GrupoTareas titulo="Vencidas" tono="text-red-600" tareas={vencidas} />
            <GrupoTareas titulo="Para hoy" tono="text-blue-600" tareas={deHoy} />
            <GrupoTareas titulo="Próximas" tono="text-amber-600" tareas={proximas} />
          </>
        )}
      </div>

      {/* Mis proyectos + horas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Mis proyectos</h2>
              <Link href="/proyectos" className="text-xs text-primary hover:underline">Ver todos</Link>
            </div>
            {misProyectos.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tienes tareas asociadas a proyectos.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {misProyectos.map(p => (
                  <Link
                    key={p.id}
                    href={`/proyectos/${p.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-foreground hover:bg-muted/40 transition-colors"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
                    {p.nombre}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Horas de la semana</h2>
              <Link href="/horas" className="text-xs text-primary hover:underline">Registrar horas</Link>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground tabular-nums">{totalHoras.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">horas registradas esta semana</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MetricCard({ icon: Icon, tono, valor, label }: {
  icon: React.ComponentType<{ className?: string }>
  tono: 'rojo' | 'azul' | 'amber' | 'verde'
  valor: number | string
  label: string
}) {
  const color = {
    rojo: 'text-red-600 dark:text-red-400',
    azul: 'text-blue-600 dark:text-blue-400',
    amber: 'text-amber-600 dark:text-amber-400',
    verde: 'text-green-600 dark:text-green-400',
  }[tono]
  return (
    <Card>
      <CardContent className="py-4">
        <Icon className={`w-5 h-5 ${color} mb-2`} />
        <p className="text-2xl font-bold text-foreground tabular-nums">{valor}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  )
}

function GrupoTareas({ titulo, tono, tareas }: { titulo: string; tono: string; tareas: TareaMia[] }) {
  if (tareas.length === 0) return null
  return (
    <div>
      <h2 className={`text-sm font-semibold uppercase tracking-wider mb-2 ${tono}`}>
        {titulo} ({tareas.length})
      </h2>
      <Card>
        <CardContent className="p-0 divide-y divide-border">
          {tareas.map(t => (
            <Link
              key={t.id}
              href="/tareas"
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{t.titulo}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {[t.proyecto?.nombre, t.cliente?.nombre].filter(Boolean).join(' · ') || 'Sin proyecto'}
                </p>
              </div>
              {t.fechaLimite && (
                <span className="text-xs text-muted-foreground shrink-0">{formatDate(t.fechaLimite)}</span>
              )}
              <EstadoBadge dominio="tarea" estado={t.estado} />
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
