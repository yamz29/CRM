import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Plus, Wallet, CheckCircle2, FileClock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { StatsCard } from '@/components/ui/stats-card'
import { SuccessBanner } from '@/components/ui/success-banner'
import { HelpDrawer } from '@/components/help/HelpDrawer'
import { PeriodosTable } from '@/components/nomina/PeriodosTable'
import { formatDate } from '@/lib/utils'

interface SearchParams { msg?: string }

export default async function NominaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { msg } = await searchParams

  const periodos = await prisma.periodoNomina.findMany({
    orderBy: { fechaInicio: 'desc' },
    include: { lineas: { select: { totalNeto: true } } },
  })

  const periodosSerial = periodos.map((p) => ({
    id: p.id,
    fechaInicio: p.fechaInicio.toISOString(),
    fechaFin: p.fechaFin.toISOString(),
    fechaPago: p.fechaPago ? p.fechaPago.toISOString() : null,
    estado: p.estado,
    cantidadEmpleados: p.lineas.length,
    totalNeto: p.lineas.reduce((acc, l) => acc + l.totalNeto, 0),
  }))

  const borradores = periodos.filter((p) => p.estado === 'Borrador').length
  const pagadas = periodos.filter((p) => p.estado === 'Pagada').length
  const ultimoPago = periodos.find((p) => p.estado === 'Pagada' && p.fechaPago)

  return (
    <div className="space-y-6">
      {msg === 'creado' && <SuccessBanner mensaje="Período de nómina creado exitosamente" />}

      <PageHeader
        title="Nómina"
        subtitle="Períodos de pago quincenal, horas extra y deducciones de ley"
        actions={
          <>
            <HelpDrawer slug="nomina" titulo="Nómina" />
            <Link href="/nomina/nuevo">
              <Button><Plus className="w-4 h-4" /> Nuevo Período</Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard title="Total períodos" value={periodos.length} icon={<Wallet className="w-5 h-5" />} colorClass="bg-blue-500/10 text-blue-500" />
        <StatsCard title="En borrador" value={borradores} icon={<FileClock className="w-5 h-5" />} colorClass="bg-amber-500/10 text-amber-500" />
        <StatsCard title="Pagadas" value={pagadas} icon={<CheckCircle2 className="w-5 h-5" />} colorClass="bg-green-500/10 text-green-500" />
        <StatsCard title="Último pago" value={ultimoPago?.fechaPago ? formatDate(ultimoPago.fechaPago) : '—'} icon={<Wallet className="w-5 h-5" />} colorClass="bg-slate-500/10 text-slate-500" />
      </div>

      <PeriodosTable periodos={periodosSerial} />
    </div>
  )
}
