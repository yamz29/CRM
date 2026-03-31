import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import { Plus, CalendarRange, FolderOpen, CheckCircle2, Clock, AlertCircle, PauseCircle } from 'lucide-react'

const ESTADO_CFG: Record<string, { color: string; icon: React.ElementType }> = {
  'Planificado':   { color: 'bg-slate-100 text-slate-700 border-slate-200',   icon: Clock },
  'En Ejecución':  { color: 'bg-blue-100 text-blue-700 border-blue-200',       icon: CalendarRange },
  'Terminado':     { color: 'bg-green-100 text-green-700 border-green-200',    icon: CheckCircle2 },
  'Pausado':       { color: 'bg-amber-100 text-amber-700 border-amber-200',    icon: PauseCircle },
}

function EstadoBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_CFG[estado] || { color: 'bg-gray-100 text-gray-700 border-gray-200', icon: AlertCircle }
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon className="w-3 h-3" />{estado}
    </span>
  )
}

export default async function CronogramaPage() {
  const cronogramas = await prisma.cronograma.findMany({
    include: {
      proyecto: { select: { id: true, nombre: true } },
      presupuesto: { select: { id: true, numero: true } },
      _count: { select: { actividades: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const stats = {
    total: cronogramas.length,
    enEjecucion: cronogramas.filter(c => c.estado === 'En Ejecución').length,
    terminados: cronogramas.filter(c => c.estado === 'Terminado').length,
    planificados: cronogramas.filter(c => c.estado === 'Planificado').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cronogramas</h1>
          <p className="text-muted-foreground mt-1">{cronogramas.length} cronogramas registrados</p>
        </div>
        <Link href="/cronograma/nuevo">
          <Button>
            <Plus className="w-4 h-4" /> Nuevo cronograma
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' },
          { label: 'En Ejecución', value: stats.enEjecucion, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
          { label: 'Planificados', value: stats.planificados, color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' },
          { label: 'Terminados', value: stats.terminados, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{s.label}</p>
            <p className={`text-3xl font-black mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Lista */}
      <Card>
        <CardContent className="p-0">
          {cronogramas.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <CalendarRange className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground font-medium">Sin cronogramas creados</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Crea uno nuevo o genéralo desde un presupuesto</p>
              <Link href="/cronograma/nuevo" className="mt-4">
                <Button size="sm"><Plus className="w-4 h-4" /> Nuevo cronograma</Button>
              </Link>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Proyecto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Presupuesto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Inicio</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Fin est.</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Actividades</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cronogramas.map(c => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/cronograma/${c.id}`} className="text-sm font-semibold text-foreground hover:text-primary">
                        {c.nombre}
                      </Link>
                      <p className="text-xs text-muted-foreground">v{c.version}</p>
                    </td>
                    <td className="px-4 py-3">
                      {c.proyecto ? (
                        <Link href={`/proyectos/${c.proyecto.id}`} className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1">
                          <FolderOpen className="w-3.5 h-3.5" />
                          {c.proyecto.nombre.length > 28 ? c.proyecto.nombre.slice(0, 28) + '…' : c.proyecto.nombre}
                        </Link>
                      ) : <span className="text-muted-foreground/40 text-sm">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {c.presupuesto?.numero ?? <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(c.fechaInicio)}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {c.fechaFinEstimado ? formatDate(c.fechaFinEstimado) : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-bold text-foreground">{c._count.actividades}</span>
                    </td>
                    <td className="px-4 py-3"><EstadoBadge estado={c.estado} /></td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/cronograma/${c.id}`}>
                        <Button variant="ghost" size="sm">Ver →</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
