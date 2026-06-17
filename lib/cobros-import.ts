// lib/cobros-import.ts
// Parseo + validación pura para la importación masiva de pagos (cobros).
// Sin dependencias de Prisma: recibe los lookups ya cargados por el endpoint,
// para poder testearse de forma aislada.

// ── Tipos ───────────────────────────────────────────────────────────────

export interface FacturaLookup {
  id: number
  numero: string
  estado: string            // pendiente | parcial | pagada | anulada
  total: number
  montoPagado: number
  clienteNombre: string | null
  proyectoCerrado: boolean
}

export interface CuentaLookup {
  id: number
  nombre: string
}

export interface LookupMaps {
  facturasPorId: Map<number, FacturaLookup>
  facturasPorNumero: Map<string, FacturaLookup | 'AMBIGUO'>
  cuentasPorNombre: Map<string, CuentaLookup>
}

export interface FilaPagoValidada {
  numFila: number                  // fila real del Excel (con header)
  facturaId: number | null
  facturaNumero: string | null
  clienteNombre: string | null
  fecha: string | null             // ISO
  monto: number
  metodoPago: string
  cuentaBancariaId: number | null
  cuentaNombre: string | null
  referencia: string | null
  observaciones: string | null
  saldoPendiente: number | null    // saldo de la factura ANTES de esta fila
  errores: string[]
}

export interface ResultadoValidacion {
  filas: FilaPagoValidada[]
  totales: { total: number; ok: number; conErrores: number; montoOk: number }
}

export type FilaRaw = Record<string, unknown>

// ── Aliases de columnas ─────────────────────────────────────────────────

const ALIASES: Record<string, string[]> = {
  factura_id:   ['factura_id', 'facturaid', 'id_factura', 'id'],
  numero:       ['numero', 'número', 'num', 'nro', 'factura', 'no_factura', 'numero_factura'],
  fecha_pago:   ['fecha_pago', 'fechapago', 'fecha', 'date'],
  monto_pago:   ['monto_pago', 'montopago', 'monto', 'pago', 'valor', 'importe', 'amount'],
  metodo_pago:  ['metodo_pago', 'metodopago', 'método', 'metodo', 'forma_pago', 'forma de pago'],
  cuenta_banco: ['cuenta_banco', 'cuentabanco', 'cuenta', 'banco', 'cuenta_bancaria'],
  referencia:   ['referencia', 'ref', 'recibo', 'documento'],
  observaciones:['observaciones', 'obs', 'notas', 'notes', 'comentarios'],
}

function getCelda(row: FilaRaw, campo: keyof typeof ALIASES): string {
  const aliases = ALIASES[campo] ?? [campo]
  for (const key of Object.keys(row)) {
    const norm = key.toLowerCase().trim().replace(/\s+/g, '_')
    if (aliases.includes(norm)) {
      const v = row[key]
      if (v == null) return ''
      return String(v).trim()
    }
  }
  return ''
}

// ── Parseo de fecha y monto (formatos comunes en RD) ────────────────────

export function parseFecha(raw: string): Date | null {
  if (!raw) return null
  let m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)               // YYYY-MM-DD
  if (m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
    return isNaN(d.getTime()) ? null : d
  }
  m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)                 // DD/MM/YYYY
  if (m) {
    const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]))
    return isNaN(d.getTime()) ? null : d
  }
  const num = parseFloat(raw)                                       // Excel serial
  if (!isNaN(num) && num > 30000 && num < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + num * 86_400_000)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

export function parseMonto(raw: string): number | null {
  if (!raw) return null
  const limpio = raw.replace(/[^\d.,-]/g, '')
  let normalizado: string
  if (limpio.includes(',') && limpio.includes('.')) {
    normalizado = limpio.replace(/,/g, '')
  } else if (limpio.includes(',') && !limpio.includes('.')) {
    normalizado = limpio.replace(',', '.')
  } else {
    normalizado = limpio
  }
  const n = parseFloat(normalizado)
  return isNaN(n) ? null : n
}

// ── Validación de filas ─────────────────────────────────────────────────

/**
 * Valida cada fila contra los lookups precargados. Acumula el monto aplicado
 * por factura dentro del mismo lote para no exceder el saldo pendiente cuando
 * varias filas apuntan a la misma factura.
 */
