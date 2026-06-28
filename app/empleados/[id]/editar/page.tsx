import { BackButton } from '@/components/ui/back-button'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { prisma } from '@/lib/prisma'
import { EmpleadoForm } from '@/components/empleados/EmpleadoForm'

export default async function EditarEmpleadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) notFound()

  const hdrs = await headers()
  const esAdmin = hdrs.get('x-user-rol') === 'Admin'

  const empleado = await prisma.empleado.findUnique({ where: { id }, include: { horarios: true } })
  if (!empleado) notFound()

  const usuarios = await prisma.usuario.findMany({
    where: { activo: true },
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  })

  return (
    <div className="space-y-6 max-w-2xl">
      <Breadcrumbs items={[{ label: 'Empleados', href: '/empleados' }, { label: empleado.nombre, href: `/empleados/${empleado.id}` }, { label: 'Editar' }]} />
      <div className="flex items-center gap-4">
        <BackButton fallbackHref="/empleados" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Editar Empleado</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{empleado.nombre}</p>
        </div>
      </div>
      <EmpleadoForm
        mode="edit"
        esAdmin={esAdmin}
        usuarios={usuarios}
        initialData={{
          id: empleado.id,
          nombre: empleado.nombre,
          cedula: empleado.cedula,
          telefono: empleado.telefono,
          correo: empleado.correo,
          cargo: empleado.cargo,
          departamento: empleado.departamento,
          fechaIngreso: empleado.fechaIngreso.toISOString(),
          fechaSalida: empleado.fechaSalida ? empleado.fechaSalida.toISOString() : null,
          activo: empleado.activo,
          salario: esAdmin ? empleado.salario : null,
          usuarioId: empleado.usuarioId,
          horarios: empleado.horarios,
          diasVacacionesAnual: empleado.diasVacacionesAnual,
          banco: empleado.banco,
          tipoCuenta: empleado.tipoCuenta,
          numeroCuenta: empleado.numeroCuenta,
          observaciones: empleado.observaciones,
        }}
      />
    </div>
  )
}
