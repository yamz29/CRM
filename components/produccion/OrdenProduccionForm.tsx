'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PRIORIDADES } from '@/lib/produccion'
import { Package, LayoutGrid, Plus, Trash2, Loader2, CheckSquare, FileText, Upload, X, AlertTriangle, Download } from 'lucide-react'

interface ModuloInfo {
  placementId: number
  moduloId: number
  nivel: string
  nombre: string
  tipoModulo: string
  ancho: number
  alto: number
  profundidad: number
  cantidad: number
}

interface Espacio {
  id: number
  nombre: string
  layoutType: string
  moduloCount: number
  modulos: ModuloInfo[]
  createdAt: string
}

interface Props {
  espacios: Espacio[]
  proyectos: { id: number; nombre: string }[]
}

interface ManualItem {
  nombre: string
  tipo: string
  dimensiones: string
  cantidad: number
}

interface CsvPiezaRaw {
  rowNumber: number
  referencia: string | null
  nombre: string
  cantidad: number
  dimensiones: string | null
  tipo: string | null
  material: string | null
  canteado: string | null
}

interface CsvParseResult {
  items: CsvPiezaRaw[]
  errores: { fila: number; mensaje: string }[]
  totalFilas: number
  separador: ';' | ','
  resumenPorMaterial: { material: string; piezas: number; cantidad: number }[]
}

