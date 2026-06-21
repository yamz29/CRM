# Rediseño del módulo de Cronograma — vista unificada

**Fecha:** 2026-06-20
**Estado:** Aprobado (pendiente de plan de implementación)

## Problema

El módulo de cronograma se siente difícil de manejar y la vista confunde. Causas identificadas:

1. **Tres vistas conviviendo** en la misma pantalla (Gantt interactivo "V2", Gantt "Clásico" de solo lectura con frappe-gantt, y Tabla). El usuario no sabe cuál usar y se ven/comportan distinto.
2. **Deuda técnica V1/V2**: dos generaciones de componentes a medio migrar (`CronogramaClient`, `CronogramaV2Client`, `CronogramaGantt`, `ActividadesTable`, `ActividadesSpreadsheet`), lo que hace la experiencia inconsistente.
3. La línea de tiempo, la creación/orden de tareas, y la edición de fechas/dependencias resultan poco claras.

El usuario **sí quiere todas las capacidades** (seguimiento de avance, mostrar el plan al cliente, planificar fechas, y dependencias/ruta crítica). Por tanto el objetivo **no es recortar funciones**, sino consolidar y rehacer la UX.

## Alcance

- **Solo se reconstruye la capa de UI** de la pantalla de detalle del cronograma (`/cronograma/[id]`).
- **No se toca**: el modelo de datos (`Cronograma`, `ActividadCronograma`, `AvanceCronograma`), los endpoints (`/api/cronograma/*`), el motor de agendamiento/CPM (`lib/cronograma-scheduling.ts`), los tests de scheduling existentes, ni la lista `/cronograma`.
- **Cero cambios de base de datos.** Todos los campos requeridos ya existen (wbs, dependenciaId, tipoDependencia, desfaseDias, esCritica, holguraDias, cuadrilla, tipo hito/tarea, capituloNombre, orden, pctAvance, duracion, fechaInicio, fechaFin).

## Diseño

### Una sola vista
Se elimina el toggle de 3 vistas. Se consolida todo en un componente único, tomando como base la vista interactiva V2 (que ya soporta arrastre de barras) y sumándole la tabla agrupada + panel lateral. Se **retiran**: `CronogramaGantt` (frappe clásico), `ActividadesTable`, `ActividadesSpreadsheet`, el dropdown de vistas en `CronogramaClient`, y la dependencia `frappe-gantt` + `frappe-gantt.css` si quedan sin uso.

### Estructura de la pantalla (split sincronizado)
- **Izquierda — tabla agrupada por capítulo/fase:**
  - Grupos colapsables por `capituloNombre`.
  - Cada fila: nombre, fechas (inicio–fin), % de avance (mini-barra), marca "crítica" cuando `esCritica`.
  - Asa de arrastre para reordenar (`orden`).
  - Botón "añadir tarea/hito" por grupo y global.
- **Derecha — línea de tiempo sincronizada (Gantt):**
  - Una pista por fila, alineada a la tabla (misma altura/orden de fila).
  - Barras coloreadas por estado: Completado (teal/verde), En ejecución (azul), Atrasada/crítica (rojo), Pendiente (gris). El relleno de la barra refleja `pctAvance`.
  - Ruta crítica resaltada; dependencias como conector punteado al predecesor; hitos (`tipo='hito'`) como rombo.
  - Línea vertical de "hoy".
  - Columna izquierda fija (sticky) y scroll horizontal en la línea de tiempo para obras largas; el encabezado de escala también queda fijo arriba.

### Escala de tiempo: Día / Semana
- Selector en la toolbar para alternar la escala entre **Día** y **Semana**.
- **Vista por día:** cada columna del encabezado muestra día de semana + día/mes en minúsculas, formato `dom 21/6` (abreviaturas: dom, lun, mar, mié, jue, vie, sáb). Se resalta sutilmente fin de semana si `usarCalendarioLaboral`.
- **Vista por semana:** cada columna representa una semana; encabezado con la fecha de inicio de semana (ej. `21/6`).
- La escala (px por día) se deriva del modo seleccionado; el mapeo fecha↔píxel es un helper puro y testeable.

### Edición: panel lateral + arrastre
- Clic en una tarea (fila o barra) → **panel lateral (drawer)** con todos los campos: nombre, descripción, tipo (tarea/hito), fecha inicio, duración, dependencia + tipo (FS/SS/FF/SF), desfase (lag/lead), cuadrilla, capítulo, % de avance y registrar avance, y eliminar.
- **Arrastrar/estirar la barra** cambia fecha de inicio / duración → guarda vía `PUT /api/cronograma/[id]/actividades/[aid]` → el servidor recalcula agendamiento + CPM (cascade ya existente) → la vista refresca todas las actividades (patrón ya usado en `handleActualizarActividad`).

### Componentes (bien acotados)
- `CronogramaView` (client, top-level): estado de actividades, toolbar (añadir tarea/hito, generar desde presupuesto, escala Día/Semana, opciones de calendario), y layout del split.
- `CronogramaTabla`: lista agrupada, colapsable y reordenable (izquierda).
- `CronogramaTimeline`: encabezado de escala, barras, conectores de dependencia, hitos, línea de hoy, e interacción de arrastre (derecha).
- `ActividadPanel`: drawer de edición de una actividad.
- `lib/cronograma-escala.ts` (nuevo): helpers puros de fecha↔píxel, generación de columnas de escala (día/semana) y formato de encabezado (`dom 21/6`). Con tests unitarios.

### Casos borde
- Cronograma vacío → estado vacío con accesos a "Generar desde presupuesto" y "Añadir actividad".
- Proyecto cerrado → modo solo lectura (la API ya valida con `validarProyectoNoCerrado`; la UI deshabilita edición y arrastre).
- Obras largas → scroll horizontal con encabezado de escala y columna izquierda fijos.
- Dependencias circulares → las maneja el motor de agendamiento; el panel muestra el error devuelto por la API.
- Arrastre respetando calendario laboral/feriados → el servidor recalcula; la UI muestra el resultado del servidor (no calcula fechas laborales en cliente).

## Testing
- Helpers de escala (fecha↔píxel, columnas, formato de encabezado) cubiertos con tests unitarios en `lib/__tests__/`.
- Los tests de scheduling existentes se conservan sin cambios.
- Verificación manual en navegador para arrastre y panel (no hay framework e2e en el repo).

## Fuera de alcance
- Cambios de esquema o de la lógica de CPM.
- La pantalla de lista `/cronograma` y el flujo de creación (`/cronograma/nuevo`).
- Vista de impresión dedicada del cronograma (posible fase futura).
