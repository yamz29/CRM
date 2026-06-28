'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

interface Slice {
  label: string
  count: number
  colorHex: string
}

function DonutTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name?: string; value?: number }> }) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <span className="font-medium text-foreground">{p.name}: </span>
      <span className="tabular-nums text-foreground">{p.value}</span>
    </div>
  )
}

/**
 * Donut compacto para resúmenes de pipeline en el dashboard.
 * Las tarjetas clicables debajo actúan como leyenda + navegación.
 */
export function PipelineDonut({ data, totalLabel = 'Total' }: { data: Slice[]; totalLabel?: string }) {
  const chartData = data.filter((d) => d.count > 0)
  const total = data.reduce((s, d) => s + d.count, 0)

  if (total === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
        Sin datos para mostrar
      </div>
    )
  }

  return (
    <div className="relative h-40">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="count"
            nameKey="label"
            innerRadius={48}
            outerRadius={68}
            paddingAngle={2}
            strokeWidth={0}
            isAnimationActive={false}
          >
            {chartData.map((d) => (
              <Cell key={d.label} fill={d.colorHex} />
            ))}
          </Pie>
          <Tooltip content={<DonutTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl font-black text-foreground tabular-nums leading-none">{total}</span>
        <span className="text-2xs uppercase tracking-wider text-muted-foreground mt-1">{totalLabel}</span>
      </div>
    </div>
  )
}
