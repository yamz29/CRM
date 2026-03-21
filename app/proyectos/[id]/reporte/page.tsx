import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ReporteButtons } from './ReporteButtons'

async function getData(proyectoId: number) {
  const [proyecto, empresa] = await Promise.all([
    prisma.proyecto.findUnique({
      where: { id: proyectoId },
      include: {
        cliente: true,
        capitulos: {
          orderBy: { orden: 'asc' },
          include: { partidas: { orderBy: { orden: 'asc' } } },
        },
      },
    }),
    prisma.empresa.findFirst(),
  ])
  if (!proyecto) return null

  const gastos = await prisma.gastoProyecto.findMany({
    where: { proyectoId, estado: { not: 'Anulado' } },
    select: { monto: true, partidaId: true },
  })

  const gastosPorPartida = new Map<number, number>()
  let gastosNoClasificados = 0
  for (const g of gastos) {
    if (g.partidaId) gastosPorPartida.set(g.partidaId, (gastosPorPartida.get(g.partidaId) ?? 0) + g.monto)
    else gastosNoClasificados += g.monto
  }

  const capitulos = proyecto.capitulos.map(cap => {
    const partidas = cap.partidas.map(p => {
      const gastoReal = gastosPorPartida.get(p.id) ?? 0
      const pct = p.subtotalPresupuestado > 0
        ? (gastoReal / p.subtotalPresupuestado) * 100
        : gastoReal > 0 ? 999 : 0
      return { ...p, gastoReal, diferencia: p.subtotalPresupuestado - gastoReal, pct }
    })
    const totalPres = partidas.reduce((s, p) => s + p.subtotalPresupuestado, 0)
    const totalReal = partidas.reduce((s, p) => s + p.gastoReal, 0)
    return { ...cap, partidas, totalPresupuestado: totalPres, totalGastoReal: totalReal, diferencia: totalPres - totalReal }
  })

  const totalPresupuestado = capitulos.reduce((s, c) => s + c.totalPresupuestado, 0)
  const totalGastado = capitulos.reduce((s, c) => s + c.totalGastoReal, 0)

  return { proyecto, empresa, capitulos, totalPresupuestado, totalGastado, gastosNoClasificados, totalGastos: gastos.length }
}

