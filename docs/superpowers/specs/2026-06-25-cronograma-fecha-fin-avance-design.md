# Cronograma: fecha de fin proyectada y avance real

**Fecha:** 2026-06-25
**Estado:** Aprobado (pendiente plan de implementación)

## Problema

Los cronogramas no muestran una fecha estimada de fin, por lo que no se puede leer
el avance real contra un plazo. Aunque el modelo `Cronograma` ya tiene el campo
`fechaFinEstimado`, es **manual** y en la práctica siempre está vacío:

- El formulario de creación (`NuevoCronogramaForm`) no lo captura.
- No existe UI para editarlo después de crear el cronograma.
- La generación desde presupuesto explícitamente no lo toca (*"el usuario lo define"*).

Además, ya se calcula internamente la fecha de fin real (`max(actividad.fechaFin)`),
pero solo se usa para la alerta de "desbordamiento" contra la fecha del proyecto; no
se muestra como fecha de fin del cronograma.

No hay forma de editar el cronograma en sí (nombre, estado, fechas, etc.); solo se
editan las actividades.

## Objetivos

1. Mostrar una **fecha de fin proyectada** automática, siempre al día.
2. Permitir una **meta de entrega manual** opcional, para comparar plan vs proyección.
3. Mostrar el **avance real** del cronograma: esperado vs real, desviación en días y
   días transcurridos/restantes.
4. Permitir **editar el cronograma** (nombre, estado, fechas, proyecto, presupuesto,
   notas) desde un modal.

No-objetivos (fuera de alcance):

- Migración de BD (el campo `fechaFinEstimado` ya existe).
- Re-agendar actividades al cambiar la fecha de inicio del cronograma.
- Ponderar el avance por duración de actividad (queda como mejora futura).
- Cambiar la alerta de desbordamiento existente (se mantiene igual).

## Diseño

### 1. Dos fechas de fin

- **Fin proyectado (auto):** `max(actividad.fechaFin)` sobre todas las actividades.
  Ya se calcula en `app/cronograma/[id]/page.tsx` (variable `fechaFinCronograma`,
  usada hoy solo para el desbordamiento). Se eleva a dato visible. `null` si no hay
  actividades.
- **Meta de entrega (manual):** el campo `Cronograma.fechaFinEstimado` existente.
  Se le agrega UI para fijarla/editarla. Opcional.

### 2. Panel "Resumen de avance" (nuevo)

Banda nueva entre el encabezado y las tarjetas de stats en el detalle del cronograma.
Tres bloques:

- **Plan vs proyección:** badge con días de desviación = `fin proyectado − meta`
  (días calendario). Positivo = atrasado, negativo = adelantado, 0 = en fecha.
  Solo se muestra si hay meta definida.
- **Avance esperado vs real:** barra doble.
  - *Real* = avance general actual (promedio simple de `pctAvance` de las
    actividades — el cálculo `stats.pctGeneral` que ya existe).
  - *Esperado* = promedio simple sobre las actividades del `% esperado hoy`:
    - `0` si `hoy < fechaInicio`
    - `100` si `hoy > fechaFin`
    - en otro caso `((hoy − fechaInicio) / (fechaFin − fechaInicio)) * 100`
    - Para hitos (`fechaInicio == fechaFin`): `100` si `hoy >= fecha`, si no `0`.
  - Delta = `real − esperado`: *"X% por debajo del plan"* / *"X% por encima"* /
    *"al día"*.
- **Tiempo:** días transcurridos desde `fechaInicio` (recortado a ≥ 0) y días
  restantes hasta el fin proyectado. Si el fin proyectado ya pasó: *"vencido hace
  X días"*.

### 3. Modal "Editar cronograma" (nuevo)

Abierto desde un botón (icono lápiz) en el encabezado del detalle. Campos:

- **Nombre** (requerido)
- **Estado** (Planificado · En Ejecución · Terminado · Pausado)
- **Fecha de inicio**
- **Meta de entrega** (`fechaFinEstimado`) — único lugar donde se edita la meta
- **Proyecto** (select, opcional)
- **Presupuesto** (select, opcional)
- **Notas**

Usa el `PUT /api/cronograma/[id]` existente (ya acepta todos esos campos).
`router.refresh()` al guardar. Bloqueado en modo solo lectura (proyecto cerrado).

El panel "Resumen de avance" muestra la meta read-only; si no hay meta, ofrece un
enlace *"definir meta"* que abre este mismo modal (un solo camino de edición).

### 4. Arquitectura / archivos

- **`lib/cronograma-resumen.ts`** (nuevo): funciones puras que calculan el resumen
  (fin proyectado, avance esperado, desviación en días, transcurridos/restantes).
  Testeable con Vitest, siguiendo la convención de `lib/__tests__/`.
- **`lib/__tests__/cronograma-resumen.test.ts`** (nuevo): tests de las funciones puras,
  incluyendo casos borde.
- **`components/cronograma/ResumenAvance.tsx`** (nuevo, client): presenta el panel;
  recibe valores ya calculados; expone el enlace "definir meta" que abre el modal.
- **`components/cronograma/EditarCronogramaModal.tsx`** (nuevo, client): modal de
  edición; usa el `PUT` existente.
- **`app/cronograma/[id]/page.tsx`** (editar): calcula el resumen vía el helper, carga
  una lista liviana de proyectos (`id`, `nombre`) para el select del modal, y renderiza
  el panel + el botón/modal de edición en el encabezado.
- **`components/cronograma/NuevoCronogramaForm.tsx`** (editar): agregar campo opcional
  "Meta de entrega" (`fechaFinEstimado`) y enviarlo en el POST.
- **`app/cronograma/[id]/imprimir/page.tsx`** (editar): agregar al encabezado de
  impresión una línea con fin proyectado, meta y avance real vs esperado.

Sin cambios de schema ni de API (las rutas POST/PUT ya aceptan los campos necesarios).

## Casos borde

- **Sin actividades:** el panel muestra "Sin actividades aún"; no hay fin proyectado.
- **Antes del inicio** (`hoy < fechaInicio`): esperado 0%, 0 días transcurridos.
- **Completado** (avance real 100%): se indica como completado.
- **Fin proyectado ya pasado:** "vencido hace X días" en lugar de días restantes.
- **Solo lectura** (proyecto cerrado): no se puede editar la meta ni el cronograma.
- **Sin meta definida:** se omite el bloque "Plan vs proyección"; se muestra enlace
  "definir meta".

## Decisiones

- **Avance esperado = promedio simple** (no ponderado por duración), para igualar el
  método del avance real actual y mantener consistencia en la comparación.
- **Días en calendario** (no laborales) para transcurridos/restantes/esperado: más
  simple y suficiente para una lectura de salud.
- **Editar fecha de inicio no re-agenda actividades** — solo actualiza el registro,
  consistente con el comportamiento actual.
- La **meta se edita en un único lugar** (modal de edición), no inline en el panel.

## Verificación

- `npx tsc --noEmit` sin errores.
- `npm run lint` en 0 errores.
- `npm test` — pasan los tests nuevos de `cronograma-resumen`.
- Verificación manual en navegador: crear cronograma con/sin meta, editar cronograma,
  ver el panel con actividades en distintos estados (antes de inicio, en curso,
  atrasado, completado), vista de impresión.
