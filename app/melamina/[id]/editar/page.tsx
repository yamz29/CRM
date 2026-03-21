import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ModuloMelaminaForm } from '@/components/melamina/ModuloMelaminaForm'

export default async function EditarModuloPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) notFound()

  const [modulo, proyectos] = await Promise.all([
    prisma.moduloMelaminaV2.findUnique({ where: { id } }),
    prisma.proyecto.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
  ])

  if (!modulo) notFound()

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link
          href="/melamina"
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Editar Módulo</h1>
          <p className="text-slate-500 text-sm mt-0.5">{modulo.nombre}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información del Módulo</CardTitle>
        </CardHeader>
        <CardContent>
          <ModuloMelaminaForm
            proyectos={proyectos}
            mode="edit"
            initialData={{
              id: modulo.id,
              proyectoId: modulo.proyectoId,
              codigo: modulo.codigo,
              tipoModulo: modulo.tipoModulo,
              nombre: modulo.nombre,
              ancho: modulo.ancho,
              alto: modulo.alto,
              profundidad: modulo.profundidad,
              material: modulo.material,
              colorAcabado: modulo.colorAcabado,
              herrajes: modulo.herrajes,
              cantidad: modulo.cantidad,
              costoMateriales: modulo.costoMateriales,
              costoManoObra: modulo.costoManoObra,
              costoInstalacion: modulo.costoInstalacion,
              precioVenta: modulo.precioVenta,
              estadoProduccion: modulo.estadoProduccion,
              observaciones: modulo.observaciones,
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
