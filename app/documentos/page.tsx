import { prisma } from '@/lib/prisma'
import { DocumentosPageClient } from '@/components/documentos/DocumentosPageClient'

export default async function DocumentosPage() {
  const [proyectos, oportunidades] = await Promise.all([
    prisma.proyecto.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.oportunidad.findMany({
      where: { archivada: false },
      select: { id: true, nombre: true, etapa: true },
      orderBy: { nombre: 'asc' },
    }),
  ])

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <DocumentosPageClient proyectos={proyectos} oportunidades={oportunidades} />
    </div>
  )
}