export function OrdenProduccionForm({ espacios, proyectos }: Props) {
  const router = useRouter()
  const [modo, setModo] = useState<'importar' | 'manual' | 'csv'>('importar')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Import mode
  const [selectedEspacio, setSelectedEspacio] = useState<number | ''>('')
  const [selectedModulos, setSelectedModulos] = useState<Set<number>>(new Set())

  // Common fields
  const [nombre, setNombre] = useState('')
  const [proyectoId, setProyectoId] = useState<number | ''>('')
  const [prioridad, setPrioridad] = useState('Media')

  // Manual mode
  const [items, setItems] = useState<ManualItem[]>([
    { nombre: '', tipo: '', dimensiones: '', cantidad: 1 },
  ])

  // CSV mode
  const csvInputRef = useRef<HTMLInputElement>(null)
  const [csvFileName, setCsvFileName] = useState('')
  const [csvParseResult, setCsvParseResult] = useState<CsvParseResult | null>(null)
  const [csvLoading, setCsvLoading] = useState(false)
  const [csvError, setCsvError] = useState('')

  const espacioData = selectedEspacio ? espacios.find(e => e.id === selectedEspacio) : null

  function handleSelectEspacio(id: number) {
    setSelectedEspacio(id)
    const esp = espacios.find(e => e.id === id)
    if (esp) {
      setSelectedModulos(new Set(esp.modulos.map(m => m.moduloId)))
    }
  }

  function toggleModulo(moduloId: number) {
    const next = new Set(selectedModulos)
    if (next.has(moduloId)) next.delete(moduloId)
    else next.add(moduloId)
    setSelectedModulos(next)
  }

  function toggleAllModulos() {
    if (!espacioData) return
    if (selectedModulos.size === espacioData.modulos.length) {
      setSelectedModulos(new Set())
    } else {
      setSelectedModulos(new Set(espacioData.modulos.map(m => m.moduloId)))
    }
  }

  function addItem() {
    setItems([...items, { nombre: '', tipo: '', dimensiones: '', cantidad: 1 }])
  }

  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: keyof ManualItem, value: string | number) {
    setItems(items.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  // ── CSV handlers ────────────────────────────────────────────────────
  async function handleCsvFile(file: File) {
    setCsvError('')
    setCsvLoading(true)
    setCsvFileName(file.name)
    try {
      const fd = new FormData()
      fd.append('archivo', file)
      const res = await fetch('/api/produccion/importar-csv', {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) {
        setCsvError(data.error || 'Error al parsear el CSV')
        setCsvParseResult(null)
      } else {
        setCsvParseResult(data)
      }
    } catch {
      setCsvError('Error al procesar el archivo')
    } finally {
      setCsvLoading(false)
    }
  }

  function clearCsv() {
    setCsvFileName('')
    setCsvParseResult(null)
    setCsvError('')
    if (csvInputRef.current) csvInputRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      if (modo === 'importar') {
        if (!selectedEspacio || selectedModulos.size === 0) {
          setError('Selecciona un espacio y al menos un módulo')
          setSaving(false)
          return
        }

        const moduloIds = Array.from(selectedModulos)
        const res = await fetch('/api/produccion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modo: 'importar-espacio',
            espacioId: selectedEspacio,
            moduloIds,
            nombre: nombre || `Producción - ${espacioData?.nombre || ''}`,
            proyectoId: proyectoId || null,
            prioridad,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error al crear orden')
        router.push('/produccion?msg=creado')
      } else if (modo === 'csv') {
        if (!csvParseResult || csvParseResult.items.length === 0) {
          setError('Carga un archivo CSV con items válidos primero')
          setSaving(false)
          return
        }
        const res = await fetch('/api/produccion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modo: 'csv',
            nombre: nombre || `Producción - ${csvFileName.replace(/\.[^.]+$/, '')}`,
            proyectoId: proyectoId || null,
            prioridad,
            items: csvParseResult.items,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error al crear orden')
        router.push('/produccion?msg=creado')
      } else {
        const validItems = items.filter(i => i.nombre.trim())
        if (validItems.length === 0) {
          setError('Agrega al menos un item')
          setSaving(false)
          return
        }
        const res = await fetch('/api/produccion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modo: 'manual',
            nombre: nombre || 'Orden manual',
            proyectoId: proyectoId || null,
            prioridad,
            items: validItems,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error al crear orden')
        router.push('/produccion?msg=creado')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Mode selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => setModo('importar')}
          className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
            modo === 'importar'
              ? 'border-primary bg-primary/5 dark:bg-primary/10'
              : 'border-border hover:border-primary/30'
          }`}
        >
          <LayoutGrid className={`w-5 h-5 shrink-0 ${modo === 'importar' ? 'text-primary' : 'text-muted-foreground'}`} />
          <div className="text-left">
            <p className={`text-sm font-medium ${modo === 'importar' ? 'text-foreground' : 'text-muted-foreground'}`}>
              Importar de Espacio
            </p>
            <p className="text-xs text-muted-foreground">Módulos de un proyecto de cocina</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setModo('csv')}
          className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
            modo === 'csv'
              ? 'border-primary bg-primary/5 dark:bg-primary/10'
              : 'border-border hover:border-primary/30'
          }`}
        >
          <FileText className={`w-5 h-5 shrink-0 ${modo === 'csv' ? 'text-primary' : 'text-muted-foreground'}`} />
          <div className="text-left">
            <p className={`text-sm font-medium ${modo === 'csv' ? 'text-foreground' : 'text-muted-foreground'}`}>
              Importar CSV de despiece
            </p>
            <p className="text-xs text-muted-foreground">Carga piezas desde CAD/CNC</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setModo('manual')}
          className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
            modo === 'manual'
              ? 'border-primary bg-primary/5 dark:bg-primary/10'
              : 'border-border hover:border-primary/30'
          }`}
        >
          <Package className={`w-5 h-5 shrink-0 ${modo === 'manual' ? 'text-primary' : 'text-muted-foreground'}`} />
          <div className="text-left">
            <p className={`text-sm font-medium ${modo === 'manual' ? 'text-foreground' : 'text-muted-foreground'}`}>
              Crear Manualmente
            </p>
            <p className="text-xs text-muted-foreground">Agrega items a mano</p>
          </div>
        </button>
      </div>

      {/* Common fields */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos Generales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Nombre de la orden</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Se genera automáticamente si se deja vacío"
              className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Proyecto (opcional)</label>
              <select
                value={proyectoId}
                onChange={(e) => setProyectoId(e.target.value ? parseInt(e.target.value) : '')}
                className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm"
              >
                <option value="">Sin proyecto</option>
                {proyectos.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Prioridad</label>
              <select
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm"
              >
                {PRIORIDADES.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Import mode: select espacio + modules */}
      {modo === 'importar' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Seleccionar Espacio</CardTitle>
            </CardHeader>
            <CardContent>
              {espacios.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No hay espacios/cocinas creados
                </p>
              ) : (
                <div className="space-y-2">
                  {espacios.map(esp => (
                    <label
                      key={esp.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedEspacio === esp.id
                          ? 'border-primary bg-primary/5 dark:bg-primary/10'
                          : 'border-border hover:border-primary/30'
                      }`}
                    >
                      <input
                        type="radio"
                        name="espacio"
                        value={esp.id}
                        checked={selectedEspacio === esp.id}
                        onChange={() => handleSelectEspacio(esp.id)}
                        className="accent-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-foreground">{esp.nombre}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                            {esp.layoutType}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {esp.moduloCount} módulos colocados
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Module selection within espacio */}
          {espacioData && espacioData.modulos.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Módulos a Producir</CardTitle>
                  <button
                    type="button"
                    onClick={toggleAllModulos}
                    className="text-xs text-primary hover:underline"
                  >
                    {selectedModulos.size === espacioData.modulos.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {espacioData.modulos.map(m => (
                    <label
                      key={m.moduloId}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedModulos.has(m.moduloId)
                          ? 'border-primary/50 bg-primary/5 dark:bg-primary/10'
                          : 'border-border'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedModulos.has(m.moduloId)}
                        onChange={() => toggleModulo(m.moduloId)}
                        className="accent-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{m.nombre}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            m.nivel === 'alto' ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400'
                            : m.nivel === 'isla' ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                          }`}>{m.nivel}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {m.tipoModulo} — {m.ancho}×{m.alto}×{m.profundidad} mm — Cant: {m.cantidad}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  <CheckSquare className="w-3 h-3 inline mr-1" />
                  {selectedModulos.size} de {espacioData.modulos.length} módulos seleccionados
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* CSV mode: file upload + preview */}
      {modo === 'csv' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">Importar despiece</CardTitle>
              <div className="flex items-center gap-2">
                <a
                  href="/api/produccion/importar-csv/plantilla?formato=xlsx"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                  download
                >
                  <Download className="w-3 h-3" /> Plantilla Excel
                </a>
                <span className="text-xs text-muted-foreground">•</span>
                <a
                  href="/api/produccion/importar-csv/plantilla?formato=csv"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                  download
                >
                  <Download className="w-3 h-3" /> Plantilla CSV
                </a>
                {csvFileName && (
                  <>
                    <span className="text-xs text-muted-foreground">•</span>
                    <button type="button" onClick={clearCsv} className="text-xs text-red-500 hover:underline flex items-center gap-1">
                      <X className="w-3 h-3" /> Quitar archivo
                    </button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) handleCsvFile(f)
              }}
            />

            {!csvFileName ? (
              <button
                type="button"
                onClick={() => csvInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-10 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
              >
                <Upload className="w-6 h-6" />
                <span className="text-sm font-medium">Haz clic para seleccionar un archivo CSV o Excel</span>
                <span className="text-xs max-w-md text-center">
                  Descarga primero la plantilla (botones arriba) o usa un CSV/XLSX exportado de software CAD/CNC.
                  Columnas reconocidas: Designación, Cantidad, Longitud, Anchura, Grosor, Material, Cantos…
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border border-border rounded-lg">
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground truncate flex-1">{csvFileName}</span>
                {csvLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </div>
            )}

            {csvError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Error al procesar el CSV</p>
                  <p className="text-xs mt-0.5">{csvError}</p>
                </div>
              </div>
            )}

            {csvParseResult && (
              <>
                {/* Resumen */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-muted/30 border border-border">
                    <p className="text-xs text-muted-foreground">Piezas detectadas</p>
                    <p className="text-2xl font-bold text-foreground">{csvParseResult.items.length}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border">
                    <p className="text-xs text-muted-foreground">Cantidad total</p>
                    <p className="text-2xl font-bold text-foreground">
                      {csvParseResult.items.reduce((s, i) => s + i.cantidad, 0)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border">
                    <p className="text-xs text-muted-foreground">Materiales</p>
                    <p className="text-2xl font-bold text-foreground">{csvParseResult.resumenPorMaterial.length}</p>
                  </div>
                </div>

                {/* Materiales */}
                {csvParseResult.resumenPorMaterial.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Por material</p>
                    <div className="flex flex-wrap gap-1.5">
                      {csvParseResult.resumenPorMaterial.map(m => (
                        <span key={m.material} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border border-border bg-muted/30">
                          <span className="font-medium text-foreground">{m.material}</span>
                          <span className="text-muted-foreground">{m.piezas} ref / {m.cantidad} pz</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Errores */}
                {csvParseResult.errores.length > 0 && (
                  <details className="rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
                    <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      {csvParseResult.errores.length} fila{csvParseResult.errores.length === 1 ? '' : 's'} con problemas
                    </summary>
                    <ul className="px-3 pb-2 text-xs text-amber-700 dark:text-amber-400 space-y-0.5">
                      {csvParseResult.errores.slice(0, 10).map((e, i) => (
                        <li key={i}>• Fila {e.fila}: {e.mensaje}</li>
                      ))}
                      {csvParseResult.errores.length > 10 && (
                        <li className="italic">…y {csvParseResult.errores.length - 10} más</li>
                      )}
                    </ul>
                  </details>
                )}

                {/* Tabla preview (primeros 50 items) */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Preview (primeras filas)</p>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-72 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/40 sticky top-0">
                          <tr className="border-b border-border">
                            <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">Ref</th>
                            <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">Pieza</th>
                            <th className="px-2 py-1.5 text-right font-semibold text-muted-foreground">Cant</th>
                            <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">Dimensiones</th>
                            <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">Material</th>
                            <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">Cantos</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {csvParseResult.items.slice(0, 50).map((it, i) => (
                            <tr key={i} className="hover:bg-muted/20">
                              <td className="px-2 py-1 font-mono text-muted-foreground">{it.referencia ?? '—'}</td>
                              <td className="px-2 py-1 text-foreground">{it.nombre}</td>
                              <td className="px-2 py-1 text-right tabular-nums">{it.cantidad}</td>
                              <td className="px-2 py-1 text-muted-foreground tabular-nums">{it.dimensiones ?? '—'}</td>
                              <td className="px-2 py-1 text-muted-foreground truncate max-w-[140px]">{it.material ?? '—'}</td>
                              <td className="px-2 py-1 text-muted-foreground truncate max-w-[180px]" title={it.canteado ?? ''}>{it.canteado ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {csvParseResult.items.length > 50 && (
                      <p className="px-3 py-1.5 text-[11px] text-muted-foreground border-t border-border bg-muted/20">
                        Mostrando 50 de {csvParseResult.items.length}. Al crear la orden se incluirán todas.
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Manual mode: add items */}
      {modo === 'manual' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Items de Producción</CardTitle>
              <Button type="button" variant="ghost" size="sm" onClick={addItem}>
                <Plus className="w-4 h-4" /> Agregar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/20">
                <div className="flex-1 grid grid-cols-4 gap-2">
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={item.nombre}
                      onChange={(e) => updateItem(idx, 'nombre', e.target.value)}
                      placeholder="Nombre del módulo"
                      className="w-full px-3 py-1.5 rounded-lg border border-border bg-input text-foreground text-sm"
                    />
                  </div>
                  <input
                    type="text"
                    value={item.dimensiones}
                    onChange={(e) => updateItem(idx, 'dimensiones', e.target.value)}
                    placeholder="Dimensiones"
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-input text-foreground text-sm"
                  />
                  <input
                    type="number"
                    min="1"
                    value={item.cantidad}
                    onChange={(e) => updateItem(idx, 'cantidad', parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-input text-foreground text-sm"
                  />
                </div>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-600 mt-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={() => router.push('/produccion')}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Crear Orden
        </Button>
      </div>
    </form>
  )
}
