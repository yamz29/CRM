'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, Users, FolderOpen, FileText, Receipt, Plus, Loader2,
  ArrowRight, CornerDownLeft, X,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface SearchResults {
  clientes: { id: number; nombre: string; rnc: string | null; telefono: string | null }[]
  proyectos: { id: number; nombre: string; codigo: string | null; estado: string; cliente: { nombre: string } | null }[]
  presupuestos: { id: number; numero: string; total: number; estado: string; cliente: { nombre: string } | null }[]
  facturas: {
    id: number; numero: string; ncf: string | null; total: number; tipo: string;
    estado: string; esProforma: boolean;
    cliente: { nombre: string } | null; proveedor: string | null;
  }[]
}

type Item =
  | { kind: 'cliente'; id: number; label: string; sub: string; href: string }
  | { kind: 'proyecto'; id: number; label: string; sub: string; href: string }
  | { kind: 'presupuesto'; id: number; label: string; sub: string; href: string }
  | { kind: 'factura'; id: number; label: string; sub: string; href: string }
  | { kind: 'action'; id: string; label: string; sub: string; href: string }

const QUICK_ACTIONS: Extract<Item, { kind: 'action' }>[] = [
  { kind: 'action', id: 'nuevo-cliente',     label: 'Nuevo cliente',     sub: 'Crear ficha de cliente',  href: '/clientes/nuevo' },
  { kind: 'action', id: 'nuevo-proyecto',    label: 'Nuevo proyecto',    sub: 'Crear proyecto desde cero', href: '/proyectos/nuevo' },
  { kind: 'action', id: 'nuevo-presupuesto', label: 'Nuevo presupuesto', sub: 'Cotización en formato V2', href: '/presupuestos/nuevo-v2' },
  { kind: 'action', id: 'nueva-factura',     label: 'Nueva factura',     sub: 'Emitir factura de cobro', href: '/contabilidad/facturas/nueva?tipo=ingreso' },
  { kind: 'action', id: 'nuevo-cronograma',  label: 'Nuevo cronograma',  sub: 'Crear cronograma de obra',  href: '/cronograma/nuevo' },
]

const KIND_ICON: Record<Item['kind'], React.ComponentType<{ className?: string }>> = {
  cliente: Users,
  proyecto: FolderOpen,
  presupuesto: FileText,
  factura: Receipt,
  action: Plus,
}

