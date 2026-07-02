/**
 * Schemas Zod centralizados para validación de bodies en API routes.
 *
 * Uso:
 *   const parsed = await parseBody(req, GastoCreateSchema)
 *   if (!parsed.ok) return parsed.response
 *   const data = parsed.data  // fully typed
 */

import { z } from 'zod'
import { NextResponse } from 'next/server'

// ── Helper ───────────────────────────────────────────────────────────────

type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse }

/**
 * Lee el body JSON del request y lo valida contra un schema Zod.
 * Devuelve un objeto discriminado (ok: true con datos, ok: false con 400).
 */
export async function parseBody<T>(
  req: Request,
  schema: z.ZodSchema<T>,
): Promise<ParseResult<T>> {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Body inválido (JSON malformado)' }, { status: 400 }),
    }
  }

  const result = schema.safeParse(json)
  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Datos inválidos',
          details: result.error.issues.map(i => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 },
      ),
    }
  }
  return { ok: true, data: result.data }
}

// ── Primitives reutilizables ─────────────────────────────────────────────

const optionalId = z.coerce.number().int().positive().optional().nullable()
const optionalString = z.string().trim().max(1000).optional().nullable()

// ── Gastos ───────────────────────────────────────────────────────────────

export const DESTINO_TIPOS = ['proyecto', 'oficina', 'taller', 'general', 'sin_asignar'] as const

/**
 * Schema para crear un gasto.
 * Nota: los campos de archivo (archivoUrl, etc.) se manejan por separado
 * porque vienen de multipart/form-data, no del body JSON.
 */
export const GastoCreateSchema = z.object({
  descripcion: z.string().trim().min(1, 'Descripción requerida'),
  fecha: z.coerce.date(),
  monto: z.coerce.number().finite().nonnegative(),
  moneda: z.string().trim().max(10).default('RD$'),
  destinoTipo: z.enum(DESTINO_TIPOS).default('proyecto'),
  tipoGasto: z.string().trim().max(100).default('Gasto menor'),
  referencia: optionalString,
  suplidor: optionalString,
  categoria: optionalString,
  subcategoria: optionalString,
  metodoPago: z.string().trim().max(50).default('Efectivo'),
  cuentaOrigen: optionalString,
  observaciones: optionalString,
  estado: z.string().trim().max(50).default('Registrado'),
  proyectoId: optionalId,
  partidaId: optionalId,
  recursoId: optionalId,
  cantidadRecurso: z.coerce.number().finite().optional().nullable(),
  movimientoStock: z.enum(['entrada', 'salida']).optional().nullable(),
})

export type GastoCreate = z.infer<typeof GastoCreateSchema>

/**
 * Schema para actualizar (PUT/PATCH). Todos los campos opcionales.
 */
export const GastoUpdateSchema = GastoCreateSchema.partial()
export type GastoUpdate = z.infer<typeof GastoUpdateSchema>

// ── Helpers para bodies que llegan de multipart/form-data ────────────────
// formData entrega TODO como string ('' incluido). Estos helpers normalizan
// preservando la distinción ausente (undefined) vs vacío ('' → null):
// clave para PUTs parciales donde "ausente" significa "no tocar el campo".

/** Texto opcional: '' → null (las rutas guardan null, no string vacío). */
const textoOpcional = z.preprocess(
  (v) => (v === '' ? null : v),
  z.string().trim().max(1000).nullable().optional(),
)

/** FK opcional: '' o null → null; string numérico → int positivo. */
const fkOpcional = z.preprocess(
  (v) => (v === '' || v === null ? null : v === undefined ? undefined : typeof v === 'number' ? v : parseInt(String(v), 10)),
  z.number().int().positive().nullable().optional(),
)

/** Monto: '' → undefined (usa default del schema); string numérico → number. */
const monto = (def: number) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : typeof v === 'number' ? v : Number(v)),
    z.number().finite().default(def),
  )

/** Monto en updates parciales: ausente → undefined (no tocar); '' → inválido. */
const montoOpcional = z.preprocess(
  (v) => (v === undefined ? undefined : typeof v === 'number' ? v : Number(v)),
  z.number().finite().optional(),
)

/** Fecha opcional: '' o null → null; string ISO → Date. */
const fechaOpcional = z.preprocess(
  (v) => (v === '' || v === null ? null : v),
  z.coerce.date().nullable().optional(),
)

// ── Cuentas bancarias ────────────────────────────────────────────────────

