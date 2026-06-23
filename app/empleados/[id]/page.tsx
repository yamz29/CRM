import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { ArrowLeft, Pencil } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { SolicitudesPanel } from '@/components/empleados/SolicitudesPanel'

const DIA_LABELS: Record<string, string> = { L: 'Lun', M: 'Mar', X: 'Mié', J: 'Jue', V: 'Vie', S: 'Sáb', D: 'Dom' }

function formatHora(h: number | null) {
  if (h == null) return '—'
  const horas = Math.floor(h)
  const minutos = Math.round((h - horas) * 60)
  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`
}

export default async function EmpleadoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) notFound()

  const hdrs = await headers()
  const esAdmin = hdrs.get('x-user-rol') === 'Admin'

  const empleado = await prisma.empleado.findUnique({
    where: { id },
    include: { solicitudes: { orderBy: { fechaInicio: 'desc' } } },
  })
  if (!empleado) notFound()

  const dias = (empleado.diasLaborables || '').split(',').filter(Boolean)
  const solicitudesSerial = empleado.solicitudes.map((s) => ({
    ...s,
    fechaInicio: s.fechaInicio.toISOString(),
    fechaFin: s.fechaFin.toISOString(),
  }))

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/empleados"
            className="flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{empleado.nombre}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{empleado.cargo || 'Sin cargo asignado'}{empleado.departamento ? ` · ${empleado.departamento}` : ''}</p>
          </div>
        </div>
        <Link href={`/empleados/${empleado.id}/editar`}>
          <Button variant="secondary"><Pencil className="w-4 h-4" /> Editar</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Datos personales</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Cédula</dt><dd className="text-foreground">{empleado.cedula || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Teléfono</dt><dd className="text-foreground">{empleado.telefono || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Correo</dt><dd className="text-foreground">{empleado.correo || '—'}</dd></div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Estado</dt>
              <dd>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${empleado.activo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                  {empleado.activo ? 'Activo' : 'Inactivo'}
                </span>
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-card rounded-xl border border-border p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Relación laboral</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Fecha ingreso</dt><dd className="text-foreground">{formatDate(empleado.fechaIngreso)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Fecha salida</dt><dd className="text-foreground">{empleado.fechaSalida ? formatDate(empleado.fechaSalida) : '—'}</dd></div>
            {esAdmin && (
              <div className="flex justify-between"><dt className="text-muted-foreground">Salario</dt><dd className="text-foreground font-medium">{empleado.salario ? formatCurrency(empleado.salario) : '—'}</dd></div>
            )}
            <div className="flex justify-between"><dt className="text-muted-foreground">Banco</dt><dd className="text-foreground">{empleado.banco || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Cuenta</dt><dd className="text-foreground">{empleado.numeroCuenta ? `${empleado.numeroCuenta} (${empleado.tipoCuenta || '—'})` : '—'}</dd></div>
          </dl>
        </div>

        <div className="bg-card rounded-xl border border-border p-5 space-y-3 col-span-2">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Horario contractual</h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><dt className="text-muted-foreground">Entrada</dt><dd className="text-foreground font-medium">{formatHora(empleado.horaEntrada)}</dd></div>
            <div><dt className="text-muted-foreground">Salida</dt><dd className="text-foreground font-medium">{formatHora(empleado.horaSalida)}</dd></div>
            <div><dt className="text-muted-foreground">Horas/día</dt><dd className="text-foreground font-medium">{empleado.horasPorDia ?? '—'}</dd></div>
          </div>
          <div>
            <dt className="text-muted-foreground text-sm mb-1.5">Días laborables</dt>
            <div className="flex gap-1.5">
              {dias.length === 0 && <span className="text-sm text-foreground">—</span>}
              {dias.map((d) => (
                <span key={d} className="px-2.5 py-1 text-xs font-medium rounded-lg bg-blue-100 text-blue-700">{DIA_LABELS[d] || d}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {empleado.observaciones && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-2">Observaciones</h2>
          <p className="text-sm text-foreground whitespace-pre-wrap">{empleado.observaciones}</p>
        </div>
      )}

      <SolicitudesPanel
        empleadoId={empleado.id}
        solicitudes={solicitudesSerial}
        diasVacacionesAnual={empleado.diasVacacionesAnual}
      />
    </div>
  )
}
