import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { ClienteForm } from '@/components/clientes/ClienteForm'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

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
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/clientes/${cliente.id}`}
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Editar Cliente</h1>
          <p className="text-slate-500 mt-0.5">{cliente.nombre}</p>
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
