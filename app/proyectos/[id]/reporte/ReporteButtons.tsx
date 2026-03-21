'use client'

export function ReporteButtons() {
  return (
    <div className="no-print fixed top-4 right-4 flex gap-2 z-50 print:hidden">
      <button
        onClick={() => window.print()}
        className="bg-slate-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg hover:bg-slate-700 transition-colors font-medium"
      >
        🖨 Imprimir / Guardar PDF
      </button>
      <button
        onClick={() => window.history.back()}
        className="bg-white border border-slate-200 text-slate-700 text-sm px-4 py-2 rounded-lg shadow-lg hover:bg-slate-50 transition-colors"
      >
        ← Volver
      </button>
    </div>
  )
}
