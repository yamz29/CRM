'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, Circle, ArrowRight, ImageOff, Lightbulb, Sparkles } from 'lucide-react'
import type { Guia, Paso } from './guias'

type Rol = 'vendedor' | 'supervisor' | 'contable'

const ROLES: { value: Rol; label: string; emoji: string }[] = [
  { value: 'vendedor',   label: 'Vendedor',           emoji: '💼' },
  { value: 'supervisor', label: 'Supervisor de obra', emoji: '🦺' },
  { value: 'contable',   label: 'Contable',           emoji: '🧮' },
]

interface Props {
  rolActivo: Rol
  guias: Guia[]
}

export function PrimerosPasosClient({ rolActivo, guias }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const guia = guias.find(g => g.rol === rolActivo) ?? guias[0]

  // Estado del checklist (qué items están "hechos" en la DB)
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/onboarding/progreso', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.checklist) setChecklist(data.checklist)
      })
      .finally(() => setLoading(false))
  }, [])

  function cambiarRol(nuevo: Rol) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('rol', nuevo)
    router.push(`?${params.toString()}`)
  }

  // % de progreso de este rol específico
  const completados = guia.pasos.filter(p => checklist[p.slug]).length
  const total = guia.pasos.length
  const pctRol = total > 0 ? Math.round((completados / total) * 100) : 0

  return (
    <>
      {/* Tabs de rol */}
      <div className="flex items-center gap-2 flex-wrap">
        {ROLES.map(r => (
          <button
            key={r.value}
            onClick={() => cambiarRol(r.value)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              rolActivo === r.value
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-card border border-border text-foreground hover:bg-muted/40'
            }`}
          >
            <span>{r.emoji}</span>
            <span>{r.label}</span>
          </button>
        ))}
      </div>

      {/* Layout: contenido + checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Contenido principal */}
        <div className="space-y-6 min-w-0">
          <div>
            <h2 className="text-xl font-bold text-foreground">{guia.titulo}</h2>
            <p className="text-muted-foreground text-sm mt-1">{guia.intro}</p>
          </div>

          {guia.pasos.map((paso, idx) => (
            <PasoCard
              key={paso.slug}
              paso={paso}
              numero={idx + 1}
              completado={!!checklist[paso.slug]}
            />
          ))}
        </div>

        {/* Checklist lateral (sticky en desktop) */}
        <aside className="lg:sticky lg:top-4 lg:self-start space-y-4">
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Tu progreso</h3>
              <span className="text-xs font-bold text-foreground tabular-nums">
                {completados}/{total}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  pctRol === 100 ? 'bg-green-500' : pctRol >= 50 ? 'bg-blue-500' : 'bg-amber-400'
                }`}
                style={{ width: `${pctRol}%` }}
              />
            </div>

            <ul className="space-y-1.5 pt-2">
              {guia.pasos.map(p => {
                const done = !!checklist[p.slug]
                return (
                  <li key={p.slug} className="flex items-start gap-2 text-xs">
                    {done
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                      : <Circle className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />}
                    <span className={done ? 'text-foreground line-through opacity-70' : 'text-foreground'}>
                      {p.titulo.replace(/^\d+\.\s*/, '')}
                    </span>
                  </li>
                )
              })}
            </ul>

            {loading && (
              <p className="text-2xs text-muted-foreground italic">Cargando progreso…</p>
            )}
            {pctRol === 100 && !loading && (
              <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-2">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>¡Todo listo! Has cubierto el flujo completo.</span>
              </div>
            )}
          </div>

          <div className="bg-muted/40 border border-border rounded-xl p-3 text-xs text-muted-foreground">
            <p>
              El progreso es del sistema, no solo tuyo. Si alguien del equipo ya creó al menos un
              registro de cada tipo, los pasos aparecen completados.
            </p>
          </div>
        </aside>
      </div>
    </>
  )
}

// ── Tarjeta de un paso individual ──────────────────────────────────────────

function PasoCard({ paso, numero, completado }: {
  paso: Paso
  numero: number
  completado: boolean
}) {
  return (
    <div className={`bg-card border rounded-xl overflow-hidden transition-colors ${
      completado ? 'border-green-300 dark:border-green-800/60' : 'border-border'
    }`}>
      <div className="px-5 py-4 space-y-3">
        {/* Header con número + título + estado */}
        <div className="flex items-start gap-3">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 font-bold text-sm ${
            completado
              ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
              : 'bg-muted text-muted-foreground'
          }`}>
            {completado ? <CheckCircle2 className="w-4 h-4" /> : numero}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">{paso.titulo.replace(/^\d+\.\s*/, '')}</h3>
          </div>
        </div>

        {/* Descripción */}
        <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line ml-11">
          {paso.descripcion}
        </div>

        {/* Imagen (con fallback si no existe) */}
        {paso.imagen && (
          <div className="ml-11">
            <ImagenConFallback src={`/help/onboarding/${paso.imagen}`} alt={paso.titulo} />
          </div>
        )}

        {/* Tips */}
        {paso.tips && paso.tips.length > 0 && (
          <div className="ml-11 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-1.5">
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5" /> Tips
            </p>
            <ul className="space-y-1 text-xs text-amber-800 dark:text-amber-200">
              {paso.tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-amber-500 mt-0.5">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA */}
        <div className="ml-11">
          <Link
            href={paso.ctaHref}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            {paso.ctaLabel}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Imagen con fallback (si el archivo no está, muestra placeholder) ──────

function ImagenConFallback({ src, alt }: { src: string; alt: string }) {
  const [error, setError] = useState(false)

  if (error) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 border border-dashed border-border rounded-lg p-3">
        <ImageOff className="w-4 h-4 shrink-0" />
        <span>
          Captura pendiente: <code className="bg-muted px-1 py-0.5 rounded text-2xs">{src}</code>
        </span>
      </div>
    )
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={alt}
      onError={() => setError(true)}
      className="rounded-lg border border-border max-w-full h-auto shadow-sm"
    />
  )
}
