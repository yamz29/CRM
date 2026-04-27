import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import { PrintButton } from '@/app/presupuestos/[id]/imprimir/PrintButton'

const MS_DAY = 86_400_000

export default async function InformeCierreProyectoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) notFound()

  const [proyecto, empresa] = await Promise.all([
    prisma.proyecto.findUnique({
      where: { id },
      include: {
        cliente: { select: { id: true, nombre: true, rnc: true } },
        facturas: {
          where: { estado: { not: 'anulada' } },
          select: { id: true, tipo: true, total: true, montoPagado: true, fecha: true, esProforma: true },
        },
        adicionales: { orderBy: { fechaPropuesta: 'asc' } },
        gastos: {
          where: { estado: { not: 'Anulado' } },
          select: { monto: true, partidaId: true, partida: { select: { capituloNombre: true } }, fecha: true },
        },
        capitulos: { include: { partidas: true }, orderBy: { orden: 'asc' } },
        cronogramas: {
          include: {
            actividades: { select: { id: true, fechaInicio: true, fechaFin: true, pctAvance: true, esCritica: true } },
          },
        },
      },
    }),
    prisma.empresa.findFirst(),
  ])
  if (!proyecto) notFound()

  // Lookup del usuario que cerró (sin relación FK formal en schema)
  const cerradoPor = proyecto.cerradoPorId
    ? await prisma.usuario.findUnique({
        where: { id: proyecto.cerradoPorId },
        select: { nombre: true, correo: true },
      })
    : null

  const nombreEmpresa = empresa?.nombre || 'Gonzalva Group'
  const rncEmpresa = empresa?.rut || ''
  const logoUrl = empresa?.logoUrl || null

  // ── Métricas financieras ────────────────────────────────────────────
  const adicionalesAprobados = proyecto.adicionales.filter(a => a.estado === 'aprobado' || a.estado === 'facturado')
  const adicionalesPropuestos = proyecto.adicionales.filter(a => a.estado === 'propuesto')
  const adicionalesRechazados = proyecto.adicionales.filter(a => a.estado === 'rechazado')
  const montoAdicionales = adicionalesAprobados.reduce((s, a) => s + a.monto, 0)
  const presupuestoBase = proyecto.presupuestoEstimado ?? 0
  const presupuestoVigente = presupuestoBase + montoAdicionales

  const facturasIngreso = proyecto.facturas.filter(f => f.tipo === 'ingreso' && !f.esProforma)
  const totalFacturado = facturasIngreso.reduce((s, f) => s + f.total, 0)
  const totalCobrado = facturasIngreso.reduce((s, f) => s + f.montoPagado, 0)

  const totalGastos = proyecto.gastos.reduce((s, g) => s + g.monto, 0)
  const margenBruto = totalCobrado - totalGastos
  const margenPct = totalCobrado > 0 ? (margenBruto / totalCobrado) * 100 : 0

  const variacionVsPresupuesto = presupuestoVigente > 0
    ? ((totalGastos - presupuestoVigente) / presupuestoVigente) * 100
    : 0

  // Días promedio de cobro: por cada factura, días entre fecha factura y fecha de últimopago
  // (lo aproximamos sin pagos detallados aquí — para informe ejecutivo, alcanza con duración)
  const fechaInicio = proyecto.fechaInicio
  const fechaCierre = proyecto.fechaCierre ?? new Date()
  const fechaFinPlan = proyecto.fechaEstimada
  const duracionRealDias = fechaInicio
    ? Math.round((fechaCierre.getTime() - new Date(fechaInicio).getTime()) / MS_DAY)
    : null
  const duracionPlanDias = fechaInicio && fechaFinPlan
    ? Math.round((new Date(fechaFinPlan).getTime() - new Date(fechaInicio).getTime()) / MS_DAY)
    : null
  const desviacionDias = duracionRealDias != null && duracionPlanDias != null
    ? duracionRealDias - duracionPlanDias
    : null

  // ── Desglose por capítulo ──────────────────────────────────────────
  // Sumar gastos por capituloNombre para comparar con presupuestado
  const gastosPorCapitulo = new Map<string, number>()
  for (const g of proyecto.gastos) {
    const cap = g.partida?.capituloNombre || '(sin clasificar)'
    gastosPorCapitulo.set(cap, (gastosPorCapitulo.get(cap) ?? 0) + g.monto)
  }
  const presupuestadoPorCapitulo = new Map<string, number>()
  for (const cap of proyecto.capitulos) {
    const total = cap.partidas.reduce((s, p) => s + p.subtotalPresupuestado, 0)
    presupuestadoPorCapitulo.set(cap.nombre, total)
  }
  const todosCapitulos = new Set([...gastosPorCapitulo.keys(), ...presupuestadoPorCapitulo.keys()])
  const desglose = Array.from(todosCapitulos).map(cap => {
    const presup = presupuestadoPorCapitulo.get(cap) ?? 0
    const gasto = gastosPorCapitulo.get(cap) ?? 0
    const variacion = presup > 0 ? ((gasto - presup) / presup) * 100 : (gasto > 0 ? Infinity : 0)
    return { capitulo: cap, presupuestado: presup, gastado: gasto, variacion, diferencia: presup - gasto }
  }).sort((a, b) => Math.abs(b.variacion) - Math.abs(a.variacion))

  // ── Cronograma ─────────────────────────────────────────────────────
  const totalActividades = proyecto.cronogramas.reduce((s, c) => s + c.actividades.length, 0)
  const completadas = proyecto.cronogramas.reduce(
    (s, c) => s + c.actividades.filter(a => a.pctAvance >= 100).length, 0
  )

  return (
    <>
      <style>{`
        @page { size: A4 portrait; margin: 1.5cm; }
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
          .no-print { display: none !important; }
          .print-shell { background: white !important; padding: 0 !important; }
          .print-wrap { box-shadow: none !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; border-radius: 0 !important; }
          .pagebreak-avoid { page-break-inside: avoid; break-inside: avoid; }
        }
      `}</style>

      <div className="print-shell" style={{ background: '#f3f4f6', minHeight: '100vh', padding: '1.5rem' }}>
        {/* Toolbar */}
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '850px', margin: '0 auto 1rem' }}>
          <Link href={`/proyectos/${proyecto.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'white', border: '1px solid #e2e8f0', color: '#475569', fontSize: 14, textDecoration: 'none' }}>
            <ArrowLeft size={16} /> Volver al proyecto
          </Link>
          <PrintButton />
        </div>

        <div
          className="print-wrap"
          style={{
            maxWidth: '850px', margin: '0 auto', background: 'white', padding: '2rem 2.5rem',
            borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', color: '#0f172a',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, paddingBottom: 16, borderBottom: '2px solid #0f172a' }}>
            <div>
              {logoUrl && /* eslint-disable-next-line @next/next/no-img-element */
                <img src={logoUrl} alt="" style={{ height: 48, marginBottom: 8, objectFit: 'contain' }} />}
              <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{nombreEmpresa}</h1>
              {rncEmpresa && <p style={{ fontSize: 11, margin: '2px 0', color: '#64748b' }}>RNC: {rncEmpresa}</p>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 6, background: '#1e293b', color: 'white', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                Informe de cierre
              </span>
              <p style={{ fontSize: 11, margin: 0, color: '#64748b' }}>Cerrado: {formatDate(fechaCierre)}</p>
              {cerradoPor && <p style={{ fontSize: 11, margin: '2px 0 0', color: '#64748b' }}>Por: {cerradoPor.nombre}</p>}
            </div>
          </div>

          {/* Datos del proyecto */}
          <div className="pagebreak-avoid" style={{ marginTop: 20 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{proyecto.nombre}</h2>
            <p style={{ fontSize: 13, color: '#475569', margin: '4px 0' }}>
              {proyecto.codigo && <span style={{ fontFamily: 'monospace', marginRight: 8 }}>{proyecto.codigo}</span>}
              {proyecto.tipoProyecto}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', marginTop: 12, fontSize: 12 }}>
              <div><span style={{ color: '#64748b' }}>Cliente:</span> <strong>{proyecto.cliente.nombre}</strong></div>
              {proyecto.cliente.rnc && <div><span style={{ color: '#64748b' }}>RNC:</span> {proyecto.cliente.rnc}</div>}
              {proyecto.ubicacion && <div><span style={{ color: '#64748b' }}>Ubicación:</span> {proyecto.ubicacion}</div>}
              {proyecto.responsable && <div><span style={{ color: '#64748b' }}>Responsable:</span> {proyecto.responsable}</div>}
              <div><span style={{ color: '#64748b' }}>Inicio:</span> {fechaInicio ? formatDate(fechaInicio) : '—'}</div>
              <div><span style={{ color: '#64748b' }}>Cierre:</span> {formatDate(fechaCierre)}</div>
              {duracionRealDias != null && (
                <div>
                  <span style={{ color: '#64748b' }}>Duración real:</span> <strong>{duracionRealDias} días</strong>
                  {duracionPlanDias != null && (
                    <span style={{ marginLeft: 6, color: desviacionDias! > 0 ? '#dc2626' : '#16a34a' }}>
                      ({desviacionDias! > 0 ? '+' : ''}{desviacionDias} vs plan)
                    </span>
                  )}
                </div>
              )}
              <div><span style={{ color: '#64748b' }}>Avance físico final:</span> <strong>{proyecto.avanceFisico}%</strong></div>
            </div>
          </div>

          {/* Resumen financiero */}
          <div className="pagebreak-avoid" style={{ marginTop: 28 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', margin: '0 0 10px', borderBottom: '1px solid #e2e8f0', paddingBottom: 6 }}>
              Resumen financiero
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                <tr><td style={{ padding: '6px 0', color: '#475569' }}>Presupuesto base</td>
                  <td style={{ padding: '6px 0', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(presupuestoBase)}</td></tr>
                <tr><td style={{ padding: '6px 0', color: '#475569' }}>Adicionales aprobados ({adicionalesAprobados.length})</td>
                  <td style={{ padding: '6px 0', textAlign: 'right', fontFamily: 'monospace', color: '#16a34a' }}>+ {formatCurrency(montoAdicionales)}</td></tr>
                <tr style={{ borderTop: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px 0', fontWeight: 700 }}>Presupuesto vigente</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{formatCurrency(presupuestoVigente)}</td></tr>
                <tr><td style={{ padding: '6px 0', color: '#475569' }}>Gastos reales</td>
                  <td style={{ padding: '6px 0', textAlign: 'right', fontFamily: 'monospace', color: '#dc2626' }}>- {formatCurrency(totalGastos)}</td></tr>
                <tr style={{ borderTop: '2px solid #0f172a' }}>
                  <td style={{ padding: '10px 0', fontSize: 14, fontWeight: 800 }}>Margen bruto</td>
                  <td style={{
                    padding: '10px 0', textAlign: 'right', fontSize: 16, fontWeight: 800, fontFamily: 'monospace',
                    color: margenBruto >= 0 ? '#16a34a' : '#dc2626',
                  }}>
                    {formatCurrency(margenBruto)} <span style={{ fontSize: 12, fontWeight: 600 }}>({margenPct.toFixed(1)}%)</span>
                  </td></tr>
                {presupuestoVigente > 0 && (
                  <tr><td style={{ padding: '4px 0', color: '#64748b', fontSize: 11 }}>Variación gastos vs presupuesto</td>
                    <td style={{ padding: '4px 0', textAlign: 'right', fontSize: 11, fontFamily: 'monospace', color: variacionVsPresupuesto > 0 ? '#dc2626' : '#16a34a' }}>
                      {variacionVsPresupuesto > 0 ? '+' : ''}{variacionVsPresupuesto.toFixed(1)}%
                    </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Cobros */}
          <div className="pagebreak-avoid" style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', margin: '0 0 10px', borderBottom: '1px solid #e2e8f0', paddingBottom: 6 }}>
              Cobros del cliente
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', fontSize: 13 }}>
              <div><span style={{ color: '#64748b' }}>Facturado total:</span> <strong style={{ fontFamily: 'monospace' }}>{formatCurrency(totalFacturado)}</strong></div>
              <div><span style={{ color: '#64748b' }}>Cobrado total:</span> <strong style={{ fontFamily: 'monospace', color: '#16a34a' }}>{formatCurrency(totalCobrado)}</strong></div>
              <div><span style={{ color: '#64748b' }}>Facturas emitidas:</span> <strong>{facturasIngreso.length}</strong></div>
              <div><span style={{ color: '#64748b' }}>Saldo pendiente:</span> <strong style={{ fontFamily: 'monospace', color: totalFacturado - totalCobrado > 0.01 ? '#dc2626' : '#16a34a' }}>
                {formatCurrency(Math.max(0, totalFacturado - totalCobrado))}</strong></div>
            </div>
          </div>

          {/* Adicionales */}
          {proyecto.adicionales.length > 0 && (
            <div className="pagebreak-avoid" style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', margin: '0 0 10px', borderBottom: '1px solid #e2e8f0', paddingBottom: 6 }}>
                Adicionales / Change Orders
              </h3>
              <p style={{ fontSize: 12, color: '#475569', margin: '0 0 8px' }}>
                Aprobados: <strong>{adicionalesAprobados.length}</strong> · Propuestos: {adicionalesPropuestos.length} · Rechazados: {adicionalesRechazados.length}
                {presupuestoBase > 0 && (
                  <span style={{ marginLeft: 8 }}>
                    · Aprobados representan <strong>{((montoAdicionales / presupuestoBase) * 100).toFixed(1)}%</strong> del presupuesto base
                  </span>
                )}
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '5px 8px', textAlign: 'left', color: '#475569' }}>Título</th>
                    <th style={{ padding: '5px 8px', textAlign: 'left', color: '#475569' }}>Estado</th>
                    <th style={{ padding: '5px 8px', textAlign: 'right', color: '#475569' }}>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {proyecto.adicionales.map(a => (
                    <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '5px 8px' }}>{a.titulo}</td>
                      <td style={{ padding: '5px 8px', textTransform: 'capitalize' }}>{a.estado}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(a.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Desglose por capítulo */}
          {desglose.length > 0 && (
            <div className="pagebreak-avoid" style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', margin: '0 0 10px', borderBottom: '1px solid #e2e8f0', paddingBottom: 6 }}>
                Desglose por capítulo
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left', color: '#475569' }}>Capítulo</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', color: '#475569' }}>Presupuestado</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', color: '#475569' }}>Gastado</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', color: '#475569' }}>Variación</th>
                  </tr>
                </thead>
                <tbody>
                  {desglose.map(d => (
                    <tr key={d.capitulo} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '5px 8px' }}>{d.capitulo}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(d.presupuestado)}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(d.gastado)}</td>
                      <td style={{
                        padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600,
                        color: d.variacion > 5 ? '#dc2626' : d.variacion < -5 ? '#16a34a' : '#475569',
                      }}>
                        {!isFinite(d.variacion) ? 'sin presup.' : `${d.variacion > 0 ? '+' : ''}${d.variacion.toFixed(1)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Cronograma */}
          {totalActividades > 0 && (
            <div className="pagebreak-avoid" style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', margin: '0 0 10px', borderBottom: '1px solid #e2e8f0', paddingBottom: 6 }}>
                Cronograma
              </h3>
              <div style={{ fontSize: 12, color: '#475569' }}>
                <strong>{completadas}</strong> de <strong>{totalActividades}</strong> actividades completadas ({Math.round((completadas / totalActividades) * 100)}%)
              </div>
            </div>
          )}

          {/* Observaciones */}
          {proyecto.observacionesCierre && (
            <div className="pagebreak-avoid" style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', margin: '0 0 10px', borderBottom: '1px solid #e2e8f0', paddingBottom: 6 }}>
                Observaciones del cierre
              </h3>
              <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap', color: '#0f172a' }}>
                {proyecto.observacionesCierre}
              </p>
            </div>
          )}

          {/* Footer */}
          <div style={{ marginTop: 36, paddingTop: 12, borderTop: '1px solid #e2e8f0', fontSize: 10, color: '#94a3b8', textAlign: 'center' }}>
            Informe generado el {formatDate(new Date())} · {nombreEmpresa}
          </div>
        </div>
      </div>
    </>
  )
}
