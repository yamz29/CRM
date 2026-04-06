import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ModuloMelaminaForm } from '@/components/melamina/ModuloMelaminaForm'

export default async function NuevoModuloPage() {
  const [tableros, tiposConfig] = await Promise.all([
    prisma.materialMelamina.findMany({
      where: { activo: true, tipo: 'tablero' },
      select: { id: true, nombre: true, codigo: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.configuracion.findUnique({ where: { clave: 'tipos_modulo_melamina' } }),
  ])

  const tiposBase: string[] = tiposConfig
    ? JSON.parse(tiposConfig.valor)
    : ['Base con puertas', 'Base con cajones', 'Base mixto', 'Aéreo con puertas', 'Repisa', 'Columna', 'Closet', 'Baño', 'Oficina', 'Electrodoméstico', 'Otro']
  const tiposModulo = tiposBase.includes('Repisa') ? tiposBase : [...tiposBase, 'Repisa']

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link
          href="/melamina"
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nuevo Módulo Melamina</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Registra un nuevo módulo de melamina o ebanistería</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información del Módulo</CardTitle>
        </CardHeader>
        <CardContent>
          <ModuloMelaminaForm tableros={tableros} tiposModulo={tiposModulo} mode="create" />
        </CardContent>
      </Card>
    </div>
  )
}
