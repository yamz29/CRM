# Recibos de cobro — Implementation Plan (Fase 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar el flujo de recibos de cobro construido en Fase 1: aplicar anticipos existentes a facturas, imprimir el recibo (PDF), importar lotes como recibos, y convertir créditos del extracto en recibos.

**Architecture:** Sobre el modelo `Recibo` + `AplicacionRecibo` ya en producción. Reusa el endpoint `POST /api/cobros/recibos/[id]/aplicar` (ya existe), `lib/recibos.ts`, y los patrones de impresión/import de Fase 1. No hay cambios de schema salvo en la tarea de extracto (que solo usa el campo `MovimientoBancario.reciboId` ya existente).

**Tech Stack:** Next.js 16 (App Router), Prisma 5, TypeScript, Tailwind/shadcn, SheetJS (xlsx). Sin suite de tests: verificación con `npx tsc --noEmit`, `npm run lint`, `npm run build` (ignorar el error Prisma de prerender) + checks manuales. La base real corre en el VPS (PostgreSQL) — NO ejecutar migraciones/DB localmente; verificar solo con tsc/lint/build.

**Antecedente:** Spec/plan Fase 1 en `docs/superpowers/{specs,plans}/2026-06-17-recibos-cobros*`. Memoria: `recibos-cobros.md`.

---

## Decisiones ya tomadas (confirmar al retomar si cambian)

1. **Egresos con recibos** → FUERA de Fase 2 (sería Fase 3). Los pagos a proveedores siguen con `PagoFactura`.
2. **PDF del recibo** → vista A4 server-rendered shell-free (ruta `*/imprimir`), mismo patrón que `/gastos/informe/imprimir`. Contenido: encabezado de empresa, datos del recibo (número, fecha, cliente, monto, método, cuenta, referencia) y tabla de aplicaciones (factura → monto) + saldo a cuenta.
3. **Extracto → recibo** → al convertir un crédito bancario en recibo, el usuario elige el cliente manualmente; la aplicación a facturas es opcional (puede quedar como anticipo). Se enlaza `MovimientoBancario.reciboId`.
4. **Importador masivo → recibos** → cada fila del Excel se convierte en un recibo del cliente de la factura, aplicado a esa factura. Reusa `lib/cobros-import.ts` (parseo/validación) pero el confirm crea recibos en vez de `PagoFactura`.

---

## File Structure

- `components/contabilidad/RecibosTab.tsx` — **modificar**: botón "Aplicar" por fila + modal de aplicación (Tarea 1).
- `app/cobros/recibos/[id]/imprimir/page.tsx` + `PrintButton.tsx` — **crear**: vista PDF del recibo (Tarea 2).
- `app/api/cobros/recibos/[id]/route.ts` — ya devuelve el detalle con aplicaciones (lo usa la vista PDF).
- `lib/cobros-import.ts` — **modificar/extender**: helper para mapear filas → recibos (Tarea 3).
- `app/api/cobros/pagos/importar/route.ts` — **modificar**: el confirm crea recibos+aplicaciones (Tarea 3).
- `components/contabilidad/ImportarPagosButton.tsx` — **modificar**: textos/endpoint si cambia (Tarea 3).
- `components/contabilidad/ConvertirCreditoRecibo.tsx` — **crear**: modal para convertir un crédito del extracto en recibo (Tarea 4).
- `app/api/cobros/recibos/desde-movimiento/route.ts` — **crear**: endpoint que crea un recibo a partir de un `MovimientoBancario` crédito y lo enlaza (Tarea 4).
- La vista de movimientos (`app/contabilidad/cuentas/[id]/movimientos/...` o `ContabilidadClient` conciliación) — **modificar**: acción "Convertir en recibo" en créditos sin recibo (Tarea 4).

---

## Task 1: Botón "Aplicar" en la lista de recibos (PRIORIDAD)

Permite aplicar un recibo con saldo a cuenta (anticipo) a facturas pendientes después de creado. El backend ya existe: `POST /api/cobros/recibos/[id]/aplicar` con body `{ aplicaciones: [{ facturaId, monto }] }`.

**Files:**
- Modify: `components/contabilidad/RecibosTab.tsx`

- [ ] **Step 1: Añadir estado y acción "Aplicar" en cada fila con saldo > 0**

En la tabla de recibos de `RecibosTab.tsx`, en la columna de acciones (junto a "Anular"), añadir un botón "Aplicar" visible solo cuando `(r.monto - r.montoAplicado) > 0.01 && r.estado !== 'anulado'`. Al hacer clic, abre un modal de aplicación para ese recibo, guardando `reciboAplicar` (el recibo seleccionado) en estado.

- [ ] **Step 2: Modal de aplicación (reusa el patrón del form "Nuevo recibo")**

