import Link from 'next/link'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { ArrowLeft } from 'lucide-react'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { LineasNominaPanel } from '@/components/nomina/LineasNominaPanel'

export default async function PeriodoNominaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) notFound()

  const hdrs = await headers()
  const esAdmin = hdrs.get('x-user-rol') === 'Admin'

  const periodo = await prisma.periodoNomina.findUnique({
    where: { id },
    include: { lineas: { include: { empleado: true }, orderBy: { id: 'asc' } } },
  })
  if (!periodo) notFound()

  const lineasSerial = periodo.lineas.map((l) => ({
    id: l.id,
    empleadoId: l.empleadoId,
    empleadoNombre: l.empleado.nombre,
    salarioBase: l.salarioBase,
    horasExtra: l.horasExtra,
    valorHoraExtra: l.valorHoraExtra,
    bonificaciones: l.bonificaciones,
    otrosDescuentos: l.otrosDescuentos,
    motivoDescuento: l.motivoDescuento,
    afp: l.afp,
    sfs: l.sfs,
    totalBruto: l.totalBruto,
    totalNeto: l.totalNeto,
  }))

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Nómina', href: '/nomina' },
        { label: `${formatDate(periodo.fechaInicio)} — ${formatDate(periodo.fechaFin)}` },
      ]} />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/nomina"
            className="flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {formatDate(periodo.fechaInicio)} — {formatDate(periodo.fechaFin)}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Período de nómina · {periodo.estado}
              {periodo.fechaPago ? ` · Pagado el ${formatDate(periodo.fechaPago)}` : ''}
            </p>
          </div>
        </div>
      </div>

      <LineasNominaPanel
        periodoId={periodo.id}
        estado={periodo.estado}
        lineas={lineasSerial}
        esAdmin={esAdmin}
      />
    </div>
  )
}
