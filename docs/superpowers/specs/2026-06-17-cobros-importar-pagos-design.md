# Cobros — Importar/Exportar lote de pagos — Diseño

**Fecha:** 2026-06-17
**Estado:** Aprobado para implementación
**Módulo:** Cobros (`/facturacion`) — facturas tipo `ingreso`

## Objetivo

Registrar un **lote de pagos (cobros)** desde Excel sobre facturas de venta
existentes, y poder **exportar**: (a) una plantilla de facturas pendientes para
llenar e importar, y (b) un historial de pagos ya registrados como reporte.

Reutiliza el patrón de importación masiva de Gastos (plantilla → preview con
validación por fila → confirmar en transacción).

## Exportar (dos botones en el header de Cobros)

1. **Plantilla de cobros** (`GET /api/export/cobros/plantilla`, permiso
   `contabilidad.ver`). Excel con las facturas `ingreso` de saldo pendiente
   (estado ≠ `pagada` ≠ `anulada`). Hoja "Cobros" con columnas:
   `factura_id`, `numero`, `ncf`, `cliente`, `proyecto`, `total`,
   `ya_cobrado`, `saldo_pendiente`, y columnas **vacías** para llenar:
   `fecha_pago`, `monto_pago`, `metodo_pago`, `cuenta_banco`, `referencia`,
   `observaciones`. Hoja "Instrucciones". Este archivo **es** el formato de import.
2. **Historial de pagos** (`GET /api/export/cobros/pagos`, permiso
   `contabilidad.ver`). Excel de los `PagoFactura` de facturas `ingreso`
   (fecha, factura, ncf, cliente, proyecto, monto, método, cuenta, referencia).
   Respeta filtros de la página: `q`, `desde`, `hasta` (por fecha de pago).

## Importar lote de pagos

Modal de 3 pasos (`ImportarPagosButton`, clonado de `ImportarGastosMasivoButton`):

1. **Descargar plantilla** → enlaza al export de plantilla.
2. **Subir → preview** (`POST /api/cobros/pagos/importar/preview`, permiso
   `contabilidad.editar`). Parsea, valida fila por fila y devuelve
   `{ filas, totales }`. Reglas por fila:
   - **Match de factura:** por `factura_id` si está presente; si no, por
     `numero` (debe resolver a exactamente **una** factura `ingreso` — 0 → "no
     encontrada", >1 → "ambiguo, usa factura_id").
   - Factura no `anulada`; proyecto asociado no cerrado.
   - `monto_pago` numérico > 0 y ≤ **saldo pendiente** de la factura,
     **acumulando** las filas previas del lote que apunten a la misma factura.
   - `fecha_pago` válida (YYYY-MM-DD o DD/MM/YYYY; vacía → hoy).
   - `metodo_pago` libre; default `Transferencia`.
   - `cuenta_banco` opcional: empareja por nombre (case-insensitive) con cuentas
     **activas**; si se especifica y no existe → error de fila.
   - `referencia`, `observaciones` opcionales.
3. **Confirmar** (`POST /api/cobros/pagos/importar`, permiso
   `contabilidad.editar`). Recibe solo las filas **válidas** (las de error se
   omiten en el cliente). En **una transacción**: crea cada `PagoFactura`,
   agrupa por factura para recalcular `montoPagado`/estado una vez por factura
   (sum de pagos), y crea el `MovimientoBancario` conciliado por cada pago con
   cuenta — misma lógica que el pago individual existente. Si la transacción
   falla, no se crea nada (red de seguridad).

**Errores:** filas con error se muestran en el preview y se **omiten**; se
importan solo las válidas (decisión del usuario).

## Arquitectura / archivos

- **`lib/cobros-import.ts`** — helpers puros: aliases de columnas, `parseFecha`,
  `parseMonto`, y `validarFilas(rows, { facturasPorId, facturasPorNumero,
  cuentasPorNombre })` → filas validadas con acumulación de saldo por factura.
- **`app/api/export/cobros/plantilla/route.ts`** — export plantilla pendientes.
- **`app/api/export/cobros/pagos/route.ts`** — export historial de pagos.
- **`app/api/cobros/pagos/importar/preview/route.ts`** — carga lookups + valida.
- **`app/api/cobros/pagos/importar/route.ts`** — confirma en transacción.
- **`components/contabilidad/ImportarPagosButton.tsx`** — modal multi-paso.
- Editar **`app/facturacion/page.tsx`** + **`FacturacionClient.tsx`** — 3 botones
  (Importar pagos, Exportar plantilla, Exportar historial) en el header.

## Alcance / decisiones

- Solo facturas `ingreso` (cobros). Egresos quedan fuera.
- RD$ (las facturas son RD$ por modelo).
- Máx 500 filas por importación (igual que Gastos).
- `parseFecha`/`parseMonto` se incluyen en `lib/cobros-import.ts` (pequeña
  duplicación respecto al preview de Gastos) para no tocar código que ya
  funciona; consolidar es deuda menor opcional.

## Deuda técnica respetada

Sin Zod (consistente con el repo). Validación manual por fila + sanity checks
en el confirm.
