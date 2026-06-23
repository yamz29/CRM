'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Wallet, CheckCircle, Info } from 'lucide-react'

export function NominaConfigPanel({
  initialTasaAfp,
  initialTasaSfs,
  initialFactorHoraExtra,
}: {
  initialTasaAfp: number
  initialTasaSfs: number
  initialFactorHoraExtra: number
}) {
  const [tasaAfp, setTasaAfp] = useState(String(initialTasaAfp))
  const [tasaSfs, setTasaSfs] = useState(String(initialTasaSfs))
  const [factorHoraExtra, setFactorHoraExtra] = useState(String(initialFactorHoraExtra))
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)
    try {
      const res = await fetch('/api/configuracion/nomina', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasaAfp: parseFloat(tasaAfp),
          tasaSfs: parseFloat(tasaSfs),
          factorHoraExtra: parseFloat(factorHoraExtra),
        }),
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
          <Wallet className="w-5 h-5 text-blue-600" />
          Tasas de nómina
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-start gap-3 p-4 rounded-xl border bg-blue-50 border-blue-200 dark:bg-blue-900/15 dark:border-blue-800">
            <Info className="w-5 h-5 mt-0.5 shrink-0 text-blue-600" />
            <div className="text-sm text-blue-900 dark:text-blue-200 space-y-1.5">
              <p className="font-semibold">Deducciones legales (RD)</p>
              <p className="text-xs text-blue-800 dark:text-blue-300">
                AFP y SFS se descuentan automáticamente sobre el salario bruto de
                cada línea de nómina. No se aplican topes salariales ni ISR;
                consulta con tu contador si algún empleado los requiere.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 max-w-xl">
            <div className="space-y-2">
              <Label htmlFor="tasaAfp">AFP (%)</Label>
              <Input id="tasaAfp" type="number" min="0" step="0.01" value={tasaAfp}
                onChange={(e) => { setTasaAfp(e.target.value); setSuccess(false) }} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tasaSfs">SFS (%)</Label>
              <Input id="tasaSfs" type="number" min="0" step="0.01" value={tasaSfs}
                onChange={(e) => { setTasaSfs(e.target.value); setSuccess(false) }} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="factorHoraExtra">Factor hora extra</Label>
              <Input id="factorHoraExtra" type="number" min="1" step="0.01" value={factorHoraExtra}
                onChange={(e) => { setFactorHoraExtra(e.target.value); setSuccess(false) }} />
            </div>
          </div>

          {success && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 text-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              Tasas guardadas correctamente
            </div>
          )}
          {error && (
            <div className="text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar tasas'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
