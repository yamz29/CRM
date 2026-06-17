# Recibos de cobro (Recibo + Aplicación) — Diseño Fase 1

**Fecha:** 2026-06-17
**Estado:** Aprobado para implementación (Fase 1)
**Módulo:** Cobros (`/facturacion`) + Contabilidad + Informe Económico

## Problema

Hoy un pago está atado 1:1 a una factura (`PagoFactura.facturaId` obligatorio).
La realidad de cómo entra el dinero no es 1:1: anticipos antes de facturar, un
depósito que salda varias facturas, una factura pagada en abonos, pagos de
terceros, y dinero que entra sin factura. Además el Informe Económico cuenta
ingreso solo desde `PagoFactura`, así que los anticipos no aparecen como ingreso.

## Solución: Recibo + Aplicación (cash-receipt + allocation)

El **Recibo** es el dinero real que entró (hecho de caja). La **Aplicación**
reparte ese recibo sobre una o varias facturas. Lo no aplicado queda como
anticipo (saldo a cuenta del cliente).

### Frontera de alcance

`PagoFactura` se usa hoy para cobros (ingreso) **y** pagos a proveedores (egreso).
Este cambio reemplaza `PagoFactura` **solo en el lado ingreso**. Los pagos a
proveedores (egreso) **siguen con `PagoFactura` sin tocar**. Fuera de alcance:
egresos, vínculo extracto→recibo, importador masivo a recibos, PDF del recibo
(todo eso es Fase 2).

## Modelo de datos (schema.prisma)

```
model Recibo {
  id              Int      @id @default(autoincrement())
  numero          String   @unique          // REC-2026-0001 (MAX del año, como COT)
  clienteId       Int                        // requerido
  fecha           DateTime
  monto           Float
  metodoPago      String   @default("Transferencia")
  cuentaBancariaId Int?
  referencia      String?
  observaciones   String?
  montoAplicado   Float    @default(0)       // derivado (suma de aplicaciones)
  estado          String   @default("sin_aplicar") // sin_aplicar|parcial|aplicado|anulado
  createdBy       Int?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  cliente         Cliente  @relation(...)
  cuentaBancaria  CuentaBancaria? @relation(...)
  aplicaciones    AplicacionRecibo[]
  movimientos     MovimientoBancario[]       // crédito conciliado si hay cuenta
}

model AplicacionRecibo {
  id         Int      @id @default(autoincrement())
  reciboId   Int
  facturaId  Int
  monto      Float
  createdAt  DateTime @default(now())
  recibo     Recibo   @relation(..., onDelete: Cascade)
  factura    Factura  @relation(...)
  @@unique([reciboId, facturaId])
}
```

- `Factura.montoPagado` y `Factura.estado` **se conservan** (los leen ~29
  archivos); cambia quién los calcula: ahora `SUM(AplicacionRecibo.monto)` de la
  factura en vez de `SUM(PagoFactura.monto)`.
- `MovimientoBancario` gana `reciboId Int?` (además del `facturaId` existente).
- `Cliente`, `CuentaBancaria`, `Factura` ganan la relación inversa.

### Reglas de negocio

- Numeración `REC-YYYY-NNNN`: `MAX` del sufijo del año (no `count()`).
- `Recibo.montoAplicado = SUM(aplicaciones)`; estado:
  `0 → sin_aplicar`, `0<x<monto → parcial`, `x≈monto → aplicado`.
- No aplicar más que `monto - montoAplicado` del recibo, ni más que el saldo de
  la factura (`factura.total - factura.montoPagado`).
- Anular recibo: borra/invierte sus aplicaciones, recalcula las facturas
  afectadas y marca `estado=anulado`; revierte el movimiento bancario.
- Si el recibo trae `cuentaBancariaId`, se crea `MovimientoBancario` crédito
  conciliado (igual que el pago actual).

## Migración (script ts-node)

`prisma/migrate-recibos.ts`:
1. Por cada `PagoFactura` cuya factura es `tipo=ingreso`, crear un `Recibo`
   (cliente = `factura.clienteId`; fecha/monto/metodoPago/cuentaBancariaId/
   referencia/observaciones copiados) + una `AplicacionRecibo` a esa factura por
   el mismo monto. Numeración REC asignada por orden de fecha.
2. Repuntar `MovimientoBancario.reciboId` cuando el movimiento provenía de ese
   pago (match por facturaId+monto+fecha si es viable; si no, dejar null).
3. Recalcular `montoPagado`/estado de las facturas ingreso (debe quedar idéntico).
4. Los `PagoFactura` de egreso quedan intactos. Tras validar, los `PagoFactura`
   de ingreso pueden borrarse (o dejarse dormidos); el modelo `PagoFactura`
   permanece para egresos.

Idempotente: si ya existe un Recibo migrado para un pago (marca por
observaciones/referencia), no duplicar.

## API

- `POST /api/cobros/recibos` — crea recibo + aplicaciones opcionales (transacción,
  recalcula facturas, crea movimiento bancario). Permiso `contabilidad.editar`.
- `GET /api/cobros/recibos` — lista con filtros (cliente, estado, rango, q).
- `GET /api/cobros/recibos/[id]` — detalle con aplicaciones.
- `POST /api/cobros/recibos/[id]/aplicar` — aplica saldo a cuenta a facturas.
- `POST /api/cobros/recibos/[id]/anular` — anula y revierte.
- Lógica compartida en `lib/recibos.ts` (numeración, recálculo de factura,
  validación de aplicaciones) — sin Prisma donde sea puro, testeable.

## UI

- **Cobros (`/facturacion`)**: nueva sección/pestaña **Recibos** (lista + crear).
  Formulario de recibo: cliente, fecha, monto, método, cuenta, y aplicación
  opcional a facturas pendientes del cliente (selector con saldos). Saldo a
  cuenta visible.
- **`FacturaDetalle`**: el "registrar pago" actual pasa a "registrar/aplicar
  cobro": crea un recibo aplicado a esa factura, o aplica un recibo existente
  con saldo a cuenta del cliente.

## Informe Económico (cambia fuente de ingreso)

`lib/informe-economico-data.ts`:
- **Ingreso (base caja) = `Recibo` por su fecha** (no anulados). Los anticipos
  cuentan como ingreso. Reemplaza la consulta de `PagoFactura` ingreso.
- **Por proyecto**: atribución por `AplicacionRecibo → factura.proyectoId`; la
  parte no aplicada del recibo va a "Sin proyecto". El total de ingreso del
  período sigue siendo la suma de recibos.
- El lado gasto (incl. `PagoFactura` de egreso sin gasto) **no cambia**.

## Archivos

Schema (Recibo, AplicacionRecibo, relaciones, `MovimientoBancario.reciboId`) ·
`prisma/migrate-recibos.ts` · `lib/recibos.ts` · `app/api/cobros/recibos/*` ·
UI Recibos en Cobros + cambios en `FacturaDetalle` · `lib/informe-economico-data.ts`.

## Fase 2 (fuera de alcance)

Vincular crédito del extracto → recibo, adaptar el importador masivo de pagos a
recibos, PDF imprimible del recibo, saldo-a-cuenta como crédito aplicable desde
la UI con más detalle, recibos para egresos (pagos a proveedores).

## Deuda técnica respetada

Sin Zod (consistente con el repo). `db:push` sin migraciones formales (SQLite
dev). Recálculo de `montoPagado` por `SUM` para evitar condiciones de carrera.
