'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import {
  Plus,
  Trash2,
  Save,
  X,
  Loader2,
  ChevronDown,
  Hammer,
  Box,
} from 'lucide-react'

interface Cliente {
  id: number
  nombre: string
}

interface Proyecto {
  id: number
  nombre: string
  clienteId: number
}

interface Partida {
  id?: number
  descripcion: string
  unidad: string
  cantidad: number
  precioUnitario: number
  subtotal: number
  orden: number
}

interface ModuloMelamina {
  id?: number
  tipoModulo: string
  descripcion: string
  ancho: number
  alto: number
  profundidad: number
  material: string
  costoMaterial: number
  costoManoObra: number
  subtotal: number
  cantidad: number
  orden: number
}

interface PresupuestoBuilderProps {
  clientes: Cliente[]
  proyectos: Proyecto[]
  initialData?: {
    id?: number
    clienteId?: number
    proyectoId?: number | null
    estado?: string
    notas?: string
    partidas?: Partida[]
    modulosMelamina?: ModuloMelamina[]
  }
  mode?: 'create' | 'edit'
  defaultClienteId?: number
  defaultProyectoId?: number
}

const PARTIDAS_PREDEFINIDAS = [
  { descripcion: 'Demolición y retiro de escombros', unidad: 'gl' },
  { descripcion: 'Albañilería - Muros y tabiques', unidad: 'm2' },
  { descripcion: 'Terminaciones interiores', unidad: 'm2' },
  { descripcion: 'Instalación eléctrica', unidad: 'gl' },
  { descripcion: 'Instalación sanitaria', unidad: 'gl' },
  { descripcion: 'Pintura lavable muros y cielos', unidad: 'm2' },
  { descripcion: 'Cerámicos y porcelanato piso', unidad: 'm2' },
  { descripcion: 'Carpintería en general', unidad: 'gl' },
]

const MATERIALES_MELAMINA = [
  'Melamina Egger 18mm Blanco Alpino',
  'Melamina Egger 18mm Grafito',
  'Melamina Egger 18mm Wengue',
  'Melamina Egger 25mm Blanco',
  'MDF 18mm',
  'Plywood Fenólico 15mm',
  'Melamina 18mm Roble Natural',
]

function emptyPartida(orden: number): Partida {
  return { descripcion: '', unidad: 'm2', cantidad: 1, precioUnitario: 0, subtotal: 0, orden }
}

function emptyModulo(orden: number): ModuloMelamina {
  return {
    tipoModulo: 'Base',
    descripcion: '',
    ancho: 60,
    alto: 80,
    profundidad: 55,
    material: 'Melamina Egger 18mm Blanco Alpino',
    costoMaterial: 0,
    costoManoObra: 0,
    subtotal: 0,
    cantidad: 1,
    orden,
  }
}

