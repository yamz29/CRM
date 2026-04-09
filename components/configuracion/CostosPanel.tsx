'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calculator, CheckCircle, Info } from 'lucide-react'

export function CostosPanel({ initialFactor }: { initialFactor: number }) {
  const [factor, setFactor] = useState<string>(String(initialFactor))
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const factorNum = parseFloat(factor) || 0
  const recargoPct = ((factorNum - 1) * 100).toFixed(0)
  const ejemploBase = 200
  const ejemploCargado = ejemploBase * (factorNum > 0 ? factorNum : 1)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)
    try {
      const res = await fetch('/api/configuracion/factor-carga', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factor: factorNum }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al guardar')
      }
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Calculator className="w-5 h-5 text-blue-600" />
          Costos de mano de obra
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Explicación */}
          <div className="flex items-start gap-3 p-4 rounded-xl border bg-blue-50 border-blue-200 dark:bg-blue-900/15 dark:border-blue-800">
            <Info className="w-5 h-5 mt-0.5 shrink-0 text-blue-600" />
            <div className="text-sm text-blue-900 dark:text-blue-200 space-y-1.5">
              <p className="font-semibold">Factor de carga social (Labor Burden)</p>
              <p className="text-xs text-blue-800 dark:text-blue-300">
                Multiplicador que se aplica al sueldo base de cada usuario para
                reflejar el costo real de la mano de obra: TSS (AFP + SFS),
                INFOTEP, riesgos laborales, regalía pascual, vacaciones, cesantía,
                etc. En República Dominicana suele estar entre 1.35 y 1.45.
              </p>
              <p className="text-xs text-blue-800 dark:text-blue-300">
                Este factor se aplica al cálculo del costo de horas en los
                proyectos. <strong>No modifica el sueldo registrado por usuario</strong>,
                solo lo carga al imputar al proyecto.
              </p>
            </div>
          </div>

          {/* Input */}
          <div className="space-y-2 max-w-sm">
            <Label htmlFor="factor">Factor de carga social</Label>
            <Input
              id="factor"
              type="number"
              min="1"
              step="0.01"
              value={factor}
              onChange={(e) => { setFactor(e.target.value); setSuccess(false) }}
              placeholder="1.40"
            />
            <p className="text-xs text-muted-foreground">
              {factorNum >= 1
                ? `Equivale a un recargo del ${recargoPct}% sobre el sueldo base`
                : 'Debe ser ≥ 1.00 (1.00 = sin recargo)'}
            </p>
          </div>

          {/* Ejemplo */}
          {factorNum >= 1 && (
            <div className="border border-border rounded-xl p-4 bg-muted/40 max-w-sm">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
                Ejemplo
              </p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sueldo base / hora</span>
                  <span className="font-medium tabular-nums">RD$ {ejemploBase.toLocaleString('es-DO')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">× Factor {factorNum.toFixed(2)}</span>
                  <span className="font-medium tabular-nums text-blue-600">
                    +RD$ {(ejemploCargado - ejemploBase).toLocaleString('es-DO', { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-border">
                  <span className="font-semibold">Costo cargado al proyecto</span>
                  <span className="font-black tabular-nums text-foreground">
                    RD$ {ejemploCargado.toLocaleString('es-DO', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 text-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              Factor guardado correctamente
            </div>
          )}
          {error && (
            <div className="text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={loading || factorNum < 1}>
              {loading ? 'Guardando...' : 'Guardar factor'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
