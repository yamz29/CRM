'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchJson } from '@/lib/api-client'
import { Trash2, CreditCard, Building2, CheckCircle2, Clock, X, ChevronDown, ChevronUp, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CuentaCreateSchema } from '@/lib/api-schemas'
import type { CuentaBancariaConSaldo } from '@/lib/types'


// ── Cuenta Card with expandable movements ───────────────────────────────

export function CuentaCard({ cuenta: c, onEdit, onDelete }: { cuenta: CuentaBancariaConSaldo; onEdit: () => void; onDelete: () => void }) {
  const esTarjeta = c.tipoCuenta === 'tarjeta_credito'
  const [expanded, setExpanded] = useState(false)
  // Movimientos solo cuando la card se expande; misma key que Conciliacion
  // (cache compartida entre ambas vistas).
  const { data: movimientos = [], isLoading: loading } = useQuery({
    queryKey: ['contabilidad', 'movimientos', c.id],
    queryFn: () => fetchJson<any[]>(`/api/contabilidad/cuentas/${c.id}/movimientos`),
    enabled: expanded,
  })
  const handleToggle = () => setExpanded(!expanded)

  return (
    <div className={`bg-card border border-border rounded-xl overflow-hidden ${expanded ? 'col-span-full' : ''}`}>
      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-foreground">{c.nombre}</h3>
            <p className="text-sm text-muted-foreground">{c.banco}</p>
          </div>
          <div className={`p-2 rounded-lg ${esTarjeta ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500'}`}>
            {esTarjeta ? <CreditCard className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-2xs font-medium px-1.5 py-0.5 rounded ${esTarjeta ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
            {esTarjeta ? 'Tarjeta de Crédito' : c.tipoCuenta === 'ahorro' ? 'Ahorro' : 'Corriente'}
          </span>
          {c.numeroCuenta && <span className="text-xs font-mono text-muted-foreground">{c.numeroCuenta}</span>}
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground">{esTarjeta ? 'Deuda actual' : 'Saldo actual'}</p>
            <p className={`text-lg font-bold tabular-nums ${esTarjeta && (c.saldoActual ?? 0) > 0 ? 'text-red-500' : ''}`}>
              {formatCurrency(c.saldoActual ?? c.saldoInicial)}
            </p>
            {esTarjeta && (
              <p className="text-2xs text-muted-foreground">Límite: {formatCurrency(c.saldoInicial)}</p>
            )}
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={handleToggle} aria-label="Ver movimientos" title="Ver movimientos">
              <List className="w-3.5 h-3.5" />
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={onEdit}>Editar</Button>
            <Button variant="ghost" size="sm" onClick={onDelete}>
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
            </Button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border">
          {loading && <p className="px-5 py-4 text-sm text-muted-foreground">Cargando movimientos...</p>}
          {!loading && movimientos.length === 0 && (
            <p className="px-5 py-6 text-sm text-center text-muted-foreground">No hay movimientos</p>
          )}
          {!loading && movimientos.length > 0 && (
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/60 backdrop-blur-sm">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Fecha</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Tipo</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Descripción</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Ref.</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">Monto</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-muted-foreground">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {movimientos.map((m: any) => (
                    <tr key={m.id} className="hover:bg-muted/20">
                      <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{new Date(m.fecha).toLocaleDateString('es-DO', { timeZone: 'UTC' })}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs font-medium ${m.tipo === 'credito' ? 'text-green-600' : 'text-red-600'}`}>
                          {m.tipo === 'credito' ? 'Crédito' : 'Débito'}
                        </span>
                      </td>
                      <td className="px-4 py-2 max-w-[300px] truncate">{m.descripcion}</td>
                      <td className="px-4 py-2 text-muted-foreground font-mono text-xs">{m.referencia || '—'}</td>
                      <td className={`px-4 py-2 text-right font-semibold tabular-nums whitespace-nowrap ${m.tipo === 'credito' ? 'text-green-600' : 'text-red-600'}`}>
                        {m.tipo === 'credito' ? '+' : '-'}{formatCurrency(m.monto)}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {m.conciliado ? (
                          <span className="inline-flex items-center gap-1 text-green-600 text-xs"><CheckCircle2 className="w-3 h-3" /> Conciliado</span>
                        ) : (
                          <span className="text-xs text-yellow-600"><Clock className="w-3 h-3 inline" /> Pendiente</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-2 bg-muted/30 text-xs text-muted-foreground flex justify-between">
                <span>{movimientos.length} movimientos</span>
                <span>
                  Créditos: <span className="text-green-600 font-medium">{formatCurrency(movimientos.filter((m: any) => m.tipo === 'credito').reduce((s: number, m: any) => s + m.monto, 0))}</span>
                  {' · '}
                  Débitos: <span className="text-red-600 font-medium">{formatCurrency(movimientos.filter((m: any) => m.tipo === 'debito').reduce((s: number, m: any) => s + m.monto, 0))}</span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Cuenta Form Inline ───────────────────────────────────────────────────

export function CuentaFormInline({ cuenta, onClose, onSaved }: { cuenta: CuentaBancariaConSaldo | null; onClose: () => void; onSaved: () => void }) {
  // Patron F7: el MISMO schema Zod que valida el API (CuentaCreateSchema)
  // valida el formulario via zodResolver — una sola definicion de reglas.
  const form = useForm({
    resolver: zodResolver(CuentaCreateSchema),
    defaultValues: {
      nombre: cuenta?.nombre ?? '',
      banco: cuenta?.banco ?? '',
      numeroCuenta: cuenta?.numeroCuenta ?? '',
      tipoCuenta: cuenta?.tipoCuenta ?? 'corriente',
      moneda: cuenta?.moneda ?? 'RD$',
      saldoInicial: cuenta?.saldoInicial?.toString() ?? '0',
    },
  })
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = form
  const tipoCuenta = watch('tipoCuenta')

  const onSubmit = handleSubmit(async (data) => {
    const url = cuenta ? `/api/contabilidad/cuentas/${cuenta.id}` : '/api/contabilidad/cuentas'
    const method = cuenta ? 'PUT' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    if (res.ok) {
      onSaved()
    } else {
      const d = await res.json().catch(() => null)
      form.setError('root', { message: d?.error || 'Error al guardar' })
    }
  })

  const inputCls = 'w-full border border-border rounded-md px-2.5 py-1.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring'
  const errCls = 'text-xs text-red-600 mt-0.5'

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">{cuenta ? 'Editar Cuenta' : 'Nueva Cuenta Bancaria'}</h3>
        <button onClick={onClose}><X className="w-4 h-4" /></button>
      </div>
      {errors.root && <p className="text-red-600 text-sm mb-3">{errors.root.message}</p>}
      <form onSubmit={onSubmit} className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Nombre *</label>
          <input {...register('nombre')} className={inputCls} />
          {errors.nombre && <p className={errCls}>{errors.nombre.message}</p>}
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Banco *</label>
          <input {...register('banco')} className={inputCls} />
          {errors.banco && <p className={errCls}>{errors.banco.message}</p>}
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Número de cuenta</label>
          <input {...register('numeroCuenta')} className={inputCls} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Tipo</label>
          <select {...register('tipoCuenta')} className={inputCls}>
            <option value="corriente">Corriente</option>
            <option value="ahorro">Ahorro</option>
            <option value="tarjeta_credito">Tarjeta de Crédito</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Moneda</label>
          <select {...register('moneda')} className={inputCls}>
            <option value="RD$">RD$</option>
            <option value="USD">USD</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">{tipoCuenta === 'tarjeta_credito' ? 'Límite de crédito' : 'Saldo inicial'}</label>
          <input type="number" step="0.01" {...register('saldoInicial')} className={inputCls} />
          {errors.saldoInicial && <p className={errCls}>{errors.saldoInicial.message}</p>}
        </div>
        <div className="col-span-full flex justify-end gap-2 mt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Guardando...' : (cuenta ? 'Actualizar' : 'Crear Cuenta')}</Button>
        </div>
      </form>
    </div>
  )
}


