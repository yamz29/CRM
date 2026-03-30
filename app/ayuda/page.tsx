import Link from 'next/link'
import {
  BookOpen, FolderOpen, Calculator, Layers,
  Grid2x2, ChefHat, Clock, Receipt, Search,
} from 'lucide-react'
import articulos from '@/content/help/index.json'

const ICON_MAP: Record<string, React.ReactNode> = {
  FolderOpen: <FolderOpen className="w-5 h-5" />,
  Calculator: <Calculator className="w-5 h-5" />,
  Layers:     <Layers className="w-5 h-5" />,
  Grid2x2:    <Grid2x2 className="w-5 h-5" />,
  ChefHat:    <ChefHat className="w-5 h-5" />,
  Clock:      <Clock className="w-5 h-5" />,
  Receipt:    <Receipt className="w-5 h-5" />,
}

export default function AyudaPage() {
  return (
    <div className="max-w-4xl mx-auto py-10 px-6">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-50 rounded-xl">
            <BookOpen className="w-6 h-6 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Centro de Ayuda</h1>
        </div>
        <p className="text-slate-500 ml-14">
          Guías y documentación para cada módulo del sistema Gonzalva ERP.
        </p>
      </div>

      {/* Search hint */}
      <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-8">
        <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <span className="text-slate-500 text-sm">
          Usa <kbd className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs font-mono">Ctrl+F</kbd> para buscar dentro de un artículo, o navega por los módulos abajo.
        </span>
      </div>

      {/* Module cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {articulos.map((a) => (
          <Link
            key={a.slug}
            href={`/ayuda/${a.slug}`}
            className="group flex flex-col gap-3 p-5 bg-white border border-slate-200 rounded-xl hover:border-blue-400 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600 group-hover:bg-blue-100 transition-colors">
                {ICON_MAP[a.icono] ?? <BookOpen className="w-5 h-5" />}
              </div>
              <h2 className="font-semibold text-slate-800 text-sm leading-tight">{a.titulo}</h2>
            </div>
            <p className="text-slate-500 text-xs leading-relaxed">{a.descripcion}</p>
            <div className="flex flex-wrap gap-1 mt-auto">
              {a.tags.slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs"
                >
                  {t}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>

      {/* Footer note */}
      <p className="text-center text-slate-400 text-xs mt-10">
        Gonzalva ERP · Versión 1.3 · ¿No encuentras lo que buscas? Contacta a soporte.
      </p>
    </div>
  )
}
