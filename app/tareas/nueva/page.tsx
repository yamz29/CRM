import { prisma } from '@/lib/prisma'
import { BackButton } from '@/components/ui/back-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TareaForm } from '@/components/tareas/TareaForm'

export default async function NuevaTareaPage() {
  const [clientes, proyectos, usuarios] = await Promise.all([
    prisma.cliente.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.proyecto.findMany({
      select: { id: true, nombre: true, clienteId: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.usuario.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
  ])

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <BackButton fallbackHref="/tareas" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nueva Tarea</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Registra una nueva tarea o seguimiento</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información de la Tarea</CardTitle>
        </CardHeader>
        <CardContent>
          <TareaForm clientes={clientes} proyectos={proyectos} usuarios={usuarios} mode="create" />
        </CardContent>
      </Card>
    </div>
  )
}
