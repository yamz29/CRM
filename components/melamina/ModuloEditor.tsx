'use client'

import { useState, useCallback, useMemo } from 'react'
import { BackButton } from '@/components/ui/back-button'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Save, Wand2, Plus, Trash2, Package, Layers, BarChart3, Settings2, Printer, Grid3x3, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { formatCurrency } from '@/lib/utils'

import {
  type PiezaLine, type MaterialModuloLine, type MaterialRef, type ModuloData,
  TIPOS_MODULO_DEFAULT, ESTADOS_PRODUCCION, ETIQUETAS_PIEZA, TAPACANTO_LADOS,
  TAPACANTO_COLORS_FALLBACK, newKey,
  calcAreaM2, calcTapacantoMl, calcTapacantoByColor,
  extractTapacantoColor, packTapacantoColor,
  runNesting, generarDespiece,
} from './modulo-despiece'
import { ModuloNestingTab } from './ModuloNestingTab'
import { ModuloResumenTab } from './ModuloResumenTab'

interface Props {
  modulo: ModuloData
  materialesDisponibles: MaterialRef[]
  tiposModulo?: string[]
}

// ── Componente principal ──────────────────────────────────────────────────────

export function ModuloEditor({ modulo, materialesDisponibles, tiposModulo = TIPOS_MODULO_DEFAULT }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'datos' | 'despiece' | 'materiales' | 'resumen' | 'nesting'>('despiece')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [confirmDuplicar, setConfirmDuplicar] = useState(false)

  // Datos generales (proyectoId kept silently for DB)
  const proyectoId = String(modulo.proyectoId || '')
  const [codigo, setCodigo] = useState(modulo.codigo || '')
  const [tipoModulo, setTipoModulo] = useState(modulo.tipoModulo)
  const [nombre, setNombre] = useState(modulo.nombre)
  const [ancho, setAncho] = useState(String(modulo.ancho || ''))
  const [alto, setAlto] = useState(String(modulo.alto || ''))
  const [prof, setProf] = useState(String(modulo.profundidad || ''))
  const [cantPuertas, setCantPuertas] = useState(() => {
    if (modulo.cantidadPuertas > 0) return String(modulo.cantidadPuertas)
    if (modulo.tipoModulo === 'Base con puertas' || modulo.tipoModulo === 'Aéreo con puertas') return '2'
    if (modulo.tipoModulo === 'Base mixto') return '1'
    return '0'
  })
  const [cantCajones, setCantCajones] = useState(() => {
    if (modulo.cantidadCajones > 0) return String(modulo.cantidadCajones)
    if (modulo.tipoModulo === 'Base con cajones') return '3'
    if (modulo.tipoModulo === 'Base mixto') return '2'
    return '0'
  })
  const [colorAcabado, setColorAcabado] = useState(modulo.colorAcabado || '')
  const [cantidad, setCantidad] = useState(String(modulo.cantidad || 1))
  const [precioVenta, setPrecioVenta] = useState(String(modulo.precioVenta || ''))
  const [estadoProduccion, setEstadoProduccion] = useState(modulo.estadoProduccion)
  const [observaciones, setObservaciones] = useState(modulo.observaciones || '')
  const [materialTableroId, setMaterialTableroId] = useState(String(modulo.materialTableroId || ''))

  // Nesting settings
  const [nestKerf, setNestKerf] = useState(3.3)
  const [nestRotation, setNestRotation] = useState(true)

  // Despiece
  const [piezas, setPiezas] = useState<PiezaLine[]>(
    modulo.piezas.map((p) => {
      const arr = Array.isArray(p.tapacanto) ? p.tapacanto : []
      const { lados, color } = extractTapacantoColor(arr)
      return { ...p, _key: newKey(), tapacanto: lados, tapacantoColor: color, llevaMecanizado: p.llevaMecanizado ?? false, tipoMecanizado: p.tipoMecanizado || '' }
    })
  )

  // Materiales (cantos + herrajes del módulo)
  const [materialesModulo, setMaterialesModulo] = useState<MaterialModuloLine[]>(
    modulo.materialesModulo.map((r) => {
      const mat = materialesDisponibles.find((x) => x.id === r.materialId)
      const searchLabel = mat ? `${mat.codigo ? `[${mat.codigo}] ` : ''}${mat.nombre}` : ''
      return { ...r, _key: newKey(), materialId: r.materialId ?? null, search: searchLabel }
    })
  )

  // ── Filtros derivados ────────────────────────────────────────────────────
  const tableros = materialesDisponibles.filter((m) => m.tipo === 'tablero')
  const cantos = materialesDisponibles.filter((m) => m.tipo === 'canto')
  const cantosYHerrajes = materialesDisponibles.filter((m) => m.tipo === 'canto' || m.tipo === 'herraje')

  const materialTablero = tableros.find((m) => m.id === parseInt(materialTableroId))

  // ── Cálculos globales ────────────────────────────────────────────────────
  const totalAreaM2 = piezas.reduce((acc, p) => acc + calcAreaM2(p), 0)
  const totalTapacantoMl = piezas.reduce((acc, p) => acc + calcTapacantoMl(p), 0)
  // ML de tapacanto agrupado por nombre de canto (key = tapacantoColor del despiece)
  const tapacantoByColor = useMemo(() => calcTapacantoByColor(piezas), [piezas])

  // ── Consumo agrupado por tablero ─────────────────────────────────────────
  const tableroGroups = useMemo(() => {
    const groups: Record<string, { mat: MaterialRef | null; areaM2: number; tapacantoMl: number }> = {}
    piezas.forEach((p) => {
      const key = p.material || materialTablero?.nombre || 'Sin tablero'
      if (!groups[key]) {
        const mat = tableros.find((t) => t.nombre === key) ?? materialTablero
        groups[key] = { mat: mat ?? null, areaM2: 0, tapacantoMl: 0 }
      }
      groups[key].areaM2 += calcAreaM2(p)
      groups[key].tapacantoMl += calcTapacantoMl(p)
    })
    return Object.entries(groups).map(([nombre, g]) => {
      const boardW = g.mat?.largoMm ?? 2800
      const boardH = g.mat?.anchoMm ?? 2080
      const boardAreaM2 = (boardW * boardH) / 1_000_000
      const planchas = g.areaM2 > 0 ? Math.ceil((g.areaM2 * 1.15) / boardAreaM2) : 0
      return {
        nombre,
        mat: g.mat,
        areaM2: g.areaM2,
        tapacantoMl: g.tapacantoMl,
        boardW, boardH,
        boardAreaM2,
        planchas,
        pctUso: planchas > 0 ? (g.areaM2 / (planchas * boardAreaM2)) * 100 : 0,
      }
    })
  }, [piezas, materialTablero, tableros])

  // Total planchas del tablero principal (para barra inferior y costos)
  const areaPlanchaM2 = materialTablero
    ? ((materialTablero.anchoMm ?? 2080) * (materialTablero.largoMm ?? 2800)) / 1_000_000
    : (2080 * 2800) / 1_000_000
  const numPlanchas = totalAreaM2 > 0 ? Math.ceil((totalAreaM2 * 1.15) / areaPlanchaM2) : 0

  // ── Nesting ──────────────────────────────────────────────────────────────
  const nestingGroups = useMemo(
    () => (tab === 'nesting' && piezas.length > 0
      ? runNesting(piezas, materialTablero ?? null, tableros, nestKerf, nestRotation)
      : []),
     
    [tab, piezas, materialTablero, tableros, nestKerf, nestRotation],
  )

  // ── Cálculos de costo ────────────────────────────────────────────────────
  // Suma proporcional de TODOS los tableros usados en el módulo
  const costoTablero = tableroGroups.reduce((acc, g) =>
    acc + (g.boardAreaM2 > 0 ? (g.areaM2 / g.boardAreaM2) * (g.mat?.precio || 0) : 0), 0)
  const totalMateriales = materialesModulo.reduce((acc, r) => acc + r.subtotal, 0)
  const costoTotal = costoTablero + totalMateriales
  const pv = parseFloat(precioVenta) || 0
  const margen = pv > 0 ? ((pv - costoTotal) / pv) * 100 : 0

  // ── Handlers piezas ──────────────────────────────────────────────────────

  const addPieza = () => {
    setPiezas((prev) => [
      ...prev,
      {
        _key: newKey(), etiqueta: 'Lat', nombre: 'Lateral', tipoPieza: 'lateral',
        largo: 0, ancho: 0, cantidad: 1, espesor: materialTablero?.espesorMm ?? 18,
        material: '', tapacanto: [], tapacantoColor: '', llevaMecanizado: false, tipoMecanizado: '', observaciones: '',
      },
    ])
  }

  const removePieza = (key: string) => setPiezas((prev) => prev.filter((p) => p._key !== key))

  const updatePieza = useCallback((key: string, field: keyof PiezaLine, value: unknown) => {
    setPiezas((prev) => prev.map((p) => {
      if (p._key !== key) return p
      if (field === 'etiqueta') {
        const autoNombre: Record<string, string> = {
          Lat: 'Lateral', Piso: 'Piso', Fondo: 'Fondo', Sop: 'Soporte',
          Techo: 'Techo', Div: 'División', Repi: 'Repisa', Puerta: 'Puerta',
          'F-Caj': 'Frente de Cajón', 'T-Caj': 'Trasero de Cajón',
          'Fd-Caj': 'Fondo de Cajón', Otro: '',
        }
        return { ...p, etiqueta: value as string, nombre: autoNombre[value as string] ?? '' }
      }
      return { ...p, [field]: value }
    }))
  }, [])

  const toggleTapacanto = (key: string, lado: string) => {
    setPiezas((prev) => prev.map((p) => {
      if (p._key !== key) return p
      const has = p.tapacanto.includes(lado)
      return { ...p, tapacanto: has ? p.tapacanto.filter((l) => l !== lado) : [...p.tapacanto, lado] }
    }))
  }

  const handleGenerar = () => {
    const a = parseFloat(ancho) || 0
    const h = parseFloat(alto) || 0
    const p = parseFloat(prof) || 0
    const cp = parseInt(cantPuertas) || 0
    const cc = parseInt(cantCajones) || 0
    if (a <= 0 || h <= 0 || p <= 0) {
      setError('Ingresa ancho, alto y profundidad antes de generar el despiece.')
      return
    }
    const esp = materialTablero?.espesorMm ?? 18
    setPiezas(generarDespiece(tipoModulo, a, h, p, cp, cc, esp))
    setTab('despiece')
    setError(null)
  }

  // ── Handlers materiales del módulo ───────────────────────────────────────

  const addMaterial = () => {
    setMaterialesModulo((prev) => [
      ...prev,
      { _key: newKey(), materialId: null, tipo: 'herraje', unidad: 'ud', cantidad: 1, costoSnapshot: 0, subtotal: 0, observaciones: '', search: '' },
    ])
  }

  const removeMaterial = (key: string) => setMaterialesModulo((prev) => prev.filter((r) => r._key !== key))

  const updateMaterial = (key: string, field: keyof MaterialModuloLine, value: unknown) => {
    setMaterialesModulo((prev) => prev.map((r) => {
      if (r._key !== key) return r
      const updated = { ...r, [field]: value }
      if (field === 'materialId') {
        const mat = materialesDisponibles.find((x) => x.id === Number(value))
        if (mat) {
          updated.tipo = mat.tipo
          updated.unidad = mat.unidad
          updated.costoSnapshot = mat.precio
          updated.subtotal = r.cantidad * mat.precio
        }
      }
      if (field === 'cantidad' || field === 'costoSnapshot') {
        const cant = field === 'cantidad' ? Number(value) : updated.cantidad
        const costo = field === 'costoSnapshot' ? Number(value) : updated.costoSnapshot
        updated.subtotal = cant * costo
      }
      return updated
    }))
  }

  // ── Guardar ──────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!nombre.trim()) { setError('El nombre es requerido'); return }
    setLoading(true); setError(null); setSaved(false)

    try {
      const payload = {
        proyectoId: proyectoId ? parseInt(proyectoId) : null,
        codigo: codigo || null,
        tipoModulo,
        nombre: nombre.trim(),
        ancho: parseFloat(ancho) || 0,
        alto: parseFloat(alto) || 0,
        profundidad: parseFloat(prof) || 0,
        cantidadPuertas: parseInt(cantPuertas) || 0,
        cantidadCajones: parseInt(cantCajones) || 0,
        material: materialTablero?.nombre || '',
        colorAcabado: colorAcabado || null,
        cantidad: parseInt(cantidad) || 1,
        costoMateriales: costoTablero,
        costoManoObra: 0,
        costoInstalacion: 0,
        precioVenta: parseFloat(precioVenta) || 0,
        estadoProduccion,
        observaciones: observaciones || null,
        materialTableroId: materialTableroId ? parseInt(materialTableroId) : null,
        anchoPlanchaCm: materialTablero?.anchoMm ?? 2440,
        largoPlanchaCm: materialTablero?.largoMm ?? 1830,
        piezas: piezas.map(({ _key, id: _id, tapacantoColor, tapacanto, ...p }) => ({
          ...p,
          tapacanto: packTapacantoColor(tapacanto, tapacantoColor),
          llevaMecanizado: p.llevaMecanizado,
          tipoMecanizado: p.tipoMecanizado || null,
        })),
        materialesModulo: materialesModulo.map(({ _key, id: _id, search: _s, ...r }) => r),
      }

      const res = await fetch(`/api/melamina/${modulo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Error al guardar')
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  const handleDuplicate = async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/melamina/${modulo.id}/duplicar`, { method: 'POST' })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Error al duplicar')
      }
      const { id: newId } = await res.json()
      router.push(`/melamina/${newId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(false)
      setConfirmDuplicar(false)
    }
  }

  // ── UI ───────────────────────────────────────────────────────────────────

  const inputCls = 'w-full border border-border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
  const thCls = 'px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/40'

  return (
    <div className="space-y-4 pb-32 print:pb-0">
      {/* Header (oculto al imprimir) */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <BackButton fallbackHref="/melamina" />
          <div>
            <h1 className="text-xl font-bold text-foreground">{nombre || 'Módulo sin nombre'}</h1>
            <p className="text-sm text-muted-foreground">{codigo && <span className="font-mono mr-2">{codigo}</span>}{tipoModulo}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setConfirmDuplicar(true)} disabled={loading}>
            <Copy className="w-4 h-4" />
            Duplicar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            <Save className="w-4 h-4" />
            {loading ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-800 text-sm">{error}</div>
      )}
      {saved && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-800 text-sm">Guardado correctamente.</div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border print:hidden">
        {([
          { key: 'datos', label: 'Datos', icon: <Settings2 className="w-3.5 h-3.5" /> },
          { key: 'despiece', label: 'Despiece', icon: <Layers className="w-3.5 h-3.5" /> },
          { key: 'nesting', label: 'Nesting', icon: <Grid3x3 className="w-3.5 h-3.5" /> },
          { key: 'materiales', label: 'Materiales', icon: <Package className="w-3.5 h-3.5" /> },
          { key: 'resumen', label: 'Resumen', icon: <BarChart3 className="w-3.5 h-3.5" /> },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: DATOS ──────────────────────────────────────────────────────── */}
      {tab === 'datos' && (
        <div className="bg-card rounded-xl border border-border p-5 space-y-4 print:hidden">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Código</label>
              <input className={inputCls} value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="B90-Fre" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo</label>
              <select className={inputCls + ' bg-card'} value={tipoModulo} onChange={(e) => setTipoModulo(e.target.value)}>
                {tiposModulo.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Nombre *</label>
              <input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Base 90 con puertas" />
            </div>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Ancho (mm)</label>
              <input type="number" className={inputCls} value={ancho} onChange={(e) => setAncho(e.target.value)} min="0" step="1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Alto (mm)</label>
              <input type="number" className={inputCls} value={alto} onChange={(e) => setAlto(e.target.value)} min="0" step="1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Prof. (mm)</label>
              <input type="number" className={inputCls} value={prof} onChange={(e) => setProf(e.target.value)} min="0" step="1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Puertas</label>
              <input type="number" className={inputCls} value={cantPuertas} onChange={(e) => setCantPuertas(e.target.value)} min="0" step="1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Cajones</label>
              <input type="number" className={inputCls} value={cantCajones} onChange={(e) => setCantCajones(e.target.value)} min="0" step="1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Cantidad</label>
              <input type="number" className={inputCls} value={cantidad} onChange={(e) => setCantidad(e.target.value)} min="1" step="1" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Tablero principal</label>
              <select
                className={inputCls + ' bg-card'}
                value={materialTableroId}
                onChange={(e) => setMaterialTableroId(e.target.value)}
              >
                <option value="">— Sin tablero vinculado —</option>
                {tableros.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.codigo ? `[${t.codigo}] ` : ''}{t.nombre}
                    {t.anchoMm && t.largoMm ? ` (${t.anchoMm}×${t.largoMm}${t.espesorMm ? `×${t.espesorMm}mm` : 'mm'})` : ''}
                  </option>
                ))}
              </select>
              {materialTablero ? (
                <p className="text-xs text-muted-foreground mt-1">
                  Espesor: <span className="font-semibold text-muted-foreground">{materialTablero.espesorMm ?? 18}mm</span>
                  {!materialTablero.espesorMm && <span className="text-amber-500"> (sin espesor en catálogo — usando 18mm)</span>}
                  {' · '}Área: {(((materialTablero.anchoMm ?? 0) * (materialTablero.largoMm ?? 0)) / 1_000_000).toFixed(4)} m² / plancha
                  {materialTablero.precio > 0 && ` · ${formatCurrency(materialTablero.precio)} / plancha`}
                </p>
              ) : (
                <p className="text-xs text-amber-600 mt-1">
                  Sin tablero seleccionado — el despiece usará 18mm por defecto.{' '}
                  {tableros.length === 0 && <Link href="/melamina/materiales" className="underline">Agregar tableros en Materiales</Link>}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Color/Acabado</label>
              <input className={inputCls} value={colorAcabado} onChange={(e) => setColorAcabado(e.target.value)} placeholder="Blanco Alpino" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Estado producción</label>
              <select className={inputCls + ' bg-card'} value={estadoProduccion} onChange={(e) => setEstadoProduccion(e.target.value)}>
                {ESTADOS_PRODUCCION.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Precio de venta</label>
              <input type="number" className={inputCls} value={precioVenta} onChange={(e) => setPrecioVenta(e.target.value)} min="0" step="1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Observaciones</label>
              <input className={inputCls} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Notas del módulo" />
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: DESPIECE ───────────────────────────────────────────────────── */}
      {tab === 'despiece' && (
        <div className="space-y-3 print:hidden">
          {/* Generar */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-blue-800">Generación automática de despiece</p>
              <p className="text-xs text-blue-600 mt-0.5">
                Basado en: {ancho || '?'}×{alto || '?'}×{prof || '?'} mm — {cantPuertas} puerta(s) — {cantCajones} cajón(es)
                {' — '}Espesor: <strong>{materialTablero?.espesorMm ?? 18}mm</strong>
                {!materialTablero?.espesorMm && <span className="text-amber-600"> (default — selecciona un tablero)</span>}
              </p>
            </div>
            <div className="flex gap-2">
              {piezas.length > 0 && (
                <Button variant="secondary" onClick={() => window.print()}>
                  <Printer className="w-4 h-4" /> Imprimir
                </Button>
              )}
              <Button variant="secondary" onClick={handleGenerar}>
                <Wand2 className="w-4 h-4" /> Generar despiece
              </Button>
            </div>
          </div>

          {/* Tabla de piezas */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className={thCls} style={{ width: 110 }}>Etiqueta</th>
                    <th className={thCls}>Nombre</th>
                    <th className={thCls} style={{ width: 80 }}>Largo (mm)</th>
                    <th className={thCls} style={{ width: 80 }}>Ancho (mm)</th>
                    <th className={thCls} style={{ width: 60 }}>Cant.</th>
                    <th className={thCls} style={{ width: 70 }}>Esp. (mm)</th>
                    <th className={thCls} style={{ width: 160 }}>Tablero</th>
                    <th className={thCls} style={{ width: 100 }}>Tapacanto</th>
                    <th className={thCls} style={{ width: 110 }}>Mecanizado</th>
                    <th className={thCls} style={{ width: 80 }}>Área m²</th>
                    <th className={thCls} style={{ width: 70 }}>TC ml</th>
                    <th className={thCls} style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {piezas.map((p) => {
                    const area = calcAreaM2(p)
                    const tc = calcTapacantoMl(p)
                    // check if piece fits in tablero
                    const fitsAncho = materialTablero?.anchoMm ? p.ancho <= materialTablero.anchoMm : null
                    const fitsLargo = materialTablero?.largoMm ? p.largo <= materialTablero.largoMm : null
                    const noFit = fitsAncho === false || fitsLargo === false
                    return (
                      <tr key={p._key} className={`hover:bg-muted/40/50 ${noFit ? 'bg-red-50/40' : ''}`}>
                        <td className="px-2 py-1.5">
                          <select
                            className="border border-border rounded-md px-1.5 py-1 text-xs bg-card w-full focus:outline-none focus:ring-1 focus:ring-ring"
                            value={p.etiqueta}
                            onChange={(e) => updatePieza(p._key, 'etiqueta', e.target.value)}
                          >
                            {ETIQUETAS_PIEZA.map((et) => (
                              <option key={et.value} value={et.value}>{et.value}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            className="border border-border rounded-md px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-ring"
                            value={p.nombre}
                            onChange={(e) => updatePieza(p._key, 'nombre', e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number" min="0" step="0.1"
                            className={`border rounded-md px-2 py-1 text-xs w-full text-right focus:outline-none focus:ring-1 focus:ring-ring ${fitsLargo === false ? 'border-red-400 bg-red-50' : 'border-border'}`}
                            value={p.largo}
                            onChange={(e) => updatePieza(p._key, 'largo', parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number" min="0" step="0.1"
                            className={`border rounded-md px-2 py-1 text-xs w-full text-right focus:outline-none focus:ring-1 focus:ring-ring ${fitsAncho === false ? 'border-red-400 bg-red-50' : 'border-border'}`}
                            value={p.ancho}
                            onChange={(e) => updatePieza(p._key, 'ancho', parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number" min="1" step="1"
                            className="border border-border rounded-md px-2 py-1 text-xs w-full text-right focus:outline-none focus:ring-1 focus:ring-ring"
                            value={p.cantidad}
                            onChange={(e) => updatePieza(p._key, 'cantidad', parseInt(e.target.value) || 1)}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number" min="0" step="1"
                            className="border border-border rounded-md px-2 py-1 text-xs w-full text-right focus:outline-none focus:ring-1 focus:ring-ring"
                            value={p.espesor}
                            onChange={(e) => updatePieza(p._key, 'espesor', parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            className="border border-border rounded-md px-1.5 py-1 text-xs bg-card w-full focus:outline-none focus:ring-1 focus:ring-ring"
                            value={p.material}
                            onChange={(e) => updatePieza(p._key, 'material', e.target.value)}
                          >
                            <option value="">Heredar{materialTablero ? ` (${materialTablero.nombre})` : ''}</option>
                            {tableros.map((t) => (
                              <option key={t.id} value={t.nombre}>{t.nombre}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex flex-col gap-1">
                            <div className="flex gap-0.5">
                              {TAPACANTO_LADOS.map((l) => (
                                <button
                                  key={l.key}
                                  title={l.title}
                                  onClick={() => toggleTapacanto(p._key, l.key)}
                                  className={`w-6 h-6 rounded text-xs font-bold transition-colors ${
                                    p.tapacanto.includes(l.key)
                                      ? 'bg-amber-500 text-white'
                                      : 'bg-muted text-muted-foreground hover:bg-muted'
                                  }`}
                                >
                                  {l.label}
                                </button>
                              ))}
                            </div>
                            {p.tapacanto.length > 0 && (
                              <select
                                value={p.tapacantoColor}
                                onChange={(e) => updatePieza(p._key, 'tapacantoColor', e.target.value)}
                                title="Canto / color del tapacanto"
                                className="border border-amber-200 rounded px-1 py-0.5 text-xs bg-card focus:outline-none focus:ring-1 focus:ring-amber-400 text-amber-800 w-full"
                              >
                                <option value="">— Sin canto —</option>
                                {cantos.length > 0
                                  ? cantos.map((c) => (
                                      <option key={c.id} value={c.nombre}>
                                        {c.codigo ? `[${c.codigo}] ` : ''}{c.nombre}
                                      </option>
                                    ))
                                  : TAPACANTO_COLORS_FALLBACK.map((c) => (
                                      <option key={c.value} value={c.value}>{c.label}</option>
                                    ))
                                }
                              </select>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex flex-col gap-1">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={p.llevaMecanizado}
                                onChange={(e) => updatePieza(p._key, 'llevaMecanizado', e.target.checked)}
                                className="w-3.5 h-3.5 rounded border-gray-300"
                              />
                              <span className="text-xs text-muted-foreground">Sí</span>
                            </label>
                            {p.llevaMecanizado && (
                              <select
                                value={p.tipoMecanizado || ''}
                                onChange={(e) => updatePieza(p._key, 'tipoMecanizado', e.target.value)}
                                className="border border-amber-200 rounded px-1 py-0.5 text-xs bg-card focus:outline-none focus:ring-1 focus:ring-amber-400 w-full"
                              >
                                <option value="">— Tipo —</option>
                                <option value="bisagras">Bisagras</option>
                                <option value="ranuras">Ranuras</option>
                                <option value="minifix">Minifix</option>
                                <option value="bisagras,minifix">Bisagras+Minifix</option>
                                <option value="otro">Otro</option>
                              </select>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-right text-xs text-muted-foreground font-mono">{area.toFixed(4)}</td>
                        <td className="px-2 py-1.5 text-right text-xs text-amber-700 font-mono">{tc.toFixed(2)}</td>
                        <td className="px-2 py-1.5">
                          <button onClick={() => removePieza(p._key)} className="text-muted-foreground/70 hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {piezas.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/40">
                      <td colSpan={9} className="px-3 py-2 text-xs font-semibold text-muted-foreground">Totales</td>
                      <td className="px-2 py-2 text-right text-xs font-bold text-foreground font-mono">{totalAreaM2.toFixed(4)} m²</td>
                      <td className="px-2 py-2 text-right text-xs font-bold text-amber-700 font-mono">{totalTapacantoMl.toFixed(2)} ml</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <div className="px-4 py-3 border-t border-border">
              <Button variant="secondary" size="sm" onClick={addPieza}>
                <Plus className="w-3.5 h-3.5" /> Agregar pieza
              </Button>
            </div>
          </div>

          {/* Consumo de tablero — agrupado por tipo */}
          {piezas.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Consumo de tablero</p>
                <span className="text-xs text-muted-foreground">
                {totalAreaM2.toFixed(3)} m² · {totalTapacantoMl.toFixed(2)} ml canto
                {Object.entries(calcTapacantoByColor(piezas)).map(([color, ml]) => (
                  <span key={color} className="ml-2 px-1.5 py-0.5 bg-amber-50 border border-amber-200 rounded text-amber-700 text-2xs">
                    {color}: {ml.toFixed(2)} ml
                  </span>
                ))}
              </span>
              </div>
              <div className="space-y-2">
                {tableroGroups.map((g) => (
                  <div key={g.nombre} className="border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-foreground">{g.nombre}</span>
                      <span className="text-xs text-muted-foreground">{g.boardW}×{g.boardH} mm</span>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Área piezas</p>
                        <p className="text-sm font-bold text-foreground">{g.areaM2.toFixed(3)} m²</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Planchas (+15%)</p>
                        <p className="text-sm font-bold text-blue-700">{g.planchas}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">% uso plancha</p>
                        <p className={`text-sm font-bold ${g.pctUso >= 70 ? 'text-green-600' : 'text-amber-600'}`}>
                          {g.pctUso.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Tapacanto</p>
                        <p className="text-sm font-bold text-amber-700">{g.tapacantoMl.toFixed(2)} ml</p>
                      </div>
                    </div>
                    {/* Barra de uso */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 bg-muted rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${g.pctUso >= 70 ? 'bg-green-500' : 'bg-amber-400'}`}
                          style={{ width: `${Math.min(100, g.pctUso)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setTab('nesting')}
                className="w-full text-xs text-blue-600 hover:text-blue-800 py-1.5 border border-dashed border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
              >
                Ver optimización de corte (Nesting) →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: NESTING ────────────────────────────────────────────────────── */}
      {tab === 'nesting' && (
        <ModuloNestingTab
          piezasCount={piezas.length}
          grupos={nestingGroups}
          kerf={nestKerf}
          rotation={nestRotation}
          onKerfChange={setNestKerf}
          onToggleRotation={() => setNestRotation((v) => !v)}
        />
      )}

      {/* ── TAB: MATERIALES ─────────────────────────────────────────────────── */}
      {tab === 'materiales' && (
        <div className="bg-card rounded-xl border border-border overflow-hidden print:hidden">
          {cantosYHerrajes.length === 0 && (
            <div className="px-5 pt-4 pb-0">
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                No hay cantos ni herrajes en el catálogo.{' '}
                <Link href="/melamina/materiales" className="underline font-medium">Agregar en Materiales</Link>
              </p>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className={thCls}>Canto / Herraje (buscar)</th>
                  <th className={thCls} style={{ width: 70 }}>Tipo</th>
                  <th className={thCls} style={{ width: 80 }}>Unidad</th>
                  <th className={thCls} style={{ width: 80 }}>Cantidad</th>
                  <th className={thCls} style={{ width: 100 }}>Costo unit.</th>
                  <th className={thCls} style={{ width: 110 }}>Subtotal</th>
                  <th className={thCls}>Observaciones</th>
                  <th className={thCls} style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {materialesModulo.map((r) => (
                  <tr key={r._key} className="hover:bg-muted/40/50">
                    <td className="px-2 py-1.5">
                      <input
                        list={`mats-${r._key}`}
                        className="border border-border rounded-md px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-ring"
                        placeholder="Buscar canto o herraje..."
                        value={r.search}
                        onChange={(e) => {
                          const val = e.target.value
                          setMaterialesModulo((prev) => prev.map((row) => {
                            if (row._key !== r._key) return row
                            const updated = { ...row, search: val }
                            const match = cantosYHerrajes.find((m) =>
                              `${m.codigo ? `[${m.codigo}] ` : ''}${m.nombre}` === val || m.nombre === val
                            )
                            if (match) {
                              updated.materialId = match.id
                              updated.tipo = match.tipo
                              updated.unidad = match.unidad
                              updated.costoSnapshot = match.precio
                              updated.subtotal = row.cantidad * match.precio
                            }
                            return updated
                          }))
                        }}
                      />
                      <datalist id={`mats-${r._key}`}>
                        {cantosYHerrajes.map((m) => (
                          <option key={m.id} value={`${m.codigo ? `[${m.codigo}] ` : ''}${m.nombre}`} />
                        ))}
                      </datalist>
                    </td>
                    <td className="px-2 py-1.5">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                        r.tipo === 'canto' ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'
                      }`}>
                        {r.tipo || '—'}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className="border border-border rounded-md px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-ring"
                        value={r.unidad}
                        onChange={(e) => updateMaterial(r._key, 'unidad', e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number" min="0" step="0.01"
                        className="border border-border rounded-md px-2 py-1 text-xs w-full text-right focus:outline-none focus:ring-1 focus:ring-ring"
                        value={r.cantidad}
                        onChange={(e) => updateMaterial(r._key, 'cantidad', parseFloat(e.target.value) || 0)}
                      />
                      {r.tipo === 'canto' && (() => {
                        const mat = cantosYHerrajes.find((m) => m.id === r.materialId)
                        const specificMl = mat ? (tapacantoByColor[mat.nombre] ?? 0) : 0
                        const fallbackMl = totalTapacantoMl
                        const suggestedMl = specificMl > 0 ? specificMl : (mat ? 0 : fallbackMl)
                        if (suggestedMl <= 0) return null
                        return (
                          <button
                            type="button"
                            onClick={() => updateMaterial(r._key, 'cantidad', parseFloat(suggestedMl.toFixed(2)))}
                            className="text-xs text-amber-600 hover:text-amber-800 underline mt-0.5 flex items-center justify-end gap-1 w-full"
                            title={specificMl > 0
                              ? `ML calculados para "${mat?.nombre}" en el despiece`
                              : 'Total de tapacanto calculado de todas las piezas'}
                          >
                            ↺ {suggestedMl.toFixed(2)} ml
                            {specificMl > 0 && <span className="text-amber-400 font-semibold">✓</span>}
                          </button>
                        )
                      })()}
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number" min="0" step="0.01"
                        className="border border-border rounded-md px-2 py-1 text-xs w-full text-right focus:outline-none focus:ring-1 focus:ring-ring"
                        value={r.costoSnapshot}
                        onChange={(e) => updateMaterial(r._key, 'costoSnapshot', parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right text-xs font-bold text-foreground pr-4 font-mono">
                      {formatCurrency(r.subtotal)}
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className="border border-border rounded-md px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-ring"
                        value={r.observaciones}
                        onChange={(e) => updateMaterial(r._key, 'observaciones', e.target.value)}
                        placeholder="Nota..."
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <button onClick={() => removeMaterial(r._key)} className="text-muted-foreground/70 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {materialesModulo.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-sm">
                      No hay cantos ni herrajes. Usa el botón para agregar.
                    </td>
                  </tr>
                )}
              </tbody>
              {materialesModulo.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/40">
                    <td colSpan={5} className="px-3 py-2 text-xs font-semibold text-muted-foreground">Total cantos + herrajes</td>
                    <td className="px-2 py-2 text-right text-sm font-bold text-foreground pr-4 font-mono">
                      {formatCurrency(totalMateriales)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border">
            <Button variant="secondary" size="sm" onClick={addMaterial}>
              <Plus className="w-3.5 h-3.5" /> Agregar material
            </Button>
          </div>
        </div>
      )}

      {/* ── TAB: RESUMEN ────────────────────────────────────────────────────── */}
      {tab === 'resumen' && (
        <ModuloResumenTab
          piezas={piezas}
          totalAreaM2={totalAreaM2}
          tableroGroups={tableroGroups}
          materialTablero={materialTablero ?? null}
          materialesModulo={materialesModulo}
          materialesDisponibles={materialesDisponibles}
          totalMateriales={totalMateriales}
          costoTablero={costoTablero}
          costoTotal={costoTotal}
          precioVenta={precioVenta}
          onPrecioVentaChange={setPrecioVenta}
          margen={margen}
          cantidad={cantidad}
          pv={pv}
        />
      )}

      {/* ── VISTA DE IMPRESIÓN (solo visible al imprimir) ──────────────────── */}
      <div className="hidden print:block text-black text-sm">
        <div className="mb-4">
          <h1 className="text-lg font-bold">{nombre || 'Módulo'} — Lista de Corte</h1>
          <p className="text-xs text-muted-foreground">
            {tipoModulo} · {ancho}×{alto}×{prof} mm
            {materialTablero && ` · Tablero: ${materialTablero.nombre} (${materialTablero.espesorMm ?? 18}mm)`}
            {` · ${numPlanchas} plancha${numPlanchas !== 1 ? 's' : ''} necesaria${numPlanchas !== 1 ? 's' : ''} (incl. 15% merma)`}
          </p>
        </div>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="text-left py-1 pr-2">Etiq.</th>
              <th className="text-left py-1 pr-2">Nombre</th>
              <th className="text-right py-1 pr-2">Largo mm</th>
              <th className="text-right py-1 pr-2">Ancho mm</th>
              <th className="text-right py-1 pr-2">Cant.</th>
              <th className="text-right py-1 pr-2">Esp. mm</th>
              <th className="text-left py-1 pr-2">Tablero</th>
              <th className="text-left py-1 pr-2">Tapacanto</th>
              <th className="text-right py-1">Área m²</th>
            </tr>
          </thead>
          <tbody>
            {piezas.map((p) => (
              <tr key={p._key} className="border-b border-border">
                <td className="py-0.5 pr-2 font-mono">{p.etiqueta}</td>
                <td className="py-0.5 pr-2">{p.nombre}</td>
                <td className="py-0.5 pr-2 text-right">{p.largo}</td>
                <td className="py-0.5 pr-2 text-right">{p.ancho}</td>
                <td className="py-0.5 pr-2 text-right">{p.cantidad}</td>
                <td className="py-0.5 pr-2 text-right">{p.espesor}</td>
                <td className="py-0.5 pr-2">{p.material || (materialTablero?.nombre ?? '—')}</td>
                <td className="py-0.5 pr-2">{p.tapacanto.map((l) => l[0].toUpperCase()).join(' ')}</td>
                <td className="py-0.5 text-right">{calcAreaM2(p).toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-black font-bold">
              <td colSpan={8} className="py-1">TOTAL</td>
              <td className="py-1 text-right">{totalAreaM2.toFixed(4)} m²</td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-3 text-xs text-muted-foreground">Tapacanto total: {totalTapacantoMl.toFixed(2)} ml</p>
      </div>

      {/* Barra fija inferior */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-6 py-3 flex items-center justify-between z-20 shadow-lg print:hidden">
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-muted-foreground text-xs">Área</span>
            <p className="font-bold text-foreground">{totalAreaM2.toFixed(3)} m²</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Planchas</span>
            <p className="font-bold text-blue-700">{numPlanchas}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Tapacanto</span>
            <p className="font-bold text-amber-700">{totalTapacantoMl.toFixed(2)} ml</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Costo est.</span>
            <p className="font-bold text-foreground">{formatCurrency(costoTotal)}</p>
          </div>
          {pv > 0 && (
            <div>
              <span className="text-muted-foreground text-xs">Margen</span>
              <p className={`font-bold ${margen >= 0 ? 'text-green-600' : 'text-red-600'}`}>{margen.toFixed(1)}%</p>
            </div>
          )}
        </div>
        <Button onClick={handleSave} disabled={loading}>
          <Save className="w-4 h-4" />
          {loading ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </div>

      <ConfirmDialog
        abierto={confirmDuplicar}
        titulo="¿Duplicar este módulo con todas sus piezas y materiales?"
        textoConfirmar="Sí, duplicar"
        variante="primario"
        cargando={loading}
        onConfirmar={handleDuplicate}
        onCancelar={() => setConfirmDuplicar(false)}
      />
    </div>
  )
}