const KIND_LABEL: Record<Item['kind'], string> = {
  cliente: 'Clientes',
  proyecto: 'Proyectos',
  presupuesto: 'Presupuestos',
  factura: 'Facturas',
  action: 'Acciones rápidas',
}

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // ── Atajo global Cmd+K / Ctrl+K ────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'
      if (isCmdK) {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Foco automático al abrir + reset ────────────────────────────────
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults(null)
      setActiveIdx(0)
      // microtask para que el input ya esté montado
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  // ── Búsqueda con debounce ───────────────────────────────────────────
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, { cache: 'no-store' })
        if (res.ok) setResults(await res.json())
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => clearTimeout(handle)
  }, [query])

  // ── Aplanar resultados a una lista navegable ────────────────────────
  const items: Item[] = useMemo(() => {
    if (!query.trim()) return QUICK_ACTIONS

    if (!results) return []

    const out: Item[] = []
    for (const c of results.clientes) {
      out.push({
        kind: 'cliente', id: c.id,
        label: c.nombre,
        sub: [c.rnc && `RNC ${c.rnc}`, c.telefono].filter(Boolean).join(' · ') || 'Cliente',
        href: `/clientes/${c.id}`,
      })
    }
    for (const p of results.proyectos) {
      out.push({
        kind: 'proyecto', id: p.id,
        label: `${p.codigo ? p.codigo + ' · ' : ''}${p.nombre}`,
        sub: [p.cliente?.nombre, p.estado].filter(Boolean).join(' · '),
        href: `/proyectos/${p.id}`,
      })
    }
    for (const pr of results.presupuestos) {
      out.push({
        kind: 'presupuesto', id: pr.id,
        label: pr.numero,
        sub: [pr.cliente?.nombre, pr.estado, formatCurrency(pr.total)].filter(Boolean).join(' · '),
        href: `/presupuestos/${pr.id}`,
      })
    }
    for (const f of results.facturas) {
      const contraparte = f.tipo === 'ingreso' ? f.cliente?.nombre : f.proveedor
      out.push({
        kind: 'factura', id: f.id,
        label: `${f.numero}${f.esProforma ? ' (proforma)' : ''}`,
        sub: [contraparte, f.estado, formatCurrency(f.total)].filter(Boolean).join(' · '),
        href: `/contabilidad/facturas/${f.id}`,
      })
    }
    return out
  }, [query, results])

  // Reset índice activo cuando cambia la lista
  useEffect(() => { setActiveIdx(0) }, [items])

  // ── Keyboard navigation dentro del modal ────────────────────────────
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false) }
      else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx(i => Math.min(i + 1, items.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx(i => Math.max(0, i - 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const item = items[activeIdx]
        if (item) navegar(item)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, items, activeIdx])

  // Scroll del item activo a vista
  useEffect(() => {
    if (!listRef.current) return
    const active = listRef.current.querySelector('[data-active="true"]') as HTMLElement | null
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  const navegar = useCallback((item: Item) => {
    setOpen(false)
    router.push(item.href)
  }, [router])

  if (!open) return null

  // Agrupar items por kind para mostrar headers
  const grouped: Record<Item['kind'], Item[]> = {
    cliente: [], proyecto: [], presupuesto: [], factura: [], action: [],
  }
  for (const it of items) grouped[it.kind].push(it)
  const groupOrder: Item['kind'][] = query.trim()
    ? ['cliente', 'proyecto', 'presupuesto', 'factura']
    : ['action']

  let runningIdx = 0

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4 bg-black/50 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar clientes, proyectos, presupuestos, facturas…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          <button onClick={() => setOpen(false)} className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/40">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Resultados */}
        <div ref={listRef} className="flex-1 overflow-y-auto">
          {items.length === 0 && query.trim().length >= 2 && !loading && (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              Sin resultados para &ldquo;{query}&rdquo;.
            </div>
          )}
          {items.length === 0 && query.trim().length > 0 && query.trim().length < 2 && (
            <div className="px-4 py-12 text-center text-xs text-muted-foreground">
              Escribe al menos 2 caracteres para buscar.
            </div>
          )}

          {groupOrder.map(kind => {
            const list = grouped[kind]
            if (list.length === 0) return null
            return (
              <div key={kind} className="py-1">
                <div className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {KIND_LABEL[kind]}
                </div>
                {list.map(item => {
                  const idx = runningIdx++
                  const Icon = KIND_ICON[item.kind]
                  const active = idx === activeIdx
                  return (
                    <button
                      key={`${item.kind}-${item.id}`}
                      type="button"
                      data-active={active}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => navegar(item)}
                      className={`w-full text-left flex items-center gap-3 px-4 py-2 transition-colors ${
                        active ? 'bg-primary/10' : 'hover:bg-muted/40'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{item.label}</p>
                        {item.sub && <p className="text-xs text-muted-foreground truncate">{item.sub}</p>}
                      </div>
                      {active && <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0" />}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Footer con tips */}
        <div className="px-4 py-2 border-t border-border bg-muted/20 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border border-border bg-background font-mono text-[10px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded border border-border bg-background font-mono text-[10px]">↓</kbd>
              navegar
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border border-border bg-background font-mono text-[10px] flex items-center gap-0.5">
                <CornerDownLeft className="w-3 h-3" />
              </kbd>
              abrir
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border border-border bg-background font-mono text-[10px]">Esc</kbd>
              cerrar
            </span>
          </div>
          <span className="hidden sm:inline">
            <kbd className="px-1.5 py-0.5 rounded border border-border bg-background font-mono text-[10px]">⌘</kbd>
            +
            <kbd className="px-1.5 py-0.5 rounded border border-border bg-background font-mono text-[10px]">K</kbd>
          </span>
        </div>
      </div>
    </div>
  )
}
