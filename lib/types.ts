/**
 * Tipos de dominio compartidos, derivados del schema de Prisma (auditoría F3).
 *
 * Regla: los componentes NO redeclaran interfaces de modelos a mano; importan
 * de acá. Cada tipo refleja el `include/select` del endpoint o página que lo
 * produce — si cambias la query, cambia el tipo en un solo lugar.
 *
 * `Serializado<T>` modela el viaje por JSON (fetch a /api o
 * `JSON.parse(JSON.stringify(...))` en server components): las `Date` de
 * Prisma llegan al cliente como `string` ISO.
 */

import type { Prisma, CuentaBancaria } from '@prisma/client'

export type Serializado<T> = T extends Date
  ? string
  : T extends Array<infer U>
    ? Serializado<U>[]
    : T extends object
      ? { [K in keyof T]: Serializado<T[K]> }
      : T

// ── Referencias mínimas (selects de id+nombre, ubicuos en formularios) ────

export type ClienteRef = { id: number; nombre: string }
export type ProyectoRef = { id: number; nombre: string }

// ── Clientes ──────────────────────────────────────────────────────────────

/**
 * Listado de clientes con contadores — query de app/clientes/page.tsx.
 * Sin `Serializado`: llega como props RSC (server → client component), que
 * preserva los `Date`. Usar `Serializado<...>` solo para datos que viajan
 * por JSON (fetch o JSON.parse(JSON.stringify())).
 */
export type ClienteConResumen = Prisma.ClienteGetPayload<{
  include: { _count: { select: { proyectos: true; presupuestos: true } } }
}>

// ── Facturas ──────────────────────────────────────────────────────────────

/** Fila de listado — GET /api/contabilidad/facturas y app/contabilidad/page.tsx. */
export type FacturaLista = Serializado<
  Prisma.FacturaGetPayload<{
    include: {
      cliente: { select: { id: true; nombre: true } }
      proyecto: { select: { id: true; nombre: true } }
      _count: { select: { pagos: true } }
    }
  }>
>

/** Detalle con pagos y aplicaciones de recibo — GET /api/contabilidad/facturas/[id]. */
export type FacturaDetalleData = Serializado<
  Prisma.FacturaGetPayload<{
    include: {
      cliente: { select: { id: true; nombre: true } }
      proyecto: { select: { id: true; nombre: true } }
      pagos: {
        include: { cuentaBancaria: { select: { id: true; nombre: true; banco: true } } }
      }
      aplicaciones: {
        include: {
          recibo: {
            select: {
              id: true; numero: true; fecha: true; metodoPago: true
              referencia: true; observaciones: true
              cuentaBancaria: { select: { id: true; nombre: true; banco: true } }
            }
          }
        }
      }
    }
  }>
>

/** Resumen agregado que devuelve GET /api/contabilidad/facturas. */
export interface ResumenFacturas {
  totalIngresos: number
  totalEgresos: number
  cobrado: number
  pagado: number
  porCobrar: number
  porPagar: number
}

// ── Cuentas bancarias ─────────────────────────────────────────────────────

/** Cuenta con saldo calculado — GET /api/contabilidad/cuentas. */
export type CuentaBancariaConSaldo = Serializado<CuentaBancaria> & {
  _count?: { movimientos: number; pagos: number }
  saldoActual?: number
}

// ── Recibos ───────────────────────────────────────────────────────────────

/** Fila de listado — GET /api/cobros/recibos. */
export type ReciboLista = Serializado<
  Prisma.ReciboGetPayload<{
    include: {
      cliente: { select: { id: true; nombre: true } }
      cuentaBancaria: { select: { id: true; nombre: true } }
      _count: { select: { aplicaciones: true } }
    }
  }>
>
