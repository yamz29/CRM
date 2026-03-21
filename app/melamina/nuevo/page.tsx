import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ModuloMelaminaForm } from '@/components/melamina/ModuloMelaminaForm'

export default async function NuevoModuloPage() {
  const proyectos = await prisma.proyecto.findMany({
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  })

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
          <h1 className="text-2xl font-bold text-slate-800">Nuevo Módulo Melamina</h1>
          <p className="text-slate-500 text-sm mt-0.5">Registra un nuevo módulo de melamina o ebanistería</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información del Módulo</CardTitle>
        </CardHeader>
        <CardContent>
          <ModuloMelaminaForm proyectos={proyectos} mode="create" />
        </CardContent>
      </Card>
    </div>
  )
}
