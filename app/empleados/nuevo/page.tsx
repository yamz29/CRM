import { BackButton } from '@/components/ui/back-button'
import { headers } from 'next/headers'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { EmpleadoForm } from '@/components/empleados/EmpleadoForm'
import { prisma } from '@/lib/prisma'

export default async function NuevoEmpleadoPage() {
  const hdrs = await headers()
  const esAdmin = hdrs.get('x-user-rol') === 'Admin'
  const usuarios = await prisma.usuario.findMany({
    where: { activo: true },
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  })

  return (
    <div className="space-y-6 max-w-2xl">
      <Breadcrumbs items={[{ label: 'Empleados', href: '/empleados' }, { label: 'Nuevo empleado' }]} />
      <div className="flex items-center gap-4">
        <BackButton fallbackHref="/empleados" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nuevo Empleado</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Agregar empleado a la nómina</p>
        </div>
      </div>
      <EmpleadoForm mode="create" esAdmin={esAdmin} usuarios={usuarios} />
    </div>
  )
}
