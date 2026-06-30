'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, X } from 'lucide-react'

/**
 * Banner de éxito leído desde `?msg=` por un server component tras un redirect.
 *
 * CRITERIO (#H43): usar SuccessBanner SOLO cuando el feedback llega por un
 * redirect server-side y no hay un cliente activo para mostrar un toast.
 * Para acciones del lado cliente (POST/PUT/DELETE con handler) usar
 * `useToast().exito(...)` antes de navegar — el ToastProvider vive en el layout
 * raíz, así que el toast sobrevive la navegación cliente.
 *
 * Migración pendiente de `?msg=creado/actualizado` → toast en los forms:
 * clientes, proyectos, recursos, tareas, empleados, melamina, nómina, apus,
 * producción, presupuestos (V1/V2). Requiere verificación en navegador.
 */
interface SuccessBannerProps {
  mensaje: string
}

export function SuccessBanner({ mensaje }: SuccessBannerProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 4000)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-800 text-sm animate-in fade-in slide-in-from-top-2 duration-300 dark:bg-green-900/20 dark:border-green-800/50 dark:text-green-400">
      <div className="flex items-center gap-2">
        <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-500 flex-shrink-0" />
        <span className="font-medium">{mensaje}</span>
      </div>
      <button
        onClick={() => setVisible(false)}
        className="text-green-600 hover:text-green-800 dark:text-green-500 dark:hover:text-green-300 ml-4"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