export function PresupuestoBuilder({
  clientes,
  proyectos,
  initialData,
  mode = 'create',
  defaultClienteId,
  defaultProyectoId,
}: PresupuestoBuilderProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [clienteId, setClienteId] = useState<string>(
    String(initialData?.clienteId || defaultClienteId || '')
  )
  const [proyectoId, setProyectoId] = useState<string>(
    String(initialData?.proyectoId || defaultProyectoId || '')
  )
  const [estado, setEstado] = useState(initialData?.estado || 'Borrador')
  const [notas, setNotas] = useState(initialData?.notas || '')

  const [partidas, setPartidas] = useState<Partida[]>(
    initialData?.partidas?.length
      ? initialData.partidas
      : [emptyPartida(0)]
  )
  const [modulos, setModulos] = useState<ModuloMelamina[]>(
    initialData?.modulosMelamina || []
  )

  // Filter proyectos by selected cliente
  const proyectosFiltrados = proyectos.filter(
    (p) => !clienteId || p.clienteId === parseInt(clienteId)
  )

  // Reset proyecto when cliente changes
  useEffect(() => {
    if (proyectoId) {
      const proyectoExists = proyectosFiltrados.find((p) => String(p.id) === proyectoId)
      if (!proyectoExists) setProyectoId('')
    }
  }, [clienteId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Calculate partida subtotals
  const updatePartida = useCallback((index: number, field: keyof Partida, value: string | number) => {
    setPartidas((prev) => {
      const updated = [...prev]
      const partida = { ...updated[index], [field]: value }
      if (field === 'cantidad' || field === 'precioUnitario') {
        const qty = field === 'cantidad' ? Number(value) : Number(partida.cantidad)
        const price = field === 'precioUnitario' ? Number(value) : Number(partida.precioUnitario)
        partida.subtotal = qty * price
      }
      updated[index] = partida
      return updated
    })
  }, [])

  const addPartida = () => {
    setPartidas((prev) => [...prev, emptyPartida(prev.length)])
  }

  const addPartidaFromTemplate = (template: { descripcion: string; unidad: string }) => {
    setPartidas((prev) => [
      ...prev,
      { ...emptyPartida(prev.length), descripcion: template.descripcion, unidad: template.unidad },
    ])
  }

  const removePartida = (index: number) => {
    setPartidas((prev) => prev.filter((_, i) => i !== index))
  }

  // Calculate modulo subtotals
  const updateModulo = useCallback((index: number, field: keyof ModuloMelamina, value: string | number) => {
    setModulos((prev) => {
      const updated = [...prev]
      const modulo = { ...updated[index], [field]: value }
      if (field === 'costoMaterial' || field === 'costoManoObra') {
        modulo.subtotal =
          (field === 'costoMaterial' ? Number(value) : Number(modulo.costoMaterial)) +
          (field === 'costoManoObra' ? Number(value) : Number(modulo.costoManoObra))
      }
      updated[index] = modulo
      return updated
    })
  }, [])

  const addModulo = () => {
    setModulos((prev) => [...prev, emptyModulo(prev.length)])
  }

  const removeModulo = (index: number) => {
    setModulos((prev) => prev.filter((_, i) => i !== index))
  }

  // Totals
  const subtotalObra = partidas.reduce((acc, p) => acc + (p.subtotal || 0), 0)
  const subtotalMelamina = modulos.reduce(
    (acc, m) => acc + (m.subtotal || 0) * (m.cantidad || 1),
    0
  )
  const total = subtotalObra + subtotalMelamina

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!clienteId) {
      setError('Debe seleccionar un cliente')
      return
    }

    // Validate partidas
    const partidasValidas = partidas.filter((p) => p.descripcion.trim())
    const modulosValidos = modulos.filter((m) => m.descripcion.trim())

    setLoading(true)
    try {
      const url =
        mode === 'edit' && initialData?.id
          ? `/api/presupuestos/${initialData.id}`
          : '/api/presupuestos'

      const method = mode === 'edit' ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId,
          proyectoId: proyectoId || null,
          estado,
          notas,
          partidas: partidasValidas,
          modulosMelamina: modulosValidos,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Error al guardar presupuesto')
      }

      if (mode === 'edit') {
        router.push('/presupuestos?msg=actualizado')
      } else {
        router.push('/presupuestos?msg=creado')
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Header Section */}
      <Card>
        <CardHeader>
          <CardTitle>Información General</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="clienteId">Cliente *</Label>
              <Select
                id="clienteId"
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                required
              >
                <option value="">Selecciona un cliente...</option>
                {clientes.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.nombre}
                  </option>
                ))}
              </Select>
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="proyectoId">Proyecto (opcional)</Label>
              <Select
                id="proyectoId"
                value={proyectoId}
                onChange={(e) => setProyectoId(e.target.value)}
                disabled={!clienteId}
              >
                <option value="">Sin proyecto asociado</option>
                {proyectosFiltrados.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.nombre}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="estado">Estado</Label>
              <Select
                id="estado"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
              >
                <option value="Borrador">Borrador</option>
                <option value="Enviado">Enviado</option>
                <option value="Aprobado">Aprobado</option>
                <option value="Rechazado">Rechazado</option>
              </Select>
            </div>

            <div className="md:col-span-3">
              <Label htmlFor="notas">Notas del presupuesto</Label>
              <Input
                id="notas"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Condiciones, plazos, observaciones..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PARTIDAS DE OBRA */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Hammer className="w-4 h-4 text-slate-500" />
              PARTIDAS DE OBRA
            </CardTitle>
            <Button type="button" variant="secondary" size="sm" onClick={addPartida}>
              <Plus className="w-3.5 h-3.5" />
              Agregar Partida
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick add templates */}
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">Agregar rápido:</p>
            <div className="flex flex-wrap gap-2">
              {PARTIDAS_PREDEFINIDAS.map((template) => (
                <button
                  key={template.descripcion}
                  type="button"
                  onClick={() => addPartidaFromTemplate(template)}
                  className="px-2.5 py-1 text-xs rounded-md border border-slate-200 bg-slate-50 text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                >
                  + {template.descripcion.split(' ').slice(0, 2).join(' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Partidas Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase min-w-[200px]">Descripción</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase w-20">Unidad</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase w-24">Cantidad</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase w-32">Precio Unit.</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase w-32">Subtotal</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {partidas.map((partida, index) => (
                  <tr key={index} className="hover:bg-slate-50/30">
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={partida.descripcion}
                        onChange={(e) => updatePartida(index, 'descripcion', e.target.value)}
                        placeholder="Descripción de la partida..."
                        className="w-full px-2 py-1.5 text-sm border border-transparent rounded hover:border-slate-200 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-transparent focus:bg-white transition-all"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={partida.unidad}
                        onChange={(e) => updatePartida(index, 'unidad', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                      >
                        <option value="m2">m²</option>
                        <option value="m">ml</option>
                        <option value="m3">m³</option>
                        <option value="gl">gl</option>
                        <option value="un">un</option>
                        <option value="kg">kg</option>
                        <option value="hr">hr</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={partida.cantidad}
                        onChange={(e) => updatePartida(index, 'cantidad', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                        className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white text-right"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={partida.precioUnitario}
                        onChange={(e) => updatePartida(index, 'precioUnitario', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="1000"
                        className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white text-right"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-sm font-semibold text-slate-700 block text-right pr-1">
                        {formatCurrency(partida.subtotal)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => removePartida(index)}
                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {partidas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-400 text-sm">
                      No hay partidas. Haz clic en "Agregar Partida" para comenzar.
                    </td>
                  </tr>
                )}
              </tbody>
              {subtotalObra > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td colSpan={4} className="px-3 py-2.5 text-right text-sm font-semibold text-slate-600 uppercase">
                      Subtotal Obra:
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-sm font-bold text-slate-800">{formatCurrency(subtotalObra)}</span>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* MÓDULOS DE MELAMINA */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Box className="w-4 h-4 text-slate-500" />
              MÓDULOS DE MELAMINA / EBANISTERÍA
            </CardTitle>
            <Button type="button" variant="secondary" size="sm" onClick={addModulo}>
              <Plus className="w-3.5 h-3.5" />
              Agregar Módulo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {modulos.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
              <Box className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">Sin módulos de melamina</p>
              <p className="text-slate-300 text-xs mt-1">
                Agrega módulos si el proyecto incluye fabricación de muebles en melamina
              </p>
              <button
                type="button"
                onClick={addModulo}
                className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                + Agregar primer módulo
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase w-24">Tipo</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase min-w-[160px]">Descripción</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase w-16">A (cm)</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase w-16">H (cm)</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase w-16">P (cm)</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase w-16">Cant.</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase w-28">C. Material</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase w-28">M.O.</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase w-32">Subtotal</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {modulos.map((modulo, index) => (
                    <tr key={index} className="hover:bg-slate-50/30">
                      <td className="px-3 py-2">
                        <select
                          value={modulo.tipoModulo}
                          onChange={(e) => updateModulo(index, 'tipoModulo', e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                        >
                          <option value="Base">Base</option>
                          <option value="Aéreo">Aéreo</option>
                          <option value="Columna">Columna</option>
                          <option value="Panel">Panel</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={modulo.descripcion}
                          onChange={(e) => updateModulo(index, 'descripcion', e.target.value)}
                          placeholder="Descripción del módulo..."
                          className="w-full px-2 py-1.5 text-sm border border-transparent rounded hover:border-slate-200 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-transparent focus:bg-white transition-all"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={modulo.ancho}
                          onChange={(e) => updateModulo(index, 'ancho', parseFloat(e.target.value) || 0)}
                          min="0"
                          className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white text-right"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={modulo.alto}
                          onChange={(e) => updateModulo(index, 'alto', parseFloat(e.target.value) || 0)}
                          min="0"
                          className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white text-right"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={modulo.profundidad}
                          onChange={(e) => updateModulo(index, 'profundidad', parseFloat(e.target.value) || 0)}
                          min="0"
                          className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white text-right"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={modulo.cantidad}
                          onChange={(e) => updateModulo(index, 'cantidad', parseInt(e.target.value) || 1)}
                          min="1"
                          className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white text-right"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={modulo.costoMaterial}
                          onChange={(e) => updateModulo(index, 'costoMaterial', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="1000"
                          className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white text-right"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={modulo.costoManoObra}
                          onChange={(e) => updateModulo(index, 'costoManoObra', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="1000"
                          className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white text-right"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-right">
                          <span className="text-xs text-slate-500 block">c/u: {formatCurrency(modulo.subtotal)}</span>
                          <span className="text-sm font-semibold text-slate-700">
                            {formatCurrency(modulo.subtotal * modulo.cantidad)}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => removeModulo(index)}
                          className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {subtotalMelamina > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-200">
                      <td colSpan={8} className="px-3 py-2.5 text-right text-sm font-semibold text-slate-600 uppercase">
                        Subtotal Melamina:
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="text-sm font-bold text-slate-800">{formatCurrency(subtotalMelamina)}</span>
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary & Actions */}
      <div className="flex items-start justify-between gap-6 flex-wrap">
        {/* Total Summary */}
        <Card className="flex-1 min-w-[280px] max-w-sm">
          <CardHeader>
            <CardTitle>Resumen de Costos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
              <span className="text-sm text-slate-600">Subtotal Obra</span>
              <span className="text-sm font-semibold text-slate-700">{formatCurrency(subtotalObra)}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
              <span className="text-sm text-slate-600">Subtotal Melamina</span>
              <span className="text-sm font-semibold text-slate-700">{formatCurrency(subtotalMelamina)}</span>
            </div>
            <div className="flex justify-between items-center py-3 bg-blue-50 -mx-2 px-4 rounded-lg">
              <span className="text-base font-bold text-blue-700">TOTAL</span>
              <span className="text-xl font-bold text-blue-700">{formatCurrency(total)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3 self-end pb-6">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.back()}
            disabled={loading}
          >
            <X className="w-4 h-4" />
            Cancelar
          </Button>
          <Button type="submit" disabled={loading} size="lg">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {mode === 'edit' ? 'Guardar cambios' : 'Guardar Presupuesto'}
          </Button>
        </div>
      </div>
    </form>
  )
}