El modal:
1. Muestra: número de recibo, cliente, monto, **disponible** = `monto - montoAplicado`.
2. `fetch('/api/contabilidad/facturas?tipo=ingreso&clienteId=' + recibo.clienteId)`, filtra estados `!= 'pagada' && != 'anulada'`, muestra cada factura con su saldo (`total - montoPagado`) y un input numérico (igual que el form de nuevo recibo, líneas ~460-495 del componente).
3. Valida en cliente: suma de aplicaciones ≤ disponible, y cada una ≤ saldo de su factura; deshabilita "Aplicar" mientras sea inválido y muestra el motivo.
4. Al confirmar: `POST /api/cobros/recibos/${recibo.id}/aplicar` con `{ aplicaciones: filas.filter(monto>0) }`. En éxito: `toast.exito`, cierra modal, refetch de la lista. En error: `toast.error(data.error)`.

Reusar exactamente los mismos componentes visuales (inputs, validación, badges) que ya tiene el form de creación para no duplicar estilo. Si el bloque de "aplicar contra facturas" del form de creación se puede extraer a un sub-componente reutilizable (`AplicarFacturasFields`), hacerlo y usarlo en ambos lugares (creación y este modal) — DRY.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit` (exit 0) → `npm run lint` (0 errores) → `npm run build 2>&1 | grep "Compiled successfully"`.

- [ ] **Step 4: Commit**

```bash
git add components/contabilidad/RecibosTab.tsx
git commit -m "feat(recibos): aplicar anticipo existente a facturas desde la lista"
```
(Mensaje termina con: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`)

- [ ] **Step 5: Verificación manual (en el VPS / entorno con datos)**

Crear un recibo sin aplicar (anticipo) → en la lista, "Aplicar" → repartir a una factura pendiente del cliente → la factura pasa a parcial/pagada y el recibo a parcial/aplicado.

---

## Task 2: PDF imprimible del recibo

**Files:**
- Create: `app/cobros/recibos/[id]/imprimir/page.tsx`
- Create: `app/cobros/recibos/[id]/imprimir/PrintButton.tsx`
- Modify: `components/contabilidad/RecibosTab.tsx` (enlace "Imprimir" por fila)

- [ ] **Step 1: PrintButton (cliente)**

Copiar exactamente `app/gastos/informe/imprimir/PrintButton.tsx` a la nueva ruta (mismo botón `window.print()`).

- [ ] **Step 2: Página de impresión A4 (server component, shell-free)**

Crear `app/cobros/recibos/[id]/imprimir/page.tsx`. Es server component; al estar bajo `*/imprimir` el layout es sin sidebar (convención del repo). Carga el recibo con `prisma.recibo.findUnique({ where: { id }, include: { cliente: true, cuentaBancaria: true, aplicaciones: { include: { factura: { select: { numero: true, total: true } } } } } })` y `prisma.empresa.findFirst()`. Renderiza, con el mismo estilo A4 que `app/gastos/informe/imprimir/page.tsx` (max-w-[800px], header con nombre de empresa, secciones con `formatCurrency`/`formatDate`):
- Encabezado: empresa + "Recibo de Ingreso <numero>".
- Datos: fecha, cliente, método de pago, cuenta, referencia, **monto**.
- Tabla de aplicaciones: Factura | Monto aplicado. Pie: Saldo a cuenta = `monto - montoAplicado`.
- Botón PrintButton (print:hidden) + enlace "← Volver a Cobros".

Usar `formatCurrency`/`formatDate` de `@/lib/utils`.

- [ ] **Step 3: Enlace "Imprimir" en RecibosTab**

En cada fila de la lista, añadir un enlace `<a href={`/cobros/recibos/${r.id}/imprimir`} target="_blank">` con ícono `Printer`.

- [ ] **Step 4: Verificar y commit**

Run: `npx tsc --noEmit && npm run lint && npm run build 2>&1 | grep -E "Compiled successfully|recibos/\[id\]/imprimir"`.
```bash
git add "app/cobros/recibos/[id]/imprimir" components/contabilidad/RecibosTab.tsx
git commit -m "feat(recibos): vista PDF imprimible del recibo"
```

---

## Task 3: Importador masivo de pagos → crea recibos

Hoy `ImportarPagosButton` + `/api/cobros/pagos/importar` crean `PagoFactura`. Cambiar el confirm para que cada fila válida cree un **Recibo** (cliente = cliente de la factura) **aplicado** a esa factura. El preview y `lib/cobros-import.ts` (parseo/validación de saldos) se reusan casi igual.

**Files:**
- Modify: `app/api/cobros/pagos/importar/route.ts`
- Modify: `app/api/cobros/pagos/importar/preview/route.ts` (incluir `clienteId` de la factura en la fila validada)
- Modify: `lib/cobros-import.ts` (agregar `clienteId` a `FilaPagoValidada` y a `FacturaLookup`)
- Modify: `components/contabilidad/ImportarPagosButton.tsx` (texto del botón final; payload manda `clienteId`)

- [ ] **Step 1: Propagar `clienteId` de la factura por fila**