export default async function ReporteProyectoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const proyectoId = parseInt(id)
  if (isNaN(proyectoId)) notFound()

  const data = await getData(proyectoId)
  if (!data) notFound()

  const { proyecto, empresa, capitulos, totalPresupuestado, totalGastado, gastosNoClasificados, totalGastos } = data
  const diferencia = totalPresupuestado - totalGastado
  const pctTotal = totalPresupuestado > 0 ? (totalGastado / totalPresupuestado) * 100 : 0

  const nombreEmpresa = empresa?.nombre ?? 'Gonzalva Group'

  return (
    <>
      <style>{`
        /* ── Page setup ───────────────────────────────────── */
        @page {
          size: A4 portrait;
          margin: 1.5cm;
        }

        /* ── Print ───────────────────────────────────────── */
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
          .no-print { display: none !important; }
          .print-accent { display: block !important; }
          .cap-block { page-break-inside: avoid; break-inside: avoid; }
          tr         { page-break-inside: avoid; break-inside: avoid; }
          thead      { display: table-header-group; }
          tfoot      { display: table-footer-group; }
        }

        /* ── Base ────────────────────────────────────────── */
        * { box-sizing: border-box; }
        body { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; font-size: 11px; line-height: 1.5; color: #0f172a; background: #f8fafc; margin: 0; }
        table { border-collapse: collapse; width: 100%; }
        .print-accent { display: none; }

        /* ── Screen preview shell ─────────────────────────── */
        .report-shell {
          background: #94a3b8;
          min-height: 100vh;
          padding: 40px 24px;
        }
        .report-wrap {
          background: white;
          max-width: 860px;
          margin: 0 auto;
          padding: 32px 40px;
          box-shadow: 0 4px 32px rgba(0,0,0,0.18);
          border-radius: 4px;
        }

        /* ── Print: remove shell chrome ───────────────────── */
        @media print {
          .report-shell { background: white !important; padding: 0 !important; }
          .report-wrap  { box-shadow: none !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; border-radius: 0 !important; }
        }
      `}</style>

      {/* ── Top bar (screen only) ── */}
      <ReporteButtons />

      {/* Accent stripe — full-width, above the shell, only in print */}
      <div className="print-accent" style={{ height: 5, background: 'linear-gradient(90deg, #1e3a5f 0%, #2563eb 55%, #60a5fa 100%)' }} />

      <div className="report-shell">
      <div className="report-wrap space-y-6">

        {/* ══════════════════════════════════════════════
            ENCABEZADO
        ══════════════════════════════════════════════ */}
        <div className="flex items-start justify-between pb-4" style={{ borderBottom: '2px solid #1e293b' }}>
          <div className="flex items-center gap-3">
            {empresa?.logoUrl ? (
              <img src={empresa.logoUrl} alt="Logo" style={{ height: 48, width: 'auto', objectFit: 'contain' }} />
            ) : (
              <div style={{ width: 48, height: 48, background: '#1e293b', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 16 }}>GG</div>
            )}
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#1e293b' }}>{nombreEmpresa}</div>
              {empresa?.slogan && <div style={{ fontSize: 10, color: '#64748b' }}>{empresa.slogan}</div>}
              {empresa?.correo && <div style={{ fontSize: 9, color: '#94a3b8' }}>{empresa.correo}</div>}
              {empresa?.telefono && <div style={{ fontSize: 9, color: '#94a3b8' }}>{empresa.telefono}</div>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: 1 }}>Reporte de Control Presupuestario</div>
            <div style={{ fontSize: 9, color: '#64748b', marginTop: 4 }}>Emisión: {new Date().toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
            <div style={{ fontSize: 9, color: '#64748b' }}>Proyecto #{proyecto.id}</div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            DATOS DEL PROYECTO Y CLIENTE
        ══════════════════════════════════════════════ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Proyecto</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#1e293b' }}>{proyecto.nombre}</div>
            <div style={{ fontSize: 9, color: '#475569', marginTop: 2 }}>Tipo: {proyecto.tipoProyecto} · Estado: <strong>{proyecto.estado}</strong></div>
            {proyecto.ubicacion && <div style={{ fontSize: 9, color: '#475569' }}>Ubicación: {proyecto.ubicacion}</div>}
            {proyecto.responsable && <div style={{ fontSize: 9, color: '#475569' }}>Responsable: {proyecto.responsable}</div>}
            {proyecto.fechaInicio && <div style={{ fontSize: 9, color: '#475569' }}>Inicio: {formatDate(proyecto.fechaInicio)}</div>}
            {proyecto.fechaEstimada && <div style={{ fontSize: 9, color: '#475569' }}>Término est.: {formatDate(proyecto.fechaEstimada)}</div>}
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Cliente</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#1e293b' }}>{proyecto.cliente.nombre}</div>
            {proyecto.cliente.telefono && <div style={{ fontSize: 9, color: '#475569' }}>Tel: {proyecto.cliente.telefono}</div>}
            {proyecto.cliente.correo && <div style={{ fontSize: 9, color: '#475569' }}>Correo: {proyecto.cliente.correo}</div>}
            {proyecto.cliente.direccion && <div style={{ fontSize: 9, color: '#475569' }}>Dirección: {proyecto.cliente.direccion}</div>}
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            TOTALES GLOBALES (bloque destacado)
        ══════════════════════════════════════════════ */}
        <div>
          <div className="rpt-section" style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Totales del Proyecto</div>
          <div className="rpt-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            {/* Presupuestado */}
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 8, color: '#3b82f6', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Total Presupuestado</div>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#1e3a8a' }}>{formatCurrency(totalPresupuestado)}</div>
              <div style={{ fontSize: 8, color: '#64748b', marginTop: 2 }}>{capitulos.length} capítulos · {capitulos.reduce((s,c)=>s+c.partidas.length,0)} partidas</div>
            </div>
            {/* Gastado */}
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 8, color: '#ef4444', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Total Gastado</div>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#7f1d1d' }}>{formatCurrency(totalGastado)}</div>
              <div style={{ fontSize: 8, color: '#64748b', marginTop: 2 }}>{totalGastos} registros activos</div>
            </div>
            {/* Diferencia */}
            <div style={{ background: diferencia >= 0 ? '#f0fdf4' : '#fef2f2', border: `1px solid ${diferencia >= 0 ? '#bbf7d0' : '#fecaca'}`, borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 8, color: diferencia >= 0 ? '#16a34a' : '#dc2626', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
                {diferencia >= 0 ? 'Saldo Disponible' : 'Sobregiro'}
              </div>
              <div style={{ fontSize: 13, fontWeight: 900, color: diferencia >= 0 ? '#14532d' : '#7f1d1d' }}>
                {diferencia < 0 && '−'}{formatCurrency(Math.abs(diferencia))}
              </div>
              {gastosNoClasificados > 0 && (
                <div style={{ fontSize: 8, color: '#92400e', marginTop: 2 }}>Sin clasificar: {formatCurrency(gastosNoClasificados)}</div>
              )}
            </div>
            {/* % Ejecutado */}
            <div style={{ background: pctTotal >= 100 ? '#fef2f2' : pctTotal >= 80 ? '#fffbeb' : '#f0fdf4', border: `1px solid ${pctTotal >= 100 ? '#fecaca' : pctTotal >= 80 ? '#fde68a' : '#bbf7d0'}`, borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 8, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>% Ejecutado</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: pctTotal >= 100 ? '#dc2626' : pctTotal >= 80 ? '#d97706' : '#16a34a' }}>
                {pctTotal.toFixed(1)}%
              </div>
              <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(pctTotal, 100)}%`, background: pctTotal >= 100 ? '#ef4444' : pctTotal >= 80 ? '#f59e0b' : '#22c55e', borderRadius: 2 }} />
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            NIVEL 1 — RESUMEN POR CAPÍTULOS
        ══════════════════════════════════════════════ */}
        {capitulos.length > 0 && (
          <div>
            <div className="rpt-section" style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Nivel 1 — Resumen por Capítulos</div>
            <table>
              <thead>
                <tr style={{ background: '#1e293b', color: '#fff' }}>
                  <th style={{ textAlign: 'left', padding: '7px 10px', fontSize: 9, fontWeight: 700 }}>Capítulo</th>
                  <th style={{ textAlign: 'right', padding: '7px 10px', fontSize: 9, fontWeight: 700 }}>Presupuestado</th>
                  <th style={{ textAlign: 'right', padding: '7px 10px', fontSize: 9, fontWeight: 700 }}>Gasto Real</th>
                  <th style={{ textAlign: 'right', padding: '7px 10px', fontSize: 9, fontWeight: 700 }}>Diferencia</th>
                  <th style={{ textAlign: 'right', padding: '7px 10px', fontSize: 9, fontWeight: 700 }}>% Ejec.</th>
                </tr>
              </thead>
              <tbody>
                {capitulos.map((cap, i) => {
                  const pct = cap.totalPresupuestado > 0 ? (cap.totalGastoReal / cap.totalPresupuestado) * 100 : 0
                  return (
                    <tr key={cap.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 10px', fontSize: 10, fontWeight: 600, color: '#1e293b' }}>{cap.nombre}</td>
                      <td style={{ padding: '6px 10px', fontSize: 10, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(cap.totalPresupuestado)}</td>
                      <td style={{ padding: '6px 10px', fontSize: 10, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(cap.totalGastoReal)}</td>
                      <td style={{ padding: '6px 10px', fontSize: 10, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: cap.diferencia < 0 ? '#dc2626' : '#16a34a' }}>
                        {cap.diferencia < 0 && '−'}{formatCurrency(Math.abs(cap.diferencia))}
                      </td>
                      <td style={{ padding: '6px 10px', fontSize: 10, textAlign: 'right', fontWeight: 700, color: pct >= 100 ? '#dc2626' : pct >= 80 ? '#d97706' : '#16a34a' }}>
                        {pct.toFixed(1)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#334155', color: '#fff', borderTop: '2px solid #1e293b' }}>
                  <td style={{ padding: '8px 10px', fontSize: 10, fontWeight: 800 }}>TOTAL GENERAL</td>
                  <td style={{ padding: '8px 10px', fontSize: 10, fontWeight: 800, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(totalPresupuestado)}</td>
                  <td style={{ padding: '8px 10px', fontSize: 10, fontWeight: 800, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(totalGastado)}</td>
                  <td style={{ padding: '8px 10px', fontSize: 10, fontWeight: 800, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: diferencia < 0 ? '#fca5a5' : '#86efac' }}>
                    {diferencia < 0 && '−'}{formatCurrency(Math.abs(diferencia))}
                  </td>
                  <td style={{ padding: '8px 10px', fontSize: 10, fontWeight: 800, textAlign: 'right', color: pctTotal >= 100 ? '#fca5a5' : pctTotal >= 80 ? '#fde68a' : '#86efac' }}>
                    {pctTotal.toFixed(1)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            NIVEL 2 — DETALLE POR PARTIDAS
        ══════════════════════════════════════════════ */}
        {capitulos.length > 0 && (
          <div>
            <div className="rpt-section" style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Nivel 2 — Detalle por Partidas</div>

            {capitulos.map(cap => (
              <div key={cap.id} className="cap-block" style={{ marginBottom: 16 }}>
                {/* Chapter header row */}
                <div style={{ background: '#1e293b', color: '#fff', padding: '7px 10px', borderRadius: '6px 6px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{cap.nombre}</span>
                  <div style={{ display: 'flex', gap: 20, fontSize: 9 }}>
                    <span style={{ color: '#94a3b8' }}>Pres: <strong style={{ color: '#fff' }}>{formatCurrency(cap.totalPresupuestado)}</strong></span>
                    <span style={{ color: '#94a3b8' }}>Real: <strong style={{ color: '#fff' }}>{formatCurrency(cap.totalGastoReal)}</strong></span>
                    <span style={{ color: cap.diferencia < 0 ? '#fca5a5' : '#86efac' }}>
                      Dif: <strong>{cap.diferencia < 0 && '−'}{formatCurrency(Math.abs(cap.diferencia))}</strong>
                    </span>
                  </div>
                </div>

                {/* Partidas table */}
                <table style={{ borderRadius: '0 0 6px 6px', overflow: 'hidden' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ textAlign: 'left', padding: '5px 8px', fontSize: 8, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Cód.</th>
                      <th style={{ textAlign: 'left', padding: '5px 8px', fontSize: 8, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Descripción</th>
                      <th style={{ textAlign: 'center', padding: '5px 8px', fontSize: 8, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Und</th>
                      <th style={{ textAlign: 'right', padding: '5px 8px', fontSize: 8, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Cant.</th>
                      <th style={{ textAlign: 'right', padding: '5px 8px', fontSize: 8, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>P.U.</th>
                      <th style={{ textAlign: 'right', padding: '5px 8px', fontSize: 8, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Presupuestado</th>
                      <th style={{ textAlign: 'right', padding: '5px 8px', fontSize: 8, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Gasto Real</th>
                      <th style={{ textAlign: 'right', padding: '5px 8px', fontSize: 8, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Diferencia</th>
                      <th style={{ textAlign: 'right', padding: '5px 8px', fontSize: 8, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cap.partidas.map((p, i) => (
                      <tr key={p.id} style={{ background: p.pct >= 100 ? '#fff5f5' : i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '4px 8px', fontSize: 9, color: '#94a3b8', fontFamily: 'monospace' }}>{p.codigo ?? '—'}</td>
                        <td style={{ padding: '4px 8px', fontSize: 9, color: '#1e293b', fontWeight: 500, maxWidth: 220 }}>{p.descripcion}</td>
                        <td style={{ padding: '4px 8px', fontSize: 9, color: '#64748b', textAlign: 'center' }}>{p.unidad}</td>
                        <td style={{ padding: '4px 8px', fontSize: 9, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#475569' }}>
                          {p.cantidad.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '4px 8px', fontSize: 9, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#475569' }}>{formatCurrency(p.precioUnitario)}</td>
                        <td style={{ padding: '4px 8px', fontSize: 9, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(p.subtotalPresupuestado)}</td>
                        <td style={{ padding: '4px 8px', fontSize: 9, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(p.gastoReal)}</td>
                        <td style={{ padding: '4px 8px', fontSize: 9, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: p.diferencia < 0 ? '#dc2626' : p.gastoReal > 0 ? '#16a34a' : '#94a3b8' }}>
                          {p.diferencia < 0 && '−'}{formatCurrency(Math.abs(p.diferencia))}
                        </td>
                        <td style={{ padding: '4px 8px', fontSize: 9, textAlign: 'right', fontWeight: 700, color: p.pct >= 100 ? '#dc2626' : p.pct >= 80 ? '#d97706' : p.gastoReal > 0 ? '#16a34a' : '#94a3b8' }}>
                          {p.pct >= 999 ? '∞%' : `${p.pct.toFixed(0)}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#e2e8f0', borderTop: '1px solid #cbd5e1' }}>
                      <td colSpan={5} style={{ padding: '5px 8px', fontSize: 9, fontWeight: 700, color: '#334155' }}>Subtotal — {cap.nombre}</td>
                      <td style={{ padding: '5px 8px', fontSize: 9, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(cap.totalPresupuestado)}</td>
                      <td style={{ padding: '5px 8px', fontSize: 9, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(cap.totalGastoReal)}</td>
                      <td style={{ padding: '5px 8px', fontSize: 9, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: cap.diferencia < 0 ? '#b91c1c' : '#15803d' }}>
                        {cap.diferencia < 0 && '−'}{formatCurrency(Math.abs(cap.diferencia))}
                      </td>
                      <td style={{ padding: '5px 8px', fontSize: 9, fontWeight: 700, textAlign: 'right', color: cap.totalPresupuestado > 0 && (cap.totalGastoReal/cap.totalPresupuestado)*100 >= 100 ? '#b91c1c' : '#15803d' }}>
                        {cap.totalPresupuestado > 0 ? `${((cap.totalGastoReal / cap.totalPresupuestado) * 100).toFixed(0)}%` : '—'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ))}

            {/* ── Total general cierre ── */}
            <div style={{ background: '#1e293b', color: '#fff', borderRadius: 8, padding: '14px 16px', marginTop: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: 8, color: '#94a3b8', marginBottom: 3, textTransform: 'uppercase' }}>Total Presupuestado</div>
                  <div style={{ fontSize: 13, fontWeight: 900 }}>{formatCurrency(totalPresupuestado)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 8, color: '#94a3b8', marginBottom: 3, textTransform: 'uppercase' }}>Total Gastado</div>
                  <div style={{ fontSize: 13, fontWeight: 900 }}>{formatCurrency(totalGastado)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 8, color: '#94a3b8', marginBottom: 3, textTransform: 'uppercase' }}>{diferencia >= 0 ? 'Saldo Disponible' : 'Sobregiro'}</div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: diferencia < 0 ? '#fca5a5' : '#86efac' }}>
                    {diferencia < 0 && '−'}{formatCurrency(Math.abs(diferencia))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 8, color: '#94a3b8', marginBottom: 3, textTransform: 'uppercase' }}>% Ejecutado</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: pctTotal >= 100 ? '#fca5a5' : pctTotal >= 80 ? '#fde68a' : '#86efac' }}>
                    {pctTotal.toFixed(1)}%
                  </div>
                </div>
              </div>
              {gastosNoClasificados > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #334155', fontSize: 9, color: '#fde68a', textAlign: 'center' }}>
                  ⚠ Gastos sin partida asignada: {formatCurrency(gastosNoClasificados)} — no incluidos en el desglose por partidas
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sin datos */}
        {capitulos.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 12 }}>
            Este proyecto no tiene estructura presupuestaria cargada.<br />
            Ve a la pestaña &quot;Control presupuestario&quot; y usa &quot;Poblar desde presupuesto&quot;.
          </div>
        )}

        {/* ── Footer ── */}
        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12, textAlign: 'center', fontSize: 8, color: '#94a3b8' }}>
          <p>{nombreEmpresa} · Reporte generado el {new Date().toLocaleString('es-DO')}</p>
          <p style={{ marginTop: 2 }}>Documento de uso interno y confidencial.</p>
        </div>

      </div>{/* /report-wrap */}
      </div>{/* /report-shell */}
    </>
  )
}