export function validarFilas(rows: FilaRaw[], maps: LookupMaps): ResultadoValidacion {
  const filas: FilaPagoValidada[] = []
  const aplicadoPorFactura = new Map<number, number>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    // Fila completamente vacía: ignorar
    const vacia = Object.values(row).map(v => String(v ?? '').trim()).join('') === ''
    if (vacia) continue

    const errores: string[] = []
    const idRaw = getCelda(row, 'factura_id')
    const numeroRaw = getCelda(row, 'numero')
    const fechaRaw = getCelda(row, 'fecha_pago')
    const montoRaw = getCelda(row, 'monto_pago')
    const metodoPago = getCelda(row, 'metodo_pago') || 'Transferencia'
    const cuentaRaw = getCelda(row, 'cuenta_banco')
    const referencia = getCelda(row, 'referencia') || null
    const observaciones = getCelda(row, 'observaciones') || null

    // ── Resolver factura ──
    let factura: FacturaLookup | null = null
    if (idRaw) {
      const id = parseInt(idRaw, 10)
      if (isNaN(id)) errores.push(`factura_id inválido ("${idRaw}")`)
      else {
        factura = maps.facturasPorId.get(id) ?? null
        if (!factura) errores.push(`No existe factura de ingreso con id ${id}`)
      }
    } else if (numeroRaw) {
      const hit = maps.facturasPorNumero.get(numeroRaw.toUpperCase())
      if (!hit) errores.push(`Factura "${numeroRaw}" no encontrada`)
      else if (hit === 'AMBIGUO') errores.push(`Varias facturas tienen el número "${numeroRaw}" — usa factura_id`)
      else factura = hit
    } else {
      errores.push('Falta factura_id o numero')
    }

    // ── Estado / proyecto cerrado ──
    if (factura) {
      if (factura.estado === 'anulada') errores.push(`Factura ${factura.numero} está anulada`)
      if (factura.proyectoCerrado) errores.push(`Factura ${factura.numero}: el proyecto está cerrado`)
    }

    // ── Fecha (vacía → hoy) ──
    let fecha: Date | null = null
    if (!fechaRaw) fecha = new Date()
    else {
      fecha = parseFecha(fechaRaw)
      if (!fecha) errores.push(`fecha_pago inválida ("${fechaRaw}")`)
    }

    // ── Monto vs saldo (acumulando lote) ──
    const monto = parseMonto(montoRaw)
    let saldoAntes: number | null = null
    if (monto == null) errores.push(`monto_pago inválido ("${montoRaw}")`)
    else if (monto <= 0) errores.push('monto_pago debe ser mayor a 0')
    else if (factura) {
      const yaAplicado = aplicadoPorFactura.get(factura.id) ?? 0
      saldoAntes = factura.total - factura.montoPagado - yaAplicado
      if (monto > saldoAntes + 0.01) {
        errores.push(`monto_pago (${monto.toFixed(2)}) excede el saldo pendiente (${saldoAntes.toFixed(2)})`)
      } else {
        aplicadoPorFactura.set(factura.id, yaAplicado + monto)
      }
    }

    // ── Cuenta bancaria (opcional) ──
    let cuentaBancariaId: number | null = null
    let cuentaNombre: string | null = null
    if (cuentaRaw) {
      const cuenta = maps.cuentasPorNombre.get(cuentaRaw.toUpperCase())
      if (!cuenta) errores.push(`Cuenta "${cuentaRaw}" no encontrada o inactiva`)
      else { cuentaBancariaId = cuenta.id; cuentaNombre = cuenta.nombre }
    }

    filas.push({
      numFila: i + 2,
      facturaId: factura?.id ?? null,
      facturaNumero: factura?.numero ?? (numeroRaw || null),
      clienteNombre: factura?.clienteNombre ?? null,
      fecha: fecha?.toISOString() ?? null,
      monto: monto ?? 0,
      metodoPago,
      cuentaBancariaId,
      cuentaNombre,
      referencia,
      observaciones,
      saldoPendiente: saldoAntes,
      errores,
    })
  }

  const ok = filas.filter(f => f.errores.length === 0)
  const conErrores = filas.filter(f => f.errores.length > 0)
  return {
    filas,
    totales: {
      total: filas.length,
      ok: ok.length,
      conErrores: conErrores.length,
      montoOk: ok.reduce((s, f) => s + f.monto, 0),
    },
  }
}
