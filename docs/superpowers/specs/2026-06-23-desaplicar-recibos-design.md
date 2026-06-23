# Desaplicar recibos (Recibos Fase 4)

**Fecha:** 2026-06-23
**Estado:** Diseño aprobado, pendiente de implementación

## Problema

Hoy un recibo de cobro (`Recibo`) se reparte a facturas mediante `AplicacionRecibo`
(relación N..N). Las únicas operaciones existentes son:

- **Aplicar** (`POST /api/cobros/recibos/[id]/aplicar`): solo **suma** monto a una
  aplicación; si ya existe la línea factura↔recibo, le agrega. Nunca resta ni elimina.
- **Anular** (`POST /api/cobros/recibos/[id]/anular`): todo-o-nada. Borra *todas* las
  aplicaciones, borra el movimiento bancario asociado y marca el recibo como `anulado`.

No existe un punto intermedio. Si una aplicación se hizo a la factura equivocada, la
única salida es anular el recibo completo (perdiendo el movimiento bancario conciliado)
y rehacerlo. Es desproporcionado para un error de reparto.

## Objetivo

Permitir **desaplicar** una aplicación individual: quitar la línea que conecta un
recibo con una factura, sin tocar el monto recibido. Esto libera saldo del recibo
(queda como anticipo disponible) y baja el pagado de la factura. Combinado con el
botón "Aplicar" existente, permite mover dinero de la factura A a la B sin anular.

### Principio rector

- El **monto recibido** (`Recibo.monto`) representa dinero que entró y está conciliado;
  **no se edita** con esta feature.
- Lo que se vuelve flexible es el **reparto** (`AplicacionRecibo`).

## Alcance

### Incluido
- Endpoint para eliminar una aplicación individual.
- Recálculo automático de factura y recibo tras eliminar.
- UI de desaplicar en dos lugares: detalle de factura y modal de aplicar del recibo.

### Fuera de alcance (YAGNI)
- Reducir monto parcial de una aplicación (decidido: solo eliminar línea completa; si
  se quería dejar parte, se re-aplica con el botón existente).
- Editar monto / cliente / fecha del recibo después de conciliado.
- Trail de auditoría de desaplicaciones.
- Crear la página de detalle de recibo faltante (ver "Notas").

## Diseño

### Backend

Nuevo endpoint:

```
DELETE /api/cobros/recibos/[id]/aplicaciones/[aplicacionId]/route.ts
```

Pasos:

1. `checkPermiso(request, 'contabilidad', 'editar')` — mismo permiso que aplicar/anular.
2. Parsear y validar `id` (reciboId) y `aplicacionId`.
3. Buscar la `AplicacionRecibo` por `aplicacionId`. Si no existe → 404.
4. Verificar que `aplicacion.reciboId === id` (evita borrar la aplicación de otro
   recibo manipulando la URL) → si no coincide, 400/404.
5. Buscar el recibo; si está `anulado` → 400 (no se opera sobre recibos anulados).
6. `validarProyectoNoCerrado(factura.proyectoId)` — misma guarda que `aplicar`: no
   mover dinero en un proyecto cerrado. Requiere obtener `proyectoId` de la factura.
7. En `prisma.$transaction`:
   - `tx.aplicacionRecibo.delete({ where: { id: aplicacionId } })`
   - `recalcularFactura(tx, facturaId)` (helper existente en `lib/recibos.ts`)
   - `recalcularRecibo(tx, reciboId)` (helper existente en `lib/recibos.ts`)
8. Responder `{ ok: true }`.

Efectos del recálculo (ya implementados en los helpers):
- `Factura.montoPagado` = `SUM(AplicacionRecibo)` restante; `Factura.estado` recae a
  `pendiente`/`parcial` según corresponda.
- `Recibo.montoAplicado` baja; `Recibo.estado` recae a `parcial` o `sin_aplicar`,
  dejando el saldo disponible para re-aplicar.

Sin cambios de schema. La FK `AplicacionRecibo → Recibo` ya es `onDelete: Cascade`,
pero aquí se borra la fila explícitamente (no por cascada).

### Frontend

**Lado factura** — `components/contabilidad/FacturaDetalle.tsx`

En la sección "Cobros registrados" (lista de `factura.aplicaciones`, ~líneas 306-318),
cada fila gana un botón "Quitar":
- Abre `ConfirmDialog`.
- Al confirmar: `DELETE /api/cobros/recibos/{reciboId}/aplicaciones/{aplicacionId}`.
- Éxito → `useToast` + refrescar la factura.
- Solo visible si la factura no está anulada.

**Lado recibo** — `components/contabilidad/RecibosTab.tsx`

Extender `AplicarModal` para que, además del formulario de aplicar, **liste las
aplicaciones actuales** del recibo (factura + monto), cada una con un botón "Quitar":
- El modal ya se abre por recibo; obtener las aplicaciones actuales vía el
  `GET /api/cobros/recibos/[id]` existente (devuelve `aplicaciones.factura`).
- Al confirmar quitar: mismo `DELETE`, luego refrescar el modal y la lista de recibos.
- El botón disparador del modal sigue siendo "Aplicar" (sin cambios).

Ambos lados usan `useToast` + `ConfirmDialog` (convención del proyecto).

### Pruebas

- No requiere unit nuevos: la lógica de recálculo (`recalcularFactura`,
  `recalcularRecibo`, `estadoFactura`, `estadoRecibo`) ya está cubierta en
  `lib/__tests__/`.
- Verificación manual en navegador:
  1. Aplicar un recibo a 2 facturas.
  2. Quitar la aplicación de una factura desde el detalle de factura → la factura
     vuelve a `pendiente`/`parcial`, el recibo queda con saldo disponible.
  3. Quitar la otra desde el modal del recibo → el recibo vuelve a `sin_aplicar`.
  4. Confirmar que el monto recibido del recibo y el movimiento bancario no cambian.
  5. Confirmar que desaplicar está bloqueado si el proyecto de la factura está cerrado.

## Notas

- **Link roto detectado (fuera de alcance):** `FacturaDetalle.tsx` enlaza a
  `/cobros/recibos/{id}` (~línea 317), pero solo existe `/cobros/recibos/[id]/imprimir`
  — no hay `page.tsx` de detalle. Anotado para abordar por separado.
- **Despliegue:** sin migración de datos. En el VPS basta el deploy normal (no requiere
  `db:push` porque no cambia schema).
