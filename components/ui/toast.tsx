'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'

type ToastTipo = 'exito' | 'error'

interface Toast {
  id: number
  tipo: ToastTipo
  mensaje: string
}

interface ToastContextValue {
  exito: (mensaje: string) => void
  error: (mensaje: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}

let nextId = 1

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((tipo: ToastTipo, mensaje: string) => {
    const id = nextId++
    setToasts(prev => [...prev, { id, tipo, mensaje }])
    // Los errores duran más para que dé tiempo a leerlos
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, tipo === 'error' ? 6000 : 3500)
  }, [])

  const exito = useCallback((m: string) => push('exito', m), [push])
  const error = useCallback((m: string) => push('error', m), [push])

  const cerrar = (id: number) => setToasts(prev => prev.filter(t => t.id !== id))

  // Identidad estable: que los consumidores de useToast no re-rendericen con cada toast
  const value = useMemo(() => ({ exito, error }), [exito, error])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Contenedor de toasts — esquina superior derecha, sobre todo el shell */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[min(380px,calc(100vw-2rem))]">
        {toasts.map(t => (
          <div
            key={t.id}
            role="status"
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg text-sm animate-in slide-in-from-top-2 ${
              t.tipo === 'exito'
                ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-800 text-green-800 dark:text-green-200'
                : 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-800 text-red-800 dark:text-red-200'
            }`}
          >
            {t.tipo === 'exito'
              ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            <p className="flex-1">{t.mensaje}</p>
            <button onClick={() => cerrar(t.id)} className="opacity-60 hover:opacity-100 shrink-0" aria-label="Cerrar">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
