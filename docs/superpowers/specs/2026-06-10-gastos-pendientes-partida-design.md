# Gastos pendientes de asignar partida

## Problema

Los gastos creados automáticamente desde el módulo de Facturación (`app/api/contabilidad/facturas/route.ts`, al crear una factura tipo `egreso` con `proyectoId`) generan un `GastoProyecto` con `proyectoId` definido pero `partidaId` nulo (no se asigna a ninguna partida del presupuesto del proyecto).

Hoy, para asignar la partida a estos gastos, el usuario debe entrar al proyecto correspondiente (`/proyectos/[id]/gastos`) y editarlos uno por uno. No hay forma de identificarlos ni asignarlos desde el módulo global de Gastos (`/gastos`).

## Solución

Todo el cambio ocurre en `app/gastos/GastosPageClient.tsx` (sin cambios de API, ya que la lista de gastos se carga completa al cliente y se filtra con `useMemo`).

1. **Nuevo filtro "Pendiente de asignar partida"**
   - Criterio: `g.proyectoId != null && g.partidaId == null` (usar `g.partida == null` como en la interfaz `Gasto` existente).
   - Se agrega como una tarjeta/botón adicional junto a las de `DESTINO_CONFIG`, siguiendo el mismo patrón visual (tarjeta clickeable que activa/desactiva el filtro).
   - Muestra un contador con la cantidad de gastos en ese estado, calculado sobre el array `gastos` ya cargado.
   - Al activarse, se combina con los demás filtros existentes (`filtroDestino`, `filtroProyecto`, `filtroEstado`, `q`) dentro del mismo `useMemo` de `filtered`.

2. **Badge por fila**
   - En la tabla de gastos, cada fila donde `g.proyectoId != null && g.partida == null` muestra un badge visual (ej. amarillo, texto "Sin partida"), junto a los badges de `destinoTipo`/`estado` ya existentes.

3. **Asignación inline reutilizando `GastoForm`**
   - Al pulsar "editar" sobre uno de estos gastos (`openEdit`), se abre el `GastoForm` ya existente, igual que para cualquier otro gasto.
   - Verificar en pruebas manuales que el selector de partida aparece correctamente: `GastoForm` resuelve `pid = proyectoId ?? form.proyectoIdSeleccionado`, y `openEdit` ya setea `form.proyectoIdSeleccionado = g.proyectoId` para gastos con `destinoTipo: 'proyecto'`, por lo que el fetch a `/api/proyectos/[id]/partidas` debería dispararse y poblar el `<select>` de partida (líneas ~101-115 y ~297-318 de `GastoForm.tsx`).
   - Si en la prueba manual el selector no aparece o no guarda correctamente desde este contexto (sin `proyectoId` prop pasado al form), corregir `GastoForm.tsx` o el llamado en `GastosPageClient.tsx` (pasar `proyectoId={editing?.proyectoId}` al abrir el form) como fix puntual — no se anticipa de antemano si será necesario.

## Fuera de alcance

- No se modifica `app/api/gastos/route.ts` (no se necesita filtro server-side).
- No se modifica el modelo Prisma ni la lógica de creación de gastos desde Facturación.
- No se agrega una sección/pestaña separada — el filtro convive con la lista general.

## Verificación

- Manual en navegador (`npm run dev`): crear/usar una factura tipo egreso con proyecto asignado, confirmar que el gasto generado aparece marcado como "Sin partida" en `/gastos`, activar el filtro nuevo, editarlo, asignar una partida desde el form, y confirmar que desaparece de la lista filtrada y el badge se quita.
