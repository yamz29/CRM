import { prisma } from '@/lib/prisma'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PrintButton } from './PrintButton'

export default async function ImprimirReciboPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [recibo, empresa] = await Promise.all([
    prisma.recibo.findUnique({
      where: { id: parseInt(id) },
      include: {
        cliente: { select: { nombre: true } },
        cuentaBancaria: { select: { nombre: true } },
        aplicaciones: {
          include: {
            factura: { select: { numero: true, total: true } },
          },
        },
      },
    }),
    prisma.empresa.findFirst({ select: { nombre: true } }),
  ])

  if (!recibo) {
    return (
      <div className="max-w-[800px] mx-auto p-8 text-slate-900">
        <p className="text-slate-500">Recibo no encontrado.</p>
      </div>
    )
  }

  const nombreEmpresa = empresa?.nombre || 'Gonzalva Group'
  const saldoCuenta = recibo.monto - recibo.montoAplicado

  return (
    <div className="max-w-[800px] mx-auto p-8 text-slate-900 bg-white print:p-0">
      {/* Top bar — hidden when printing */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <a href="/facturacion" className="text-sm text-slate-500 hover:text-slate-800">
          ← Volver a Cobros
        </a>
        <PrintButton />
      </div>

      {/* Header */}
      <header className="border-b-2 border-slate-800 pb-3 mb-5">
        <h1 className="text-xl font-bold">{nombreEmpresa}</h1>
        <p className="text-lg font-semibold mt-1">Recibo de Ingreso {recibo.numero}</p>
      </header>

      {/* Data block */}
      <Seccion titulo="Datos del recibo">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <DataRow label="Fecha" valor={formatDate(recibo.fecha)} />
          <DataRow label="Cliente" valor={recibo.cliente.nombre} />
          <DataRow label="Método de pago" valor={recibo.metodoPago} />
          <DataRow label="Cuenta" valor={recibo.cuentaBancaria?.nombre ?? '—'} />
          <DataRow label="Referencia" valor={recibo.referencia ?? '—'} />
          {recibo.observaciones && (
            <DataRow label="Observaciones" valor={recibo.observaciones} />
          )}
        </div>
        {/* Monto prominente */}
        <div className="mt-4 border border-slate-200 rounded-lg p-3 inline-block">
          <p className="text-[10px] uppercase text-slate-500">Monto recibido</p>
          <p className="text-2xl font-bold tabular-nums mt-0.5">{formatCurrency(recibo.monto)}</p>
        </div>
      </Seccion>

      {/* Aplicaciones */}
      <Seccion titulo="Aplicación a facturas">
        {recibo.aplicaciones.length === 0 ? (
          <p className="text-sm text-slate-500 italic">Sin aplicar (anticipo)</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-500">
                <th className="py-1">Factura</th>
                <th className="py-1 text-right">Monto aplicado</th>
              </tr>
            </thead>
            <tbody>
              {recibo.aplicaciones.map((ap, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-1 font-mono">{ap.factura.numero}</td>
                  <td className="py-1 text-right tabular-nums">{formatCurrency(ap.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Seccion>

      {/* Footer */}
      <div className="flex justify-between items-center border-t border-slate-300 pt-3 text-sm">
        <span className="text-slate-600">Saldo a cuenta:</span>
        <span className={`font-bold tabular-nums text-base ${saldoCuenta > 0.01 ? 'text-amber-700' : 'text-slate-700'}`}>
          {formatCurrency(saldoCuenta)}
        </span>
      </div>
    </div>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 break-inside-avoid">
      <h2 className="text-sm font-bold border-b border-slate-800 pb-1 mb-2">{titulo}</h2>
      {children}
    </section>
  )
}

function DataRow({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-slate-500 shrink-0 w-36">{label}:</span>
      <span className="text-slate-900 font-medium">{valor}</span>
    </div>
  )
}
