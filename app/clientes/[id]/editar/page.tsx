import { prisma } from '@/lib/prisma'
import { BackButton } from '@/components/ui/back-button'
import { notFound } from 'next/navigation'
import { ClienteForm } from '@/components/clientes/ClienteForm'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) notFound()

  const cliente = await prisma.cliente.findUnique({ where: { id } })
  if (!cliente) notFound()

  return (
    <div className="space-y-6 max-w-3xl">
      <Breadcrumbs items={[{ label: 'Clientes', href: '/clientes' }, { label: cliente.nombre, href: `/clientes/${cliente.id}` }, { label: 'Editar' }]} />
      {/* Header */}
      <div className="flex items-center gap-4">
        <BackButton fallbackHref={`/clientes/${cliente.id}`} />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Editar Cliente</h1>
          <p className="text-muted-foreground mt-0.5">{cliente.nombre}</p>
        </div>
      </div>

      <ClienteForm
        mode="edit"
        initialData={{
          id: cliente.id,
          nombre: cliente.nombre,
          telefono: cliente.telefono || '',
          whatsapp: cliente.whatsapp || '',
          correo: cliente.correo || '',
          direccion: cliente.direccion || '',
          tipoCliente: cliente.tipoCliente,
          fuente: cliente.fuente,
          notas: cliente.notas || '',
        }}
      />
    </div>
  )
}