export const CuentaCreateSchema = z.object({
  nombre: z.string().trim().min(1, 'Nombre requerido'),
  banco: z.string().trim().min(1, 'Banco requerido'),
  numeroCuenta: textoOpcional,
  tipoCuenta: z.string().trim().max(50).default('corriente'),
  moneda: z.string().trim().max(10).default('RD$'),
  saldoInicial: monto(0),
})
export type CuentaCreate = z.infer<typeof CuentaCreateSchema>

export const CuentaUpdateSchema = z.object({
  nombre: z.string().trim().min(1).optional(),
  banco: z.string().trim().min(1).optional(),
  numeroCuenta: textoOpcional,
  tipoCuenta: z.string().trim().max(50).optional(),
  moneda: z.string().trim().max(10).optional(),
  saldoInicial: montoOpcional,
  activa: z.boolean().optional(),
})
export type CuentaUpdate = z.infer<typeof CuentaUpdateSchema>

// ── Facturas ─────────────────────────────────────────────────────────────

export const FacturaCreateSchema = z
  .object({
    tipo: z.enum(['ingreso', 'egreso'], { message: 'Tipo debe ser ingreso o egreso' }),
    // Para egreso el número es del proveedor (requerido, ver refine); para
    // ingreso se ignora: el número PRO-YYYY-NNNN se autogenera en el handler.
    numero: textoOpcional,
    ncf: textoOpcional,
    fecha: fechaOpcional,
    fechaVencimiento: fechaOpcional,
    proveedorId: fkOpcional,
    proveedor: textoOpcional,
    rncProveedor: textoOpcional,
    clienteId: fkOpcional,
    destinoTipo: z.string().trim().max(50).default('general'),
    proyectoId: fkOpcional,
    descripcion: textoOpcional,
    subtotal: monto(0),
    tasaItbis: monto(18),
    impuesto: monto(0),
    propinaLegal: monto(0),
    otrosImpuestos: monto(0),
    total: monto(0),
    observaciones: textoOpcional,
  })
  .refine((d) => d.tipo !== 'egreso' || (d.numero != null && d.numero.length > 0), {
    message: 'El número de factura es requerido',
    path: ['numero'],
  })
export type FacturaCreate = z.infer<typeof FacturaCreateSchema>

export const FacturaUpdateSchema = z.object({
  numero: z.string().trim().min(1, 'El número no puede quedar vacío').optional(),
  ncf: textoOpcional,
  tipo: z.enum(['ingreso', 'egreso']).optional(),
  fecha: fechaOpcional,
  fechaVencimiento: fechaOpcional,
  proveedor: textoOpcional,
  rncProveedor: textoOpcional,
  clienteId: fkOpcional,
  destinoTipo: z.string().trim().max(50).optional(),
  proyectoId: fkOpcional,
  descripcion: textoOpcional,
  subtotal: montoOpcional,
  tasaItbis: montoOpcional,
  impuesto: montoOpcional,
  propinaLegal: montoOpcional,
  otrosImpuestos: montoOpcional,
  total: montoOpcional,
  // Solo se acepta 'anulada' desde el body; los demás estados se derivan de
  // los pagos (recalcularEstadoFactura). Otros valores se ignoran en el handler.
  estado: z.string().trim().optional(),
  observaciones: textoOpcional,
  sharepointUrl: textoOpcional,
})
export type FacturaUpdate = z.infer<typeof FacturaUpdateSchema>

// ── Proyectos ────────────────────────────────────────────────────────────

export const ProyectoUpdateSchema = z.object({
  nombre: z.string().trim().min(1, 'Nombre requerido'),
  clienteId: z.coerce.number().int().positive({ message: 'Cliente requerido' }),
  tipoProyecto: z.string().trim().max(100).default('Remodelación'),
  ubicacion: textoOpcional,
  fechaInicio: fechaOpcional,
  fechaEstimada: fechaOpcional,
  estado: z.string().trim().max(50).default('Prospecto'),
  descripcion: z.string().trim().max(5000).optional().nullable(),
  responsable: textoOpcional,
  presupuestoEstimado: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : typeof v === 'number' ? v : Number(v)),
    z.number().finite().nullable(),
  ),
  avanceFisico: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? 0 : typeof v === 'number' ? v : parseInt(String(v), 10)),
    z.number().int().min(0).max(100),
  ),
  razonPausa: textoOpcional,
})
export type ProyectoUpdate = z.infer<typeof ProyectoUpdateSchema>
