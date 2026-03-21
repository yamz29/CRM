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

  const subtotalObra = presupuesto.partidas.reduce((acc, p) => acc + p.subtotal, 0)
  const subtotalMelamina = presupuesto.modulosMelamina.reduce((acc, m) => acc + m.subtotal * m.cantidad, 0)
  const subtotalBase = presupuesto.capitulos.reduce(
    (acc, cap) => acc + cap.partidas.reduce((s, p) => s + p.subtotal, 0),
    0
  )
  const indirectoLineas = presupuesto.indirectos.filter((l) => l.activo)
  const subtotalIndirecto = indirectoLineas.reduce(
    (s, l) => s + subtotalBase * l.porcentaje / 100, 0
  )

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }

        /* ── Screen preview ── */
        .preview-shell {
          background: #94a3b8;
          min-height: 100vh;
          padding: 72px 24px 40px;
        }
        .print-page {
          font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
          font-size: 10.5px;
          line-height: 1.45;
          color: #1e293b;
          background: white;
          max-width: 210mm;
          margin: 0 auto;
          box-shadow: 0 4px 32px rgba(0,0,0,0.18);
        }

        /* ── Print overrides ── */
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
          .no-print { display: none !important; }
          .preview-shell { background: white !important; padding: 0 !important; }
          .print-page { box-shadow: none !important; margin: 0 !important; max-width: 100% !important; }
          @page { margin: 1.8cm 1.4cm 1.6cm; size: A4 portrait; }
          .page-break-before { page-break-before: always; }
          .avoid-break { page-break-inside: avoid; }
        }

        /* ── Typography scale ── */
        .doc-h1   { font-size: 15px; font-weight: 800; letter-spacing: -0.3px; }
        .doc-h2   { font-size: 11px; font-weight: 700; }
        .doc-label{ font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; }
        .doc-body { font-size: 10px; }
        .doc-small{ font-size: 9px; }
        .doc-num  { font-variant-numeric: tabular-nums; }

        /* ── Table base ── */
        .doc-table { width: 100%; border-collapse: collapse; }
        .doc-table th {
          font-size: 8.5px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.5px; padding: 5px 8px; border-bottom: 1px solid #cbd5e1;
          background: #f8fafc; color: #64748b;
        }
        .doc-table td { font-size: 10px; padding: 4px 8px; border-bottom: 1px solid #f1f5f9; }
        .doc-table tr:last-child td { border-bottom: none; }
        .doc-table tfoot td {
          font-size: 10px; font-weight: 700; padding: 6px 8px;
          border-top: 1.5px solid #cbd5e1; background: #f1f5f9;
        }

        /* ── Chapter header ── */
        .cap-header {
          display: flex; justify-content: space-between; align-items: center;
          background: #1e293b; color: white;
          padding: 6px 10px;
        }
        .cap-header-name { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        .cap-header-total { font-size: 10px; font-weight: 600; color: #94a3b8; }

        /* ── Accent stripe ── */
        .accent-top { height: 4px; background: linear-gradient(90deg, #1e3a5f 0%, #2563eb 60%, #60a5fa 100%); }

        /* ── Totals box ── */
        .totals-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e2e8f0; }
        .totals-final {
          display: flex; justify-content: space-between; align-items: center;
          background: #1e293b; color: white;
          padding: 9px 14px; margin-top: 8px;
        }
        .totals-final-label { font-size: 11px; font-weight: 800; letter-spacing: 0.5px; }
        .totals-final-value { font-size: 14px; font-weight: 900; }
      `}</style>

      {/* Top bar — screen only */}
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <Link href={`/presupuestos/${presupuesto.id}`}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Volver al presupuesto
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">Vista previa de impresión</span>
          <PrintButton />
        </div>
      </div>

      {/* Preview wrapper */}
      <div className="no-print preview-shell">
        <DocumentBody presupuesto={presupuesto} empresa={empresa}
          subtotalObra={subtotalObra} subtotalMelamina={subtotalMelamina}
          subtotalBase={subtotalBase} subtotalIndirecto={subtotalIndirecto} />
      </div>

      {/* Print-only output */}
      <div className="hidden print:block">
        <DocumentBody presupuesto={presupuesto} empresa={empresa}
          subtotalObra={subtotalObra} subtotalMelamina={subtotalMelamina}
          subtotalBase={subtotalBase} subtotalIndirecto={subtotalIndirecto} />
      </div>
    </>
  )
}

type PresupuestoWithRelations = NonNullable<Awaited<ReturnType<typeof getPresupuesto>>>

function DocumentBody({
  presupuesto, empresa, subtotalObra, subtotalMelamina, subtotalBase, subtotalIndirecto,
}: {
  presupuesto: PresupuestoWithRelations
  empresa: { nombre: string; rut: string | null; direccion: string | null; telefono: string | null; correo: string | null; sitioWeb: string | null; logoUrl: string | null; slogan: string | null } | null
  subtotalObra: number
  subtotalMelamina: number
  subtotalBase: number
  subtotalIndirecto: number
}) {
  const nombreEmpresa = empresa?.nombre || 'Gonzalva Group'

  const estadoStyle: Record<string, { bg: string; color: string }> = {
    Aprobado:  { bg: '#dcfce7', color: '#166534' },
    Enviado:   { bg: '#dbeafe', color: '#1d4ed8' },
    Rechazado: { bg: '#fee2e2', color: '#991b1b' },
  }
  const estadoColors = estadoStyle[presupuesto.estado] ?? { bg: '#f1f5f9', color: '#475569' }

  return (
    <div className="print-page">

      {/* ══ Accent top stripe ══ */}
      <div className="accent-top" />

      {/* ══ HEADER ══ */}
      <div style={{ padding: '24px 36px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '24px' }}>

        {/* Left — logo + company */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          {empresa?.logoUrl
            ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={empresa.logoUrl} alt="Logo" style={{ height: '52px', width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
            ) : (
              <div style={{ width: '52px', height: '52px', background: '#1e3a5f', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: 'white', fontWeight: 900, fontSize: '18px', letterSpacing: '-1px' }}>GG</span>
              </div>
            )
          }
          <div>
            <div className="doc-h1" style={{ color: '#0f172a' }}>{nombreEmpresa}</div>
            {empresa?.slogan && (
              <div style={{ fontSize: '9.5px', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}>{empresa.slogan}</div>
            )}
            <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {empresa?.rut && (
                <span className="doc-small" style={{ color: '#475569' }}>
                  <span style={{ fontWeight: 700 }}>RNC:</span> {empresa.rut}
                </span>
              )}
              {empresa?.direccion && <span className="doc-small" style={{ color: '#475569' }}>{empresa.direccion}</span>}
              {empresa?.telefono && <span className="doc-small" style={{ color: '#475569' }}>{empresa.telefono}</span>}
              {empresa?.correo && <span className="doc-small" style={{ color: '#475569' }}>{empresa.correo}</span>}
            </div>
          </div>
        </div>

        {/* Right — document badge */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ display: 'inline-block', background: '#1e3a5f', color: 'white', fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', padding: '3px 10px', borderRadius: '3px', marginBottom: '8px' }}>
            Cotización
          </div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{presupuesto.numero}</div>
          <div className="doc-small" style={{ color: '#64748b', marginTop: '5px' }}>
            Fecha de emisión: <span style={{ fontWeight: 600, color: '#334155' }}>{formatDate(presupuesto.createdAt)}</span>
          </div>
          <div style={{ marginTop: '6px' }}>
            <span style={{
              display: 'inline-block', fontSize: '8.5px', fontWeight: 700,
              background: estadoColors.bg, color: estadoColors.color,
              padding: '2px 8px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>
              {presupuesto.estado}
            </span>
          </div>
        </div>
      </div>

      {/* ══ CLIENT + PROJECT BAND ══ */}
      <div style={{ padding: '14px 36px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: presupuesto.proyecto ? '1fr 1fr' : '1fr', gap: '24px' }}>
        <div>
          <div className="doc-label" style={{ marginBottom: '5px' }}>Facturar a</div>
          <div className="doc-h2" style={{ color: '#0f172a', marginBottom: '3px' }}>{presupuesto.cliente.nombre}</div>
          {presupuesto.cliente.telefono && (
            <div className="doc-small" style={{ color: '#475569' }}>
              <span style={{ fontWeight: 600 }}>Tel:</span> {presupuesto.cliente.telefono}
            </div>
          )}
          {presupuesto.cliente.correo && (
            <div className="doc-small" style={{ color: '#475569' }}>
              <span style={{ fontWeight: 600 }}>Email:</span> {presupuesto.cliente.correo}
            </div>
          )}
          {presupuesto.cliente.direccion && (
            <div className="doc-small" style={{ color: '#475569' }}>{presupuesto.cliente.direccion}</div>
          )}
        </div>
        {presupuesto.proyecto && (
          <div style={{ borderLeft: '2px solid #e2e8f0', paddingLeft: '20px' }}>
            <div className="doc-label" style={{ marginBottom: '5px' }}>Proyecto</div>
            <div className="doc-h2" style={{ color: '#0f172a', marginBottom: '3px' }}>{presupuesto.proyecto.nombre}</div>
            {presupuesto.proyecto.tipoProyecto && (
              <div className="doc-small" style={{ color: '#64748b' }}>{presupuesto.proyecto.tipoProyecto}</div>
            )}
            {presupuesto.proyecto.ubicacion && (
              <div className="doc-small" style={{ color: '#475569', marginTop: '2px' }}>{presupuesto.proyecto.ubicacion}</div>
            )}
          </div>
        )}
      </div>

      {/* ══ BODY ══ */}
      <div style={{ padding: '20px 36px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* V2 CHAPTERS — grouped by Título */}
        {presupuesto.capitulos.length > 0 && (() => {
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

          const renderCap = (cap: (typeof presupuesto.capitulos)[number], ci: number) => {
            const capTotal = cap.partidas.reduce((s, p) => s + p.subtotal, 0)
            return (
              <div key={cap.id} className="avoid-break" style={{ border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                <div className="cap-header">
                  <span className="cap-header-name">
                    {cap.codigo ? `${cap.codigo} – ` : `${ci + 1}. `}{cap.nombre}
                  </span>
                  <span className="cap-header-total doc-num">{formatCurrency(capTotal)}</span>
                </div>
                {cap.partidas.length > 0 ? (
                  <table className="doc-table">
                    <thead>
                      <tr>
                        <th style={{ width: '28px', textAlign: 'left' }}>#</th>
                        <th style={{ textAlign: 'left' }}>Descripción</th>
                        <th style={{ width: '48px', textAlign: 'center' }}>Ud.</th>
                        <th style={{ width: '52px', textAlign: 'right' }}>Cant.</th>
                        <th style={{ width: '100px', textAlign: 'right' }}>P. Unitario</th>
                        <th style={{ width: '100px', textAlign: 'right' }}>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cap.partidas.map((p, pi) => (
                        <tr key={p.id} style={{ background: pi % 2 === 0 ? 'white' : '#fafafa' }}>
                          <td style={{ color: '#94a3b8', fontSize: '9px' }}>{pi + 1}</td>
                          <td style={{ color: '#334155' }}>
                            {p.codigo && (
                              <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#94a3b8', marginRight: '6px' }}>{p.codigo}</span>
                            )}
                            {p.descripcion}
                          </td>
                          <td style={{ textAlign: 'center', color: '#64748b' }}>{p.unidad}</td>
                          <td className="doc-num" style={{ textAlign: 'right', color: '#475569' }}>{p.cantidad.toLocaleString('en-US')}</td>
                          <td className="doc-num" style={{ textAlign: 'right', color: '#475569' }}>{formatCurrency(p.precioUnitario)}</td>
                          <td className="doc-num" style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{formatCurrency(p.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'right', color: '#475569' }}>Subtotal {cap.nombre}</td>
                        <td className="doc-num" style={{ textAlign: 'right', fontWeight: 900, color: '#0f172a' }}>{formatCurrency(capTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                ) : (
                  <div style={{ padding: '10px', textAlign: 'center', fontSize: '9.5px', color: '#94a3b8' }}>
                    Sin partidas registradas
                  </div>
                )}
              </div>
            )
          }

          let globalCapIdx = 0
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Titled sections */}
              {presupuesto.titulos.map((titulo) => {
                const caps = tituloMap[titulo.id] || []
                const tituloTotal = caps.reduce((s, c) => s + c.partidas.reduce((ss, p) => ss + p.subtotal, 0), 0)
                return (
                  <div key={titulo.id}>
                    {/* Título header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', color: 'white', padding: '7px 12px', borderRadius: '4px 4px 0 0', marginBottom: '2px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{titulo.nombre}</span>
                      <span className="doc-num" style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8' }}>{formatCurrency(tituloTotal)}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '6px', borderLeft: '3px solid #0f172a' }}>
                      {caps.map((cap) => renderCap(cap, globalCapIdx++))}
                    </div>
                  </div>
                )
              })}
              {/* Floating chapters (no titulo) */}
              {floating.map((cap) => renderCap(cap, globalCapIdx++))}

              {/* Gastos Indirectos section */}
              {presupuesto.indirectos.filter(l => l.activo).length > 0 && (
                <div className="avoid-break" style={{ border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#475569', color: 'white', padding: '6px 10px' }}>
                    <span style={{ fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Gastos Indirectos</span>
                    <span className="doc-num" style={{ fontSize: '10px', fontWeight: 600, color: '#cbd5e1' }}>{formatCurrency(subtotalIndirecto)}</span>
                  </div>
                  <table className="doc-table">
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>Concepto</th>
                        <th style={{ width: '80px', textAlign: 'right' }}>% sobre base</th>
                        <th style={{ width: '120px', textAlign: 'right' }}>Importe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {presupuesto.indirectos.filter(l => l.activo).map((l, li) => (
                        <tr key={l.id} style={{ background: li % 2 === 0 ? 'white' : '#fafafa' }}>
                          <td style={{ color: '#334155' }}>{l.nombre}</td>
                          <td className="doc-num" style={{ textAlign: 'right', color: '#64748b' }}>{l.porcentaje}%</td>
                          <td className="doc-num" style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{formatCurrency(subtotalBase * l.porcentaje / 100)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={2} style={{ textAlign: 'right', color: '#475569' }}>Total Gastos Indirectos</td>
                        <td className="doc-num" style={{ textAlign: 'right', fontWeight: 900, color: '#0f172a' }}>{formatCurrency(subtotalIndirecto)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )
        })()}

        {/* LEGACY PARTIDAS */}
        {presupuesto.partidas.length > 0 && (
          <div className="avoid-break">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ width: '14px', height: '3px', background: '#2563eb', borderRadius: '2px', display: 'inline-block' }} />
              <span className="doc-label">Partidas de Obra</span>
            </div>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <table className="doc-table">
                <thead>
                  <tr>
                    <th style={{ width: '28px', textAlign: 'left' }}>#</th>
                    <th style={{ textAlign: 'left' }}>Descripción</th>
                    <th style={{ width: '48px', textAlign: 'center' }}>Ud.</th>
                    <th style={{ width: '52px', textAlign: 'right' }}>Cant.</th>
                    <th style={{ width: '100px', textAlign: 'right' }}>P. Unitario</th>
                    <th style={{ width: '100px', textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {presupuesto.partidas.map((p, i) => (
                    <tr key={p.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ color: '#94a3b8', fontSize: '9px' }}>{i + 1}</td>
                      <td style={{ color: '#334155' }}>{p.descripcion}</td>
                      <td style={{ textAlign: 'center', color: '#64748b' }}>{p.unidad}</td>
                      <td className="doc-num" style={{ textAlign: 'right', color: '#475569' }}>{p.cantidad}</td>
                      <td className="doc-num" style={{ textAlign: 'right', color: '#475569' }}>{formatCurrency(p.precioUnitario)}</td>
                      <td className="doc-num" style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{formatCurrency(p.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'right', color: '#475569' }}>Subtotal Obra</td>
                    <td className="doc-num" style={{ textAlign: 'right', fontWeight: 900, color: '#0f172a' }}>{formatCurrency(subtotalObra)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* MELAMINA */}
        {presupuesto.modulosMelamina.length > 0 && (
          <div className="avoid-break">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ width: '14px', height: '3px', background: '#f59e0b', borderRadius: '2px', display: 'inline-block' }} />
              <span className="doc-label">Módulos de Melamina</span>
            </div>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <table className="doc-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Tipo</th>
                    <th style={{ textAlign: 'left' }}>Descripción</th>
                    <th style={{ width: '80px', textAlign: 'left' }}>Dimensiones</th>
                    <th style={{ width: '40px', textAlign: 'right' }}>Cant.</th>
                    <th style={{ width: '100px', textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {presupuesto.modulosMelamina.map((m, i) => (
                    <tr key={m.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td>
                        <span style={{ fontSize: '9px', fontWeight: 700, background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: '3px' }}>
                          {m.tipoModulo}
                        </span>
                      </td>
                      <td style={{ color: '#334155' }}>{m.descripcion}</td>
                      <td style={{ color: '#64748b', fontSize: '9px' }}>{m.ancho}×{m.alto}×{m.profundidad} cm</td>
                      <td className="doc-num" style={{ textAlign: 'right', color: '#475569' }}>{m.cantidad}</td>
                      <td className="doc-num" style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{formatCurrency(m.subtotal * m.cantidad)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'right', color: '#475569' }}>Subtotal Melamina</td>
                    <td className="doc-num" style={{ textAlign: 'right', fontWeight: 900, color: '#0f172a' }}>{formatCurrency(subtotalMelamina)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ══ TOTALS ══ */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px' }}>
          <div style={{ width: '280px' }}>
            {subtotalBase > 0 && (
              <div className="totals-row">
                <span style={{ fontSize: '10px', color: '#475569' }}>Subtotal directo</span>
                <span className="doc-num" style={{ fontSize: '10px', fontWeight: 600, color: '#334155' }}>{formatCurrency(subtotalBase)}</span>
              </div>
            )}
            {subtotalIndirecto > 0 && (
              <div className="totals-row">
                <span style={{ fontSize: '10px', color: '#475569' }}>Gastos indirectos</span>
                <span className="doc-num" style={{ fontSize: '10px', fontWeight: 600, color: '#334155' }}>{formatCurrency(subtotalIndirecto)}</span>
              </div>
            )}
            {subtotalObra > 0 && (
              <div className="totals-row">
                <span style={{ fontSize: '10px', color: '#475569' }}>Subtotal partidas</span>
                <span className="doc-num" style={{ fontSize: '10px', fontWeight: 600, color: '#334155' }}>{formatCurrency(subtotalObra)}</span>
              </div>
            )}
            {subtotalMelamina > 0 && (
              <div className="totals-row">
                <span style={{ fontSize: '10px', color: '#475569' }}>Subtotal melamina</span>
                <span className="doc-num" style={{ fontSize: '10px', fontWeight: 600, color: '#334155' }}>{formatCurrency(subtotalMelamina)}</span>
              </div>
            )}
            <div className="totals-final">
              <span className="totals-final-label">TOTAL GENERAL</span>
              <span className="doc-num totals-final-value">{formatCurrency(presupuesto.total)}</span>
            </div>
          </div>
        </div>

        {/* ══ NOTAS ══ */}
        {presupuesto.notas && (
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
            <div className="doc-label" style={{ marginBottom: '5px' }}>Notas y condiciones</div>
            <p style={{ fontSize: '10px', color: '#475569', lineHeight: '1.6', whiteSpace: 'pre-line' }}>{presupuesto.notas}</p>
          </div>
        )}

        {/* Validity */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '10px 14px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2563eb', flexShrink: 0, marginTop: '3px' }} />
          <p style={{ fontSize: '9.5px', color: '#64748b', lineHeight: '1.55', margin: 0 }}>
            Esta cotización tiene una validez de{' '}
            <span style={{ fontWeight: 700, color: '#334155' }}>30 días</span>{' '}
            a partir de la fecha de emisión. Los precios están sujetos a cambios según disponibilidad de materiales.
          </p>
        </div>

        {/* Signatures */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', paddingTop: '8px' }}>
          {['Firma y sello – Gonzalva Group', 'Aceptación del cliente'].map((label) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ marginTop: '48px', borderTop: '1.5px solid #94a3b8', paddingTop: '6px' }}>
                <span style={{ fontSize: '9px', color: '#64748b' }}>{label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ FOOTER ══ */}
      <div style={{ padding: '10px 36px', borderTop: '2px solid #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.5px' }}>{nombreEmpresa}</span>
        <span style={{ fontSize: '9px', color: '#cbd5e1' }}>
          {[empresa?.sitioWeb, empresa?.correo, empresa?.telefono].filter(Boolean).join('  ·  ')}
        </span>
      </div>
    </div>
  )
}
