import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { PrintButton } from './PrintButton'
import { calcularResumen } from '@/lib/cronograma-resumen'

export default async function CronogramaImprimirPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const numId = parseInt(id)
  if (isNaN(numId)) notFound()

  const cronograma = await prisma.cronograma.findUnique({
    where: { id: numId },
    include: {
      proyecto: { select: { nombre: true } },
      actividades: { orderBy: [{ orden: 'asc' }, { fechaInicio: 'asc' }] },
    },
  })
  if (!cronograma) notFound()

  const acts = cronograma.actividades
  const pctGeneral = acts.length > 0
    ? Math.round(acts.reduce((s, a) => s + a.pctAvance, 0) / acts.length)
    : 0
  const resumen = calcularResumen(acts, cronograma.fechaInicio, cronograma.fechaFinEstimado)

  // Agrupar por capítulo conservando orden de aparición
  const grupos: { capitulo: string; items: typeof acts }[] = []
  const indice = new Map<string, number>()
  for (const a of acts) {
    const key = a.capituloNombre || 'General'
    if (!indice.has(key)) { indice.set(key, grupos.length); grupos.push({ capitulo: key, items: [] }) }
    grupos[indice.get(key)!].items.push(a)
  }

  // ── Gantt visual (SVG, escalado para entrar en la hoja) ──
  const MS = 86_400_000
  const toUTC = (v: string | Date) => {
    const d = new Date(v)
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  }
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const LABEL_W = 210, TL_W = 540, ROW_H = 22, HEAD_H = 28
  const minT = acts.length ? Math.min(...acts.map(a => toUTC(a.fechaInicio))) : 0
  const maxT = acts.length ? Math.max(...acts.map(a => toUTC(a.fechaFin))) : 0
  const totalDays = Math.max(1, Math.round((maxT - minT) / MS) + 1)
  const pxDay = TL_W / totalDays
  const xOf = (t: number) => LABEL_W + ((t - minT) / MS) * pxDay

  // Líneas del Gantt: encabezado de grupo + una fila por tarea
  const lineas: ({ kind: 'grupo'; label: string } | { kind: 'tarea'; a: (typeof acts)[number] })[] = []
  for (const g of grupos) {
    lineas.push({ kind: 'grupo', label: g.capitulo })
    for (const a of g.items) lineas.push({ kind: 'tarea', a })
  }
  const svgH = HEAD_H + lineas.length * ROW_H + 6

  // Marcas de mes
  const ticks: { x: number; label: string }[] = []
  if (acts.length) {
    let y = new Date(minT).getUTCFullYear(), m = new Date(minT).getUTCMonth()
    let t = Date.UTC(y, m, 1)
    while (t <= maxT) {
      if (t >= minT) ticks.push({ x: xOf(t), label: `${MESES[new Date(t).getUTCMonth()]} ${new Date(t).getUTCFullYear()}` })
      m++; if (m > 11) { m = 0; y++ }
      t = Date.UTC(y, m, 1)
    }
    if (ticks.length === 0) ticks.push({ x: LABEL_W, label: `${MESES[new Date(minT).getUTCMonth()]} ${new Date(minT).getUTCFullYear()}` })
  }

  return (
    <div className="mx-auto max-w-[800px] bg-white text-slate-900 p-8 print:p-0">
      <style>{`@media print { .no-print { display: none !important; } @page { margin: 1.5cm; } }`}</style>

      {/* Barra de acción (no imprime) */}
      <div className="no-print flex justify-end mb-4">
        <PrintButton />
      </div>

      {/* Encabezado */}
      <header className="border-b-2 border-slate-800 pb-4 mb-6">
        <h1 className="text-2xl font-bold">{cronograma.nombre}</h1>
        {cronograma.proyecto && (
          <p className="text-sm text-slate-600 mt-1">Proyecto: {cronograma.proyecto.nombre}</p>
        )}
        <div className="flex flex-wrap gap-x-8 gap-y-1 mt-3 text-sm">
          <span>Inicio: <strong>{formatDate(cronograma.fechaInicio)}</strong></span>
          {resumen.finProyectado && (
            <span>Fin proyectado: <strong>{formatDate(resumen.finProyectado)}</strong></span>
          )}
          {cronograma.fechaFinEstimado && (
            <span>Meta de entrega: <strong>{formatDate(cronograma.fechaFinEstimado)}</strong></span>
          )}
          <span>Avance general: <strong>{pctGeneral}%</strong> (esperado {resumen.avanceEsperado}%)</span>
        </div>
        <div className="mt-2 h-2 w-full bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-slate-800" style={{ width: `${pctGeneral}%` }} />
        </div>
      </header>

      {/* Gantt visual */}
      {acts.length > 0 && (
        <section className="mb-6 break-inside-avoid">
          <h2 className="text-sm font-bold uppercase tracking-wide mb-2">Línea de tiempo</h2>
          <svg viewBox={`0 0 ${LABEL_W + TL_W} ${svgH}`} width="100%" style={{ maxWidth: LABEL_W + TL_W }} role="img">
            {/* Marcas de mes */}
            {ticks.map((tk, i) => (
              <g key={`t${i}`}>
                <line x1={tk.x} y1={HEAD_H - 4} x2={tk.x} y2={svgH} stroke="#e2e8f0" strokeWidth="1" />
                <text x={tk.x + 2} y={HEAD_H - 12} fontSize="9" fill="#64748b">{tk.label}</text>
              </g>
            ))}
            {/* Filas */}
            {lineas.map((ln, i) => {
              const y = HEAD_H + i * ROW_H
              if (ln.kind === 'grupo') {
                return <text key={`g${i}`} x="0" y={y + 15} fontSize="10" fontWeight="700" fill="#0f172a">{ln.label}</text>
              }
              const a = ln.a
              const x1 = xOf(toUTC(a.fechaInicio))
              const w = Math.max(3, xOf(toUTC(a.fechaFin)) - x1 + pxDay)
              const crit = !!a.esCritica && a.estado !== 'Completado'
              const nombre = a.nombre.length > 32 ? a.nombre.slice(0, 31) + '…' : a.nombre
              return (
                <g key={`a${i}`}>
                  <text x="10" y={y + 15} fontSize="9" fill="#334155">{nombre}</text>
                  {a.tipo === 'hito' ? (
                    <rect x={x1 - 4} y={y + 5} width="9" height="9" fill="#0f172a" transform={`rotate(45 ${x1} ${y + 9.5})`} />
                  ) : (
                    <>
                      <rect x={x1} y={y + 4} width={w} height="12" rx="2" fill="#e2e8f0"
                        stroke={crit ? '#dc2626' : 'none'} strokeWidth={crit ? 1 : 0} />
                      <rect x={x1} y={y + 4} width={Math.max(0, w * (a.pctAvance / 100))} height="12" rx="2"
                        fill={crit ? '#dc2626' : '#334155'} />
                    </>
                  )}
                </g>
              )
            })}
          </svg>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10px] text-slate-500">
            <span><span className="inline-block w-3 h-2 align-middle" style={{ background: '#334155' }} /> Avance</span>
            <span><span className="inline-block w-3 h-2 align-middle" style={{ background: '#e2e8f0' }} /> Pendiente</span>
            <span><span className="inline-block w-3 h-2 align-middle" style={{ background: '#dc2626' }} /> Ruta crítica</span>
            <span>◆ Hito</span>
          </div>
        </section>
      )}

      {/* Fases y actividades */}
      {grupos.map(g => (
        <section key={g.capitulo} className="mb-6 break-inside-avoid">
          <h2 className="text-sm font-bold uppercase tracking-wide bg-slate-800 text-white px-3 py-1.5 rounded">
            {g.capitulo}
          </h2>
          <table className="w-full text-sm mt-2 border-collapse">
            <thead>
              <tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-500">
                <th className="py-1.5 pr-2">Actividad</th>
                <th className="py-1.5 px-2 w-24">Inicio</th>
                <th className="py-1.5 px-2 w-24">Fin</th>
                <th className="py-1.5 px-2 w-16 text-right">Días</th>
                <th className="py-1.5 pl-2 w-20 text-right">Avance</th>
              </tr>
            </thead>
            <tbody>
              {g.items.map(a => (
                <tr key={a.id} className="border-b border-slate-100">
                  <td className="py-1.5 pr-2">
                    {a.tipo === 'hito' ? '◆ ' : ''}{a.nombre}
                  </td>
                  <td className="py-1.5 px-2 tabular-nums">{formatDate(a.fechaInicio)}</td>
                  <td className="py-1.5 px-2 tabular-nums">{formatDate(a.fechaFin)}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{a.tipo === 'hito' ? '—' : a.duracion}</td>
                  <td className="py-1.5 pl-2 text-right tabular-nums">{Math.round(a.pctAvance)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      {/* Hoja interna: cuadrillas, notas y materiales (compras / coordinación) */}
      {acts.some(a => a.cuadrilla || a.notas || a.materiales) && (
        <section className="mt-10" style={{ breakBefore: 'page' }}>
          <h2 className="text-lg font-bold border-b-2 border-slate-800 pb-2 mb-4">
            Detalles internos — cuadrillas, notas y materiales
          </h2>
          {grupos.map(g => {
            const items = g.items.filter(a => a.cuadrilla || a.notas || a.materiales)
            if (items.length === 0) return null
            return (
              <div key={g.capitulo} className="mb-5 break-inside-avoid">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">{g.capitulo}</h3>
                {items.map(a => (
                  <div key={a.id} className="mb-3 pl-3 border-l-2 border-slate-300 break-inside-avoid">
                    <p className="text-sm font-medium">
                      {a.tipo === 'hito' ? '◆ ' : ''}{a.nombre}
                      <span className="font-normal text-slate-500"> · {formatDate(a.fechaInicio)} – {formatDate(a.fechaFin)}</span>
                    </p>
                    {a.cuadrilla && (
                      <div className="text-sm mt-1">
                        <span className="font-medium text-slate-600">Cuadrillas: </span>
                        <span className="whitespace-pre-wrap">{a.cuadrilla}</span>
                      </div>
                    )}
                    {a.notas && (
                      <div className="text-sm mt-1">
                        <span className="font-medium text-slate-600">Notas: </span>
                        <span className="whitespace-pre-wrap">{a.notas}</span>
                      </div>
                    )}
                    {a.materiales && (
                      <div className="text-sm mt-1">
                        <span className="font-medium text-slate-600">Materiales: </span>
                        <span className="whitespace-pre-wrap">{a.materiales}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          })}
        </section>
      )}

      <footer className="mt-8 pt-4 border-t border-slate-200 text-xs text-slate-400">
        Generado el {formatDate(new Date())}
      </footer>
    </div>
  )
}
