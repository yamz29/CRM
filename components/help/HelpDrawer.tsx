'use client'

import { useState, useEffect } from 'react'
import { HelpCircle, X, ExternalLink, BookOpen, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { marked } from 'marked'
import { cn } from '@/lib/utils'

interface Props {
  slug: string
  titulo?: string
}

export function HelpDrawer({ slug, titulo }: Props) {
  const [open, setOpen] = useState(false)
  const [html, setHtml] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!open || !slug) return
    setLoading(true)
    setError(false)
    fetch(`/api/help/${slug}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.content) {
          setHtml(marked(d.content) as string)
        } else {
          setError(true)
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [open, slug])

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors text-xs font-medium"
        title="Ayuda"
        aria-label="Abrir ayuda"
      >
        <HelpCircle className="w-4 h-4" />
        <span className="hidden sm:inline">Ayuda</span>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          'fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0 bg-slate-50">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <h2 className="font-semibold text-slate-800 text-sm">
              {titulo ?? 'Ayuda'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/ayuda/${slug}`}
              target="_blank"
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
              title="Ver artículo completo"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Ver completo
            </Link>
            <button
              onClick={() => setOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading && (
            <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Cargando...</span>
            </div>
          )}
          {error && !loading && (
            <div className="text-center py-16">
              <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Artículo no disponible.</p>
              <Link href="/ayuda" className="text-blue-600 text-sm underline mt-2 inline-block">
                Ver todos los artículos
              </Link>
            </div>
          )}
          {!loading && !error && html && (
            <div
              className="prose prose-sm prose-slate max-w-none
                prose-headings:font-semibold prose-headings:text-slate-800
                prose-h1:text-lg prose-h2:text-base prose-h2:mt-6 prose-h2:mb-2
                prose-p:text-slate-600 prose-p:leading-relaxed
                prose-li:text-slate-600
                prose-strong:text-slate-800
                prose-code:bg-slate-100 prose-code:px-1 prose-code:rounded prose-code:text-xs prose-code:text-slate-700 prose-code:font-mono
                prose-table:text-xs prose-th:bg-slate-100 prose-th:font-semibold
                prose-blockquote:border-blue-400 prose-blockquote:text-slate-500
                prose-hr:border-slate-200
                [&_table]:w-full [&_th]:px-3 [&_th]:py-2 [&_th]:text-left
                [&_td]:px-3 [&_td]:py-1.5 [&_td]:border-t [&_td]:border-slate-100"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between flex-shrink-0 bg-slate-50">
          <span className="text-xs text-slate-400">Gonzalva ERP · Ayuda</span>
          <Link
            href="/ayuda"
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            Ver todos los módulos →
          </Link>
        </div>
      </div>
    </>
  )
}
