import { prisma } from '@/lib/prisma'
import { BackButton } from '@/components/ui/back-button'
import { Package2 } from 'lucide-react'
import { MaterialesManager } from './MaterialesManager'

export default async function MaterialesMelaminaPage() {
  const materiales = await prisma.materialMelamina.findMany({
    where: { activo: true },
    orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
  })

  const counts = {
    tablero: materiales.filter((m) => m.tipo === 'tablero').length,
    canto: materiales.filter((m) => m.tipo === 'canto').length,
    herraje: materiales.filter((m) => m.tipo === 'herraje').length,
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-4">
        <BackButton fallbackHref="/melamina" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Materiales de Melamina</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Catálogo de tableros, cantos y herrajes para módulos
          </p>
        </div>
        <div className="flex gap-3 text-sm text-muted-foreground">
          <span className="bg-muted px-3 py-1 rounded-full">
            {counts.tablero} tablero{counts.tablero !== 1 ? 's' : ''}
          </span>
          <span className="bg-muted px-3 py-1 rounded-full">
            {counts.canto} canto{counts.canto !== 1 ? 's' : ''}
          </span>
          <span className="bg-muted px-3 py-1 rounded-full">
            {counts.herraje} herraje{counts.herraje !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {materiales.length === 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/15 border border-blue-200 dark:border-blue-800 rounded-xl p-5 flex items-start gap-3">
          <Package2 className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Catálogo vacío</p>
            <p className="text-sm text-blue-700 mt-0.5">
              Agrega tableros con sus dimensiones exactas para que los módulos puedan calcular el consumo de material automáticamente.
            </p>
          </div>
        </div>
      )}

      <MaterialesManager initialMateriales={materiales} />
    </div>
  )
}
