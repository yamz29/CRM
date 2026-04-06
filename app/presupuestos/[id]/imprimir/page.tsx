import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import { PrintButton } from './PrintButton'

async function getPresupuesto(id: number) {
  return prisma.presupuesto.findUnique({
    where: { id },
    include: {
      cliente: true,
      proyecto: true,
      partidas: { orderBy: { orden: 'asc' } },
      modulosMelamina: { orderBy: { orden: 'asc' } },
      titulos: { orderBy: { orden: 'asc' } },
      indirectos: { orderBy: { orden: 'asc' } },
      capitulos: {
        orderBy: { orden: 'asc' },
        include: { partidas: { orderBy: { orden: 'asc' } } },
      },
    },
  })
}

export default async function ImprimirPresupuestoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) notFound()

  const [presupuesto, empresa] = await Promise.all([
    getPresupuesto(id),
    prisma.empresa.findFirst(),
  ])
  if (!presupuesto) notFound()

  const nombreEmpresa = empresa?.nombre || 'Gonzalva Group'

  const subtotalBase = presupuesto.capitulos.reduce(
    (acc, cap) => acc + cap.partidas.reduce((s, p) => s + p.subtotal, 0), 0
  )
  const indirectosActivos = presupuesto.indirectos.filter(l => l.activo)
  const subtotalIndirecto = indirectosActivos.reduce(
    (s, l) => s + subtotalBase * l.porcentaje / 100, 0
  )
  const subtotalObra = presupuesto.partidas.reduce((acc, p) => acc + p.subtotal, 0)
  const subtotalMelamina = presupuesto.modulosMelamina.reduce((acc, m) => acc + m.subtotal * m.cantidad, 0)

  // Descuento + ITBIS
  const subtotalAntesDescuento = subtotalBase + subtotalIndirecto
  const montoDescuento = presupuesto.descuentoTipo === 'porcentaje'
    ? subtotalAntesDescuento * presupuesto.descuentoValor / 100
    : presupuesto.descuentoTipo === 'fijo' ? presupuesto.descuentoValor : 0
  const subtotalConDescuento = subtotalAntesDescuento - montoDescuento
  const montoItbis = presupuesto.itbisActivo ? subtotalConDescuento * presupuesto.itbisPorcentaje / 100 : 0

  // Build titulo → capitulos map
  const tituloMap: Record<number, typeof presupuesto.capitulos> = {}
  const floating: typeof presupuesto.capitulos = []
  for (const cap of presupuesto.capitulos) {
    if (cap.tituloId != null) {
      if (!tituloMap[cap.tituloId]) tituloMap[cap.tituloId] = []
      tituloMap[cap.tituloId].push(cap)
    } else {
      floating.push(cap)
    }
  }

  const estadoColor: Record<string, string> = {
    Aprobado: '#16a34a', Enviado: '#2563eb', Rechazado: '#dc2626', Borrador: '#64748b',
  }
  const estadoBg: Record<string, string> = {
    Aprobado: '#dcfce7', Enviado: '#dbeafe', Rechazado: '#fee2e2', Borrador: '#f1f5f9',
  }

  return (
    <>
      <style>{`
        @page { size: A4 portrait; margin: 1.5cm; }

        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
          .no-print  { display: none !important; }
          .print-accent { display: block !important; }
          .report-shell { background: white !important; padding: 0 !important; }
          .report-wrap  { box-shadow: none !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; border-radius: 0 !important; }
          .cap-block { page-break-inside: avoid; break-inside: avoid; }
          tr { page-break-inside: avoid; break-inside: avoid; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
        }

        * { box-sizing: border-box; }
        body { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; font-size: 11px; line-height: 1.5; color: #0f172a; background: #f8fafc; margin: 0; }
        table { border-collapse: collapse; width: 100%; }
        .print-accent { display: none; }

        .report-shell {
          background: #94a3b8;
          min-height: 100vh;
          padding: 60px 24px 40px;
        }
        .report-wrap {
          background: white;
          max-width: 860px;
          margin: 0 auto;
          padding: 32px 40px;
          box-shadow: 0 4px 32px rgba(0,0,0,0.18);
          border-radius: 4px;
        }
      `}</style>

      {/* Top bar — screen only */}
      <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, background: 'white', borderBottom: '1px solid #e2e8f0', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <Link href={`/presupuestos/${presupuesto.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569', textDecoration: 'none' }}>
          <ArrowLeft style={{ width: 16, height: 16 }} />
          Volver al presupuesto
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: '#94a3b8', background: '#f1f5f9', padding: '3px 10px', borderRadius: 20 }}>Vista previa de impresión</span>
          <PrintButton />
        </div>
      </div>

      {/* Accent stripe — print only */}
      <div className="print-accent" style={{ height: 5, background: 'linear-gradient(90deg, #1e3a5f 0%, #2563eb 55%, #60a5fa 100%)' }} />

      <div className="report-shell">
      <div className="report-wrap">

        {/* ══ HEADER ══ */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '2px solid #1e293b', marginBottom: 20 }}>
          {/* Left — logo + company */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {empresa?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={empresa.logoUrl} alt="Logo" style={{ height: 48, width: 'auto', objectFit: 'contain' }} />
            ) : (
              <div style={{ width: 48, height: 48, background: '#1e293b', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 16 }}>GG</div>
            )}
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#1e293b' }}>{nombreEmpresa}</div>
              {empresa?.slogan && <div style={{ fontSize: 10, color: '#64748b', fontStyle: 'italic' }}>{empresa.slogan}</div>}
              <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {empresa?.rut      && <span style={{ fontSize: 9, color: '#94a3b8' }}>RNC: {empresa.rut}</span>}
                {empresa?.direccion && <span style={{ fontSize: 9, color: '#94a3b8' }}>{empresa.direccion}</span>}
                {empresa?.telefono  && <span style={{ fontSize: 9, color: '#94a3b8' }}>{empresa.telefono}</span>}
                {empresa?.correo    && <span style={{ fontSize: 9, color: '#94a3b8' }}>{empresa.correo}</span>}
              </div>
            </div>
          </div>
          {/* Right — document badge */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>Cotización</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#1e293b', lineHeight: 1 }}>{presupuesto.numero}</div>
            <div style={{ fontSize: 9, color: '#64748b', marginTop: 6 }}>
              Fecha de emisión: <strong style={{ color: '#334155' }}>{formatDate(presupuesto.createdAt)}</strong>
            </div>
            <div style={{ marginTop: 6 }}>
              <span style={{
                display: 'inline-block', fontSize: 8, fontWeight: 700,
                background: estadoBg[presupuesto.estado] ?? '#f1f5f9',
                color: estadoColor[presupuesto.estado] ?? '#64748b',
                padding: '2px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 1,
              }}>
                {presupuesto.estado}
              </span>
            </div>
          </div>
        </div>

        {/* ══ CLIENTE + PROYECTO ══ */}
        <div style={{ display: 'grid', gridTemplateColumns: presupuesto.proyecto ? '1fr 1fr' : '1fr', gap: 12, marginBottom: 24 }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Facturar a</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#1e293b' }}>{presupuesto.cliente.nombre}</div>
            {presupuesto.cliente.telefono  && <div style={{ fontSize: 9, color: '#475569', marginTop: 2 }}>Tel: {presupuesto.cliente.telefono}</div>}
            {presupuesto.cliente.correo    && <div style={{ fontSize: 9, color: '#475569' }}>Email: {presupuesto.cliente.correo}</div>}
            {presupuesto.cliente.direccion && <div style={{ fontSize: 9, color: '#475569' }}>{presupuesto.cliente.direccion}</div>}
          </div>
          {presupuesto.proyecto && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Proyecto</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#1e293b' }}>{presupuesto.proyecto.nombre}</div>
              {presupuesto.proyecto.tipoProyecto && <div style={{ fontSize: 9, color: '#475569', marginTop: 2 }}>{presupuesto.proyecto.tipoProyecto}</div>}
              {presupuesto.proyecto.ubicacion   && <div style={{ fontSize: 9, color: '#475569' }}>{presupuesto.proyecto.ubicacion}</div>}
            </div>
          )}
        </div>

        {/* ══ CAPÍTULOS ══ */}
        {presupuesto.capitulos.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
              Detalle del Presupuesto
            </div>

            {/* Titled groups */}
            {presupuesto.titulos.map(titulo => {
              const caps = (tituloMap[titulo.id] || []).filter(c => c.partidas.reduce((s, p) => s + p.subtotal, 0) > 0)
              if (caps.length === 0) return null
              const tituloTotal = caps.reduce((s, c) => s + c.partidas.reduce((ss, p) => ss + p.subtotal, 0), 0)
              return (
                <div key={titulo.id} style={{ marginBottom: 20 }}>
                  {/* Título row */}
                  <div style={{ background: '#0f172a', color: '#fff', padding: '8px 12px', borderRadius: '6px 6px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>{titulo.nombre}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(tituloTotal)}</span>
                  </div>
                  <div style={{ paddingLeft: 6, borderLeft: '3px solid #0f172a', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {caps.map(cap => <CapBlock key={cap.id} cap={cap} />)}
                  </div>
                </div>
              )
            })}

            {/* Floating chapters (no titulo) */}
            {floating.filter(cap => cap.partidas.reduce((s, p) => s + p.subtotal, 0) > 0).map(cap => (
              <div key={cap.id} style={{ marginBottom: 12 }}>
                <CapBlock cap={cap} />
              </div>
            ))}

            {/* Gastos Indirectos */}
            {indirectosActivos.length > 0 && (
              <div className="cap-block" style={{ marginBottom: 12 }}>
                <div style={{ background: '#475569', color: '#fff', padding: '7px 10px', borderRadius: '6px 6px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Gastos Indirectos</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#cbd5e1', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(subtotalIndirecto)}</span>
                </div>
                <table>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ textAlign: 'left', padding: '5px 8px', fontSize: 8, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Concepto</th>
                      <th style={{ textAlign: 'right', padding: '5px 8px', fontSize: 8, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', width: 100 }}>% sobre base</th>
                      <th style={{ textAlign: 'right', padding: '5px 8px', fontSize: 8, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', width: 120 }}>Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {indirectosActivos.map((l, li) => (
                      <tr key={l.id} style={{ background: li % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '4px 8px', fontSize: 9, color: '#1e293b' }}>{l.nombre}</td>
                        <td style={{ padding: '4px 8px', fontSize: 9, textAlign: 'right', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{l.porcentaje}%</td>
                        <td style={{ padding: '4px 8px', fontSize: 9, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(subtotalBase * l.porcentaje / 100)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#e2e8f0', borderTop: '1px solid #cbd5e1' }}>
                      <td colSpan={2} style={{ padding: '5px 8px', fontSize: 9, fontWeight: 700, textAlign: 'right', color: '#334155' }}>Total Gastos Indirectos</td>
                      <td style={{ padding: '5px 8px', fontSize: 9, fontWeight: 800, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(subtotalIndirecto)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══ LEGACY PARTIDAS ══ */}
        {presupuesto.partidas.length > 0 && (
          <div className="cap-block" style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Partidas de Obra</div>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
              <table>
                <thead>
                  <tr style={{ background: '#1e293b', color: '#fff' }}>
                    <th style={{ textAlign: 'left', padding: '7px 10px', fontSize: 9, fontWeight: 700, width: 28 }}>#</th>
                    <th style={{ textAlign: 'left', padding: '7px 10px', fontSize: 9, fontWeight: 700 }}>Descripción</th>
                    <th style={{ textAlign: 'center', padding: '7px 10px', fontSize: 9, fontWeight: 700, width: 50 }}>Und.</th>
                    <th style={{ textAlign: 'right', padding: '7px 10px', fontSize: 9, fontWeight: 700, width: 60 }}>Cant.</th>
                    <th style={{ textAlign: 'right', padding: '7px 10px', fontSize: 9, fontWeight: 700, width: 110 }}>P. Unitario</th>
                    <th style={{ textAlign: 'right', padding: '7px 10px', fontSize: 9, fontWeight: 700, width: 110 }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {presupuesto.partidas.map((p, i) => (
                    <tr key={p.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '4px 8px', fontSize: 9, color: '#94a3b8' }}>{i + 1}</td>
                      <td style={{ padding: '4px 8px', fontSize: 9, color: '#1e293b', fontWeight: 500 }}>{p.descripcion}</td>
                      <td style={{ padding: '4px 8px', fontSize: 9, textAlign: 'center', color: '#64748b' }}>{p.unidad}</td>
                      <td style={{ padding: '4px 8px', fontSize: 9, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#475569' }}>{p.cantidad.toLocaleString('en-US')}</td>
                      <td style={{ padding: '4px 8px', fontSize: 9, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#475569' }}>{formatCurrency(p.precioUnitario)}</td>
                      <td style={{ padding: '4px 8px', fontSize: 9, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(p.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#334155', color: '#fff', borderTop: '2px solid #1e293b' }}>
                    <td colSpan={5} style={{ padding: '7px 10px', fontSize: 10, fontWeight: 800, textAlign: 'right' }}>Subtotal Partidas</td>
                    <td style={{ padding: '7px 10px', fontSize: 10, fontWeight: 900, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(subtotalObra)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ══ MELAMINA ══ */}
        {presupuesto.modulosMelamina.length > 0 && (
          <div className="cap-block" style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Módulos de Melamina</div>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
              <table>
                <thead>
                  <tr style={{ background: '#1e293b', color: '#fff' }}>
                    <th style={{ textAlign: 'left', padding: '7px 10px', fontSize: 9, fontWeight: 700 }}>Tipo</th>
                    <th style={{ textAlign: 'left', padding: '7px 10px', fontSize: 9, fontWeight: 700 }}>Descripción</th>
                    <th style={{ textAlign: 'left', padding: '7px 10px', fontSize: 9, fontWeight: 700 }}>Dimensiones</th>
                    <th style={{ textAlign: 'right', padding: '7px 10px', fontSize: 9, fontWeight: 700, width: 50 }}>Cant.</th>
                    <th style={{ textAlign: 'right', padding: '7px 10px', fontSize: 9, fontWeight: 700, width: 110 }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {presupuesto.modulosMelamina.map((m, i) => (
                    <tr key={m.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '4px 8px', fontSize: 9 }}>
                        <span style={{ fontSize: 8, fontWeight: 700, background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 3 }}>{m.tipoModulo}</span>
                      </td>
                      <td style={{ padding: '4px 8px', fontSize: 9, color: '#1e293b', fontWeight: 500 }}>{m.descripcion}</td>
                      <td style={{ padding: '4px 8px', fontSize: 9, color: '#64748b' }}>{m.ancho}×{m.alto}×{m.profundidad} cm</td>
                      <td style={{ padding: '4px 8px', fontSize: 9, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#475569' }}>{m.cantidad}</td>
                      <td style={{ padding: '4px 8px', fontSize: 9, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(m.subtotal * m.cantidad)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#334155', color: '#fff', borderTop: '2px solid #1e293b' }}>
                    <td colSpan={4} style={{ padding: '7px 10px', fontSize: 10, fontWeight: 800, textAlign: 'right' }}>Subtotal Melamina</td>
                    <td style={{ padding: '7px 10px', fontSize: 10, fontWeight: 900, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(subtotalMelamina)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ══ TOTALES ══ */}
        <div style={{ background: '#1e293b', color: '#fff', borderRadius: 8, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 360, marginLeft: 'auto' }}>
            {subtotalBase > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8' }}>
                <span>Subtotal directo</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#e2e8f0' }}>{formatCurrency(subtotalBase)}</span>
              </div>
            )}
            {subtotalIndirecto > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8' }}>
                <span>Gastos indirectos</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#e2e8f0' }}>{formatCurrency(subtotalIndirecto)}</span>
              </div>
            )}
            {subtotalObra > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8' }}>
                <span>Subtotal partidas</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#e2e8f0' }}>{formatCurrency(subtotalObra)}</span>
              </div>
            )}
            {subtotalMelamina > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8' }}>
                <span>Subtotal melamina</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#e2e8f0' }}>{formatCurrency(subtotalMelamina)}</span>
              </div>
            )}
            {montoDescuento > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#f87171' }}>
                <span>Descuento{presupuesto.descuentoTipo === 'porcentaje' ? ` (${presupuesto.descuentoValor}%)` : ''}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>-{formatCurrency(montoDescuento)}</span>
              </div>
            )}
            {montoItbis > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8' }}>
                <span>ITBIS ({presupuesto.itbisPorcentaje}%){presupuesto.itbisPorcentaje === 1.8 ? ' — Norma 07-07' : ''}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#e2e8f0' }}>{formatCurrency(montoItbis)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #334155', paddingTop: 10, marginTop: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>TOTAL GENERAL</span>
              <span style={{ fontSize: 18, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(presupuesto.total)}</span>
            </div>
          </div>
        </div>

        {/* ══ NOTAS ══ */}
        {presupuesto.notas && (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', marginBottom: 20 }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Notas y condiciones</div>
            <p style={{ fontSize: 9, color: '#475569', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line' }}>{presupuesto.notas}</p>
          </div>
        )}

        {/* ══ VALIDEZ ══ */}
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginBottom: 24 }}>
          <p style={{ fontSize: 9, color: '#3b82f6', margin: 0, lineHeight: 1.55 }}>
            Esta cotización tiene una validez de <strong>30 días</strong> a partir de la fecha de emisión.
            Los precios están sujetos a cambios según disponibilidad de materiales.
          </p>
        </div>

        {/* ══ FIRMAS ══ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, paddingTop: 8, marginBottom: 24 }}>
          {[`Firma y sello — ${nombreEmpresa}`, 'Aceptación del cliente'].map(label => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ marginTop: 48, borderTop: '1.5px solid #94a3b8', paddingTop: 6 }}>
                <span style={{ fontSize: 9, color: '#64748b' }}>{label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ══ FOOTER ══ */}
        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12, textAlign: 'center' }}>
          <p style={{ fontSize: 8, color: '#94a3b8', margin: 0 }}>
            {nombreEmpresa} · {[empresa?.sitioWeb, empresa?.correo, empresa?.telefono].filter(Boolean).join(' · ')}
          </p>
          <p style={{ fontSize: 8, color: '#cbd5e1', margin: '2px 0 0' }}>Documento generado el {new Date().toLocaleString('es-DO')} · Confidencial</p>
        </div>

      </div>{/* /report-wrap */}
      </div>{/* /report-shell */}
    </>
  )
}

// ── Cap block component ──────────────────────────────────────────────────────

type Cap = {
  id: number
  codigo: string | null
  nombre: string
  partidas: {
    id: number
    codigo: string | null
    descripcion: string
    unidad: string
    cantidad: number
    precioUnitario: number
    subtotal: number
  }[]
}

function CapBlock({ cap }: { cap: Cap }) {
  const capTotal = cap.partidas.reduce((s, p) => s + p.subtotal, 0)
  return (
    <div className="cap-block" style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
      {/* Chapter header */}
      <div style={{ background: '#1e293b', color: '#fff', padding: '7px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {cap.codigo ? `${cap.codigo} – ` : ''}{cap.nombre}
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(capTotal)}</span>
      </div>

      {cap.partidas.length > 0 ? (
        <table>
          <thead>
            <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ textAlign: 'left', padding: '5px 8px', fontSize: 8, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', width: 28 }}>#</th>
              <th style={{ textAlign: 'left', padding: '5px 8px', fontSize: 8, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Descripción</th>
              <th style={{ textAlign: 'center', padding: '5px 8px', fontSize: 8, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', width: 48 }}>Und.</th>
              <th style={{ textAlign: 'right', padding: '5px 8px', fontSize: 8, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', width: 60 }}>Cant.</th>
              <th style={{ textAlign: 'right', padding: '5px 8px', fontSize: 8, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', width: 110 }}>P. Unitario</th>
              <th style={{ textAlign: 'right', padding: '5px 8px', fontSize: 8, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', width: 110 }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {cap.partidas.map((p, pi) => (
              <tr key={p.id} style={{ background: pi % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '4px 8px', fontSize: 9, color: '#94a3b8' }}>{pi + 1}</td>
                <td style={{ padding: '4px 8px', fontSize: 9, color: '#1e293b', fontWeight: 500 }}>
                  {p.codigo && <span style={{ fontFamily: 'monospace', fontSize: 8, color: '#94a3b8', marginRight: 6 }}>{p.codigo}</span>}
                  {p.descripcion}
                </td>
                <td style={{ padding: '4px 8px', fontSize: 9, textAlign: 'center', color: '#64748b' }}>{p.unidad}</td>
                <td style={{ padding: '4px 8px', fontSize: 9, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#475569' }}>
                  {p.cantidad.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                </td>
                <td style={{ padding: '4px 8px', fontSize: 9, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#475569' }}>{formatCurrency(p.precioUnitario)}</td>
                <td style={{ padding: '4px 8px', fontSize: 9, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(p.subtotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#e2e8f0', borderTop: '1px solid #cbd5e1' }}>
              <td colSpan={5} style={{ padding: '5px 8px', fontSize: 9, fontWeight: 700, textAlign: 'right', color: '#334155' }}>Subtotal {cap.nombre}</td>
              <td style={{ padding: '5px 8px', fontSize: 9, fontWeight: 800, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(capTotal)}</td>
            </tr>
          </tfoot>
        </table>
      ) : (
        <div style={{ padding: '10px', textAlign: 'center', fontSize: 9, color: '#94a3b8' }}>Sin partidas registradas</div>
      )}
    </div>
  )
}
