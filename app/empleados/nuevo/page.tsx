import Link from 'next/link'
import { headers } from 'next/headers'
import { ArrowLeft } from 'lucide-react'
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
      <div className="flex items-center gap-4">
        <Link href="/empleados"
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nuevo Empleado</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Agregar empleado a la nómina</p>
        </div>
      </div>
      <EmpleadoForm mode="create" esAdmin={esAdmin} usuarios={usuarios} />
    </div>
  )
}
