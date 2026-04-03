import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { StatsCard } from '@/components/ui/stats-card'
import { Clock, TrendingUp, Calendar, Users } from 'lucide-react'
import { HorasPageClient } from '@/components/horas/HorasPageClient'
import { HelpDrawer } from '@/components/help/HelpDrawer'

export default async function HorasPage() {
  const now   = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const hace7  = new Date(today);   hace7.setDate(today.getDate() - 7)
  const hace30 = new Date(today);   hace30.setDate(today.getDate() - 30)
  const hace90 = new Date(today);   hace90.setDate(today.getDate() - 90)

  const session = await getSession()

  const [registros, proyectos, usuarios, clientes, agHoy, ag7d, ag30d] = await Promise.all([
    prisma.registroHoras.findMany({
      where: { fecha: { gte: hace90 } },
      include: {
        usuario:  { select: { id: true, nombre: true } },
        proyecto: { select: { id: true, nombre: true } },
        cliente:  { select: { id: true, nombre: true } },
      },
      orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.proyecto.findMany({
      where: { estado: { in: ['En Ejecución', 'Activo', 'Prospecto'] } },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.usuario.findMany({
      where:   { activo: true },
      select:  { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.cliente.findMany({
      select:  { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.registroHoras.aggregate({
      where: { fecha: { gte: today, lt: tomorrow } },
      _sum: { horas: true },
    }),
    prisma.registroHoras.aggregate({
      where: { fecha: { gte: hace7 } },
      _sum: { horas: true },
    }),
    prisma.registroHoras.aggregate({
      where: { fecha: { gte: hace30 } },
      _sum: { horas: true },
    }),
  ])

  const horasHoy  = agHoy._sum.horas  ?? 0
  const horas7d   = ag7d._sum.horas   ?? 0
  const horas30d  = ag30d._sum.horas  ?? 0
  const totalRegs = registros.length

  const registrosSerial = registros.map((r) => ({
    ...r,
    fecha:     r.fecha.toISOString(),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    cliente:   r.cliente ?? null,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Horas del Equipo</h1>
          <p className="text-muted-foreground mt-1">Registro y análisis de tiempo del equipo</p>
        </div>
        <HelpDrawer slug="horas" titulo="Control de Horas" />
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard
          title="Horas hoy"
          value={horasHoy % 1 === 0 ? horasHoy : horasHoy.toFixed(1)}
          icon={<Clock className="w-5 h-5" />}
          colorClass="bg-blue-500/10 text-blue-500"
        />
        <StatsCard
          title="Últimos 7 días"
          value={horas7d % 1 === 0 ? horas7d : horas7d.toFixed(1)}
          icon={<TrendingUp className="w-5 h-5" />}
          colorClass="bg-green-500/10 text-green-500"
        />
        <StatsCard
          title="Últimos 30 días"
          value={horas30d % 1 === 0 ? horas30d : horas30d.toFixed(1)}
          icon={<Calendar className="w-5 h-5" />}
          colorClass="bg-purple-500/10 text-purple-500"
        />
        <StatsCard
          title="Registros (90d)"
          value={totalRegs}
          icon={<Users className="w-5 h-5" />}
          colorClass="bg-muted text-muted-foreground"
        />
      </div>

      <HorasPageClient
        registros={registrosSerial as Parameters<typeof HorasPageClient>[0]['registros']}
        proyectos={proyectos}
        usuarios={usuarios}
        clientes={clientes}
        currentUserId={session?.id ?? null}
      />
    </div>
  )
}
