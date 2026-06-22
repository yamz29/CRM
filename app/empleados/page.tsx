import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, Users, UserCheck, UserX, CalendarClock } from 'lucide-react'
import { StatsCard } from '@/components/ui/stats-card'
import { SuccessBanner } from '@/components/ui/success-banner'
import { HelpDrawer } from '@/components/help/HelpDrawer'
import { EmpleadosTable } from '@/components/empleados/EmpleadosTable'

interface SearchParams { msg?: string }

export default async function EmpleadosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { msg } = await searchParams
  const hdrs = await headers()
  const esAdmin = hdrs.get('x-user-rol') === 'Admin'

  const empleados = await prisma.empleado.findMany({
    include: {
      solicitudes: { where: { estado: 'Solicitado' }, select: { id: true } },
    },
    orderBy: { nombre: 'asc' },
  })

  const empleadosSerial = empleados.map(({ salario, solicitudes, ...resto }) => ({
    ...resto,
    ...(esAdmin ? { salario } : {}),
    fechaIngreso: resto.fechaIngreso.toISOString(),
    fechaSalida: resto.fechaSalida ? resto.fechaSalida.toISOString() : null,
    solicitudesPendientes: solicitudes.length,
  }))

  const activos = empleados.filter((e) => e.activo).length
  const inactivos = empleados.length - activos
  const conSolicitudesPendientes = empleados.filter((e) => e.solicitudes.length > 0).length

  return (
    <div className="space-y-6">
      {msg === 'creado' && <SuccessBanner mensaje="Empleado creado exitosamente" />}
      {msg === 'actualizado' && <SuccessBanner mensaje="Empleado actualizado exitosamente" />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Empleados</h1>
          <p className="text-muted-foreground mt-1">Ficha de personal, horario, vacaciones y permisos</p>
        </div>
        <div className="flex items-center gap-2">
          <HelpDrawer slug="empleados" titulo="Empleados" />
          <Link href="/empleados/nuevo">
            <Button><Plus className="w-4 h-4" /> Nuevo Empleado</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard title="Total" value={empleados.length} icon={<Users className="w-5 h-5" />} colorClass="bg-blue-500/10 text-blue-500" />
        <StatsCard title="Activos" value={activos} icon={<UserCheck className="w-5 h-5" />} colorClass="bg-green-500/10 text-green-500" />
        <StatsCard title="Inactivos" value={inactivos} icon={<UserX className="w-5 h-5" />} colorClass="bg-slate-500/10 text-slate-500" />
        <StatsCard title="Con solicitudes pendientes" value={conSolicitudesPendientes} icon={<CalendarClock className="w-5 h-5" />} colorClass="bg-amber-500/10 text-amber-500" />
      </div>

      <EmpleadosTable empleados={empleadosSerial} esAdmin={esAdmin} />
    </div>
  )
}