En `lib/cobros-import.ts`: añadir `clienteId: number | null` a `FacturaLookup` y a `FilaPagoValidada`; en `validarFilas`, copiar `factura.clienteId` a la fila. Marcar error de fila si la factura no tiene cliente (`clienteId == null`) — un recibo exige cliente. En `preview/route.ts`, seleccionar `cliente: { select: { id: true } }`/`clienteId` al cargar facturas y pasarlo al lookup.

- [ ] **Step 2: Confirm crea recibos**

En `app/api/cobros/pagos/importar/route.ts`, cambiar el cuerpo de la transacción: por cada fila, crear un `Recibo` (numero via `siguienteNumeroRecibo`, clienteId de la fila, fecha, monto, metodoPago, cuentaBancariaId, referencia) + una `AplicacionRecibo` a su factura, y `recalcularFactura(tx, facturaId)`. Crear el `MovimientoBancario` crédito con `reciboId` cuando haya cuenta (igual que `/api/cobros/recibos`). Agrupar la numeración por año como en `prisma/migrate-recibos.ts`. Reusar helpers de `@/lib/recibos`.

- [ ] **Step 3: Ajustar el componente**

`ImportarPagosButton.tsx`: el payload de confirm ya manda por fila lo necesario; asegurar que incluya `clienteId` (viene del preview). Cambiar el texto "Registrar N pago(s)" → "Registrar N cobro(s)/recibo(s)" si aplica. La plantilla/preview no cambian de formato.

- [ ] **Step 4: Verificar y commit**

Run: `npx tsc --noEmit && npm run lint && npm run build 2>&1 | grep "Compiled successfully"`.
```bash
git add lib/cobros-import.ts "app/api/cobros/pagos/importar" components/contabilidad/ImportarPagosButton.tsx
git commit -m "feat(recibos): importador masivo crea recibos+aplicaciones"
```

---

## Task 4: Convertir crédito del extracto en recibo

Permite tomar un `MovimientoBancario` tipo `credito` sin recibo y convertirlo en un recibo (eligiendo cliente, aplicación opcional a facturas), enlazando `movimiento.reciboId`.

**Files:**
- Create: `app/api/cobros/recibos/desde-movimiento/route.ts`
- Create: `components/contabilidad/ConvertirCreditoRecibo.tsx`
- Modify: la vista de movimientos de la cuenta (donde se listan los `MovimientoBancario`) para añadir la acción.

- [ ] **Step 1: Endpoint**

`POST /api/cobros/recibos/desde-movimiento` body `{ movimientoId, clienteId, aplicaciones?: [{facturaId, monto}] }`, permiso `contabilidad.editar`. En transacción: validar que el movimiento existe, es `credito`, y no tiene `reciboId`. Crear el recibo (fecha/monto/referencia del movimiento; metodoPago 'Transferencia'; cuentaBancariaId del movimiento), crear aplicaciones (validadas con `validarAplicaciones`) + `recalcularFactura`, y `update` del movimiento con `reciboId` y `conciliado: true`. Reusar `lib/recibos.ts`.

- [ ] **Step 2: Modal de conversión**

`ConvertirCreditoRecibo.tsx`: recibe el movimiento (id, monto, fecha, descripcion), muestra un select de cliente (recibe `clientes` como prop), y opcionalmente las facturas pendientes del cliente para aplicar (mismo sub-componente `AplicarFacturasFields` de Task 1). Al confirmar, llama al endpoint; `toast` + refresh.

- [ ] **Step 3: Acción en la lista de movimientos**

Localizar el componente que lista `MovimientoBancario` de una cuenta. En cada movimiento `tipo === 'credito' && !reciboId`, añadir botón "Convertir en recibo" que abre el modal. (Leer el componente primero para integrar sin romper la conciliación existente.)

- [ ] **Step 4: Verificar y commit**

Run: `npx tsc --noEmit && npm run lint && npm run build 2>&1 | grep "Compiled successfully"`.
```bash
git add app/api/cobros/recibos/desde-movimiento components/contabilidad/ConvertirCreditoRecibo.tsx
git commit -m "feat(recibos): convertir credito del extracto en recibo"
```

---

## Verificación final (gates del proyecto)

- [ ] `npx tsc --noEmit` → 0 errores
- [ ] `npm run lint` → 0 errores (warnings = deuda conocida)
- [ ] `npm run build` → "✓ Compiled successfully" (ignorar error Prisma de prerender)
- [ ] Manual: aplicar anticipo desde la lista; imprimir un recibo; importar un lote que cree recibos; convertir un crédito del extracto en recibo.

## Orden sugerido y notas

Ejecutar en orden 1 → 2 → 3 → 4 (la Tarea 1 es la prioridad del usuario). Las Tareas 1 y 2 son chicas y de alto valor; 3 y 4 son medianas. Extraer `AplicarFacturasFields` en la Tarea 1 paga dividendos en 4. **Egresos con recibos = Fase 3** (no aquí).
