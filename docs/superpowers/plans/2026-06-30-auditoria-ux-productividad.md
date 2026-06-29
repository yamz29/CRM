# Auditoría UX, UI y Productividad — Gonzalva Group CRM

> **Fecha:** 2026-06-30
> **Alcance:** UX/UI, flujos de trabajo, velocidad percibida, facilidad de uso, reducción de clics, optimización de procesos, organización de la información, productividad, calidad de interacción, gestión eficiente de datos.
> **Fuera de alcance (explícito):** Seguridad, autenticación, permisos, cifrado, vulnerabilidades, cumplimiento normativo y ciberseguridad.
> **Stack del producto auditado:** Next.js 16 (App Router) · React 19 · TypeScript · Prisma 5 · PostgreSQL · Tailwind · shadcn-ui custom · Lucide.
> **Empresa objetivo:** Constructora/remodeladora dominicana (RD$, NCF, ITBIS, DGII). Escala pequeña/mediana.

## Cómo leer este documento

Cada hallazgo está numerado (`#H01`, `#H02`...) y usa este formato:

- **Problema** — qué está pasando hoy
- **Por qué afecta** — el costo en productividad/usuario
- **Solución recomendada** — qué hacer concretamente
- **Beneficio esperado** — qué gana el usuario/empresa
- **Impacto:** 🔴 Alto · 🟠 Medio · 🟢 Bajo
- **Esfuerzo de implementación:** Bajo · Medio · Alto
- **Prioridad:** 🔥 Hacer inmediatamente · ⏭️ Próxima versión · 🛣️ Futuras mejoras

Al final hay una **matriz priorizada** con los top 20 hallazgos y una **sección de gaps vs líderes del mercado**.

---

## 0. Diagnóstico ejecutivo (TL;DR)

El producto es **sólido en su cobertura funcional** y ha madurado mucho en los últimos meses (toasts, ConfirmDialog, FinanzasNav, paginación server-side, plantillas de rol, OCR de gastos, búsqueda global Cmd+K). El código revela decisiones técnicas serias y un estilo shadcn limpio.

Sin embargo, desde la perspectiva **del usuario final**, la auditoría detecta tres patrones sistémicos que sabotean la productividad:

1. **Inconsistencia de patrones entre módulos** — los mismos verbos se resuelven con interacciones distintas según el módulo ("duplicar presupuesto" vs "duplicar OC", "asignar partida" en gastos vs popovers en tareas, badges de estado hechos a mano en unos sitios y reusando `Badge` en otros).
2. **Exceso de navegación cuando hay datos a la mano** — muchos listados (clientes, proyectos, presupuestos, tareas) son server components con `?search=` pero carecen de búsqueda en cliente, filtros persistentes y vistas alternativas (Kanban ya existe para proyectos, falta para presupuestos/clientes/tareas en contexto comercial).
3. **Densidad y ruido en pantallas críticas** — las páginas de detalle de proyecto y de presupuesto cargan demasiada información no priorizada; las acciones destructivas no siempre tienen confirmación; los estados se codifican a veces con texto (`Cancelado`), a veces con badges propios fuera del sistema, a veces con colores diferentes para el mismo significado (rojo=en pausa en proyectos, rojo=en error en otros lugares, etc.).

**Tres victorias rápidas que pagan solas toda la auditoría:**
- **#H08 — Búsqueda instantánea cliente + debounce** (cambia de 1.5s a ~50ms percibidos).
- **#H11 — Convertir las tablas con filtros client-side a URL-driven + paginación** (de 1-clic-a-error a poder compartir links; el patrón ya está en `/presupuestos`).
- **#H26 — Universalizar el `ConfirmDialog`** para las ~28 acciones destructivas restantes (tareas, empleados, presupuestos, OC, Rutas).

---

## 1. Navegación, estructura global y arquitectura de información

### #H01 · Sidebar con demasiados grupos y 18 ítems planos en `Finanzas + Operaciones`

**Problema:** La barra lateral (`components/layout/Sidebar.tsx`) tiene 5 grupos (Operaciones, Finanzas, Gestión, Taller, Sistema) con 19 ítems en total. Solo el grupo **Operaciones** (10 ítems) ya dobla el número recomendado para una nav vertical de SaaS (regla Nielsen: máximo 5–7 ítems visibles sin scroll). El grupo **Finanzas** tiene 3 ítems principales pero `FinanzasNav` se inyecta dentro de cada página y quedan 2 módulos ocultos (Cobros, Transacciones) que dependen del sub-nav.

**Por qué afecta:** Decisión cognitiva, scroll frecuente, descubribilidad pobre. Un usuario nuevo pasa más de 30 segundos buscando "dónde registro un cobro". El propio README del Plan UX Fase 2 reconoce que "NO se mueven rutas" como decisión consciente — pero eso deja un modelo mental bifurcado (sidebar ≠ sub-nav ≠ path).

**Solución recomendada:**
- Renombrar **"Finanzas" → "Operaciones financieras"** y consolidar su contenido en un solo dropdown con sub-ítems visibles al expandirse: Contabilidad · Cobros · Transacciones · Compras · Proveedores.
- Renombrar **"Gestión" → "Equipo"** (más natural en español).
- Mover **"Pipeline"** (Oportunidades) y **"Cronogramas"** debajo de **"Proyectos"** como ítems anidados (en algunos productos esto es un dropdown en cascada); en collapsed mode muestran como sub-íconos.
- Agregar **"Mi día"** o **"Bandeja"** como ítem destacado arriba de todo (ver #H33).
- Mantener `FinanzasNav` 3-entrada en cada página para quienes llegan por deep-link, pero el sidebar debe ser la fuente de verdad.

**Beneficio esperado:** Reducción del 40 % en el tiempo para alcanzar un módulo en usuarios nuevos; claridad para usuarios expertos.

- **Impacto:** 🔴 Alto
- **Esfuerzo:** Medio
- **Prioridad:** ⏭️ Próxima versión

---

### #H02 · Doble sistema "Ayuda" disperso y poco visible

**Problema:** Hay un `HelpDrawer` montado en algunas páginas (Recursos, Horas, Proyectos) mediante `<HelpDrawer slug="..." titulo="..." />`. Pero la mayoría de módulos (Clientes, Compras, Tareas, Melamina, Documentos) no lo tienen. La página `/ayuda` existe y hay 16+ documentos `.md` en `content/help/`, pero el botón lateral está al final del sidebar, agrupado bajo "Sistema".

**Por qué afecta:** Los tooltips contextuales son la mejor forma de reducir curva de aprendizaje, pero solo existen donde alguien se acordó de pegarlos.

**Solución recomendada:**
- Convertir el botón "Ayuda" del sidebar en un **botón flotante global** (FAB) en la esquina inferior derecha, que abre un panel lateral contextual: detecta la ruta actual y carga el slug correspondiente automáticamente.
- Si no hay contenido para esa ruta, ofrece buscador sobre todos los `.md` de `content/help/`.
- En `HelpDrawer` agregar upvote "¿Te fue útil?" y tasa de uso por documento.

**Beneficio esperado:** Activación de onboarding 3× mayor; menos tickets "¿cómo hago X?".

- **Impacto:** 🟠 Medio
- **Esfuerzo:** Medio
- **Prioridad:** ⏭️ Próxima versión

---

### #H03 · Búsqueda global excelente pero demasiado corta (`Cmd+K`)

**Problema:** `CommandPalette` (`components/layout/CommandPalette.tsx`) ya está implementado, con `Cmd/Ctrl+K`, navegación por teclado, agrupamiento y quick actions. Es **mejor que el 80 % de los CRM del mercado**. Pero: a) al abrirse con input vacío muestra solo 5 quick actions, debería mostrar también acciones recientes del usuario; b) el placeholder dice "Buscar clientes, proyectos..." pero solo busca esos 4 — falta **tareas, recursos, empleados, gastos, melamina**; c) los quick actions son fijos y no se adaptan al contexto (si estoy en una pantalla de proyecto, debería ofrecer "Crear tarea para este proyecto").

**Por qué afecta:** El command palette es la herramienta #1 de productividad en SaaS modernos. Subutilizado = tiempo perdido en navegación lateral.

**Solución recomendada:**
- Agregar `tareas`, `recursos`, `empleados`, `gastos`, `módulos melamina` al endpoint `/api/search`.
- Implementar **búsqueda fuzzy** (Fuse.js, ~5KB gzipped) con tolerancia a typos y ranking por uso reciente.
- Mostrar **"Recientes"** cuando el input está vacío (basado en últimas 10 visitas; storage local).
- Si la ruta actual tiene un ID (`/proyectos/123`), inyectar quick actions contextuales: "Crear tarea para este proyecto", "Registrar gasto", "Abrir cronograma".

**Beneficio esperado:** -60 % tiempo para llegar a una ficha específica en usuarios frecuentes.

- **Impacto:** 🔴 Alto
- **Esfuerzo:** Bajo-Medio (el shell ya está; es extender la fuente de datos)
- **Prioridad:** 🔥 Hacer inmediatamente

---

### #H04 · Inconsistencia: rutas en singular o plural según el módulo

**Problema:** La convención del codebase es español y predominantemente **plural** (`/clientes`, `/proyectos`, `/presupuestos`), pero hay excepciones: `/cronograma` (singular) y `/melamina` (singular), mientras que el menú lateral los llama **"Cronogramas"** y **"Módulos Melamina"**. `/horas` tampoco concuerda con "Horas del Equipo".

**Por qué afecta:** Inconsistencia de paths rompe la memoria muscular. Un usuario que aprendió `/presupuestos/nuevo` va a probar `/cronograma/nuevo` y... funciona, pero `/melamina/nuevo` lo manda a otro `/melamina/nuevo/page.tsx` y la pantalla tiene copy distinto ("Form simplificado (sin costos)" vs el form completo de `/recursos`). Pequeño pero acumulativo.

**Solución recomendada:** Estandarizar todos los prefijos a plural: `/cronogramas`, `/horas` ya está bien singular porque "las horas" se entiende como unidad de tiempo, pero unificar la URL al menos: `/melamina/modulos` con la `melamina` como namespace. En realidad lo más limpio es aceptar el namespace y renombrar los items del sidebar para que coincidan: "Módulos" en el sidebar, `/melamina/modulos` como ruta.

**Beneficio esperado:** Eliminación de fricción cognitiva, paths predecibles.

- **Impacto:** 🟢 Bajo
- **Esfuerzo:** Medio (requiere redirects para no romper links)
- **Prioridad:** 🛣️ Futuras mejoras

---

### #H05 · Botón "Volver al dashboard" en contexto ejecutivo no existe, pero hace falta un breadcrumb persistente

**Problema:** La página `/dashboard/ejecutivo` añade "← Volver al dashboard operativo" como link manual. Sin embargo, en el resto de la app no hay breadcrumbs ni atajo "Volver" persistente. El usuario experto ya usa el botón "Atrás" del navegador, que **pierde contexto** (filtros aplicados, scroll position) porque las páginas no siempre leen `?q=` o `?tab=`.

**Por qué afecta:** En una app como esta, el 70 % del flujo es "lista → detalle → acción → lista". Si el "volver" del navegador siempre resetea, el usuario está pagando con clics extras.

**Solución recomendada:**
- En `LayoutShell`, debajo de la `lg:` main, agregar un **breadcrumb dinámico** que lea la ruta (`/proyectos/[id]?tab=control`) y muestre los segmentos con sus labels humano-legibles. Hacerlo componente shared `Breadcrumbs` con `usePathname()` + mapeo de `path → label`.
- Reemplazar el botón manual "← Volver al dashboard operativo" en `/dashboard/ejecutivo` por el breadcrumb.
- El breadcrumb es además un atajo de teclado `Alt+ArrowUp` para subir un nivel.

**Beneficio esperado:** -2 clics por cada "abrir detalle y volver".

- **Impacto:** 🟠 Medio
- **Esfuerzo:** Bajo (componente nuevo + integrar)
- **Prioridad:** ⏭️ Próxima versión

---

### #H06 · Dashboard excelente pero con 5 secciones apiladas que saturan el scroll inicial

**Problema:** El dashboard operativo (`app/page.tsx`, 533 líneas) tiene:
1. Banner de onboarding
2. Header con CTA admin
3. **Acciones pendientes** (3 columnas × hasta 5 cards)
4. **Proyectos en alerta** + **Próximos hitos** (2 columnas)
5. **Pipeline de oportunidades** + **Proyectos por estado** (2 columnas)
6. (Asumo) secciones adicionales más abajo

Todo se apila verticalmente: en pantallas 1080p caben ~3 secciones antes del scroll. Quien abre la app tiene que hacer scroll para ver sus hitos.

**Por qué afecta:** El dashboard debería responder en <5 segundos a "¿qué necesita mi atención hoy?". Hoy requiere scroll para llegar a las acciones más urgentes, que están en la posición 3.

**Solución recomendada:**
- **Reordenar por prioridad de atención:**
  1. Banner de onboarding (oculto si ya se vio)
  2. **Acciones pendientes** (la sección más importante debe estar a 1 viewport)
  3. **Próximos hitos 7 días** (urgente por fecha)
  4. **Proyectos en alerta** (desviación de presupuesto)
  5. **Pipeline + kanban resumen** (estado general)
- Convertir "Próximos hitos" en una vista de **timeline horizontal** con los próximos 5 hitos como cards deslizables (más visual que una lista).
- Reducir el número máximo de items por sección (top 5, no 10) y agregar "Ver todos" → link al módulo correspondiente.

**Beneficio esperado:** Reducción 80 % del scroll necesario para tomar decisiones diarias.

- **Impacto:** 🔴 Alto
- **Esfuerzo:** Bajo (reordenamiento + max items)
- **Prioridad:** 🔥 Hacer inmediatamente

---

## 2. Tablas, filtros, búsqueda y gestión de información

### #H07 · La búsqueda de **clientes** recarga toda la página en cada Enter

**Problema:** `app/clientes/page.tsx` usa un `<form method="GET">` sin debounce; cada búsqueda es un roundtrip al servidor con HTML completo nuevo. Pérdida de scroll position, sin highlight, sin búsqueda en tiempo real.

**Por qué afecta:** En bases con muchos clientes, el usuario teclea "constructora" → Enter → espera 800ms → ve "Constructoras López" → quiere seguir con "constructora lópez" → Enter → espera 800ms otra vez. Acumulado, son minutos al día.

**Solución recomendada:** Convertir a `?search=` URL-driven con `useState` local + debounce 300ms, replicando el patrón de `/presupuestos` (ver `PresupuestosBuscador.tsx` canónico). Idealmente, **cliente-side first** para <500 registros: el servidor carga una vez y el filtro es en memoria.

**Beneficio esperado:** De ~800ms por búsqueda a ~50ms percibidos.

- **Impacto:** 🟠 Medio
- **Esfuerzo:** Bajo
- **Prioridad:** 🔥 Hacer inmediatamente

---

### #H08 · Filtros de `RecursosTable` (376 líneas) son client-side pero **se pierden al volver**

**Problema:** `RecursosTable.tsx` tiene excelente implementación de filtros (chips activos, "Limpiar todo", collapse de filtros avanzados, columnas configurables con localStorage). Pero los filtros viven en `useState` local — no se serializan a la URL. Si el usuario filtra "Tipo: Materiales + Precio ≤ RD$ 500", copia URL, abre pestaña nueva → todos los filtros perdidos.

**Por qué afecta:** Es un módulo donde los filtros son la herramienta principal de trabajo. Un usuario comercial que prepara una importación no puede tener un link guardado a "todos los cementos con precio actual > RD$ 200".

**Solución recomendada:** Misma migración del patrón `/presupuestos`: cada filtro a `?search=...&tipo=...&cat=...`. Mantener el localStorage como default al primer render. Agregar botón "**Compartir filtros**" que copia el URL al portapapeles (visible siempre que haya un filtro activo).

**Beneficio esperado:** Posibilidad de compartir vistas filtradas; los filtros sobreviven al refresh; un usuario puede tener varios tabs con vistas guardadas.

- **Impacto:** 🟠 Medio
- **Esfuerzo:** Bajo-Medio
- **Prioridad:** ⏭️ Próxima versión

---

### #H09 · Paginación server-side sólo en `/presupuestos` y `/facturacion`

**Problema:** El resto del sistema (clientes, proyectos, gastos, tareas, empleados, recursos, cronogramas, OC, rutas de compra) lista **todo** en memoria y pagina con `useMemo` o haciendo `slice(0, 200)`. El SISTEMA.md lo reconoce como deuda. Con el crecimiento, las tablas colapsan.

**Por qué afecta:** Lentitud perceptible (>500ms en render), memoria del navegador inflada, scroll virtual infinito en tablas.

**Solución recomendada:** Estandarizar el patrón URL-driven con `?page=`, `?perPage=`, `?q=`, `?filtro=`. El componente `<DataTable>` en `components/ui/` puede tomar `columns`, `rows`, `pagination`, `filters` y reutilizarse en los 8+ listados.

**Beneficio esperado:** Tablas rápidas sin importar tamaño de datos; mismo patrón mental en toda la app.

- **Impacto:** 🔴 Alto
- **Esfuerzo:** Medio (un refactor escalable)
- **Prioridad:** ⏭️ Próxima versión

---

### #H10 · Falta editable-inline en TODAS las tablas de listado

**Problema:** Tabla de tareas en `TareasPageClient` muestra columnas de "Título", "Estado", "Asignado", "Prioridad", "Cliente/Proyecto" como texto estático. Cambiar el estado requiere entrar a editar. Igual en proyectos, empleados, OC.

**Por qué afecta:** Una operación típica de usuario experto es: voy al listado de tareas, marco 5 como "En proceso" sin abrir cada una. Hoy son 5×(abrir + cambiar + guardar + cerrar) = 20 clics + 5 roundtrips. Con edición inline = 5 clics totales.

**Solución recomendada:**
- En columna "Estado" de tareas: dropdown in-cell que patchea al cambiar.
- En columna "Avance" de proyectos: input numérico que guarda al desenfocar.
- En columna "Costo unitario" de recursos: input con `step=0.01` que guarde al `Enter`/blur (análoga a `RutaCompraDetail` que ya lo hace con `precioReal`).
- En columna "Asignado" de tareas: dropdown con usuarios.

**Beneficio esperado:** -80 % tiempo en operaciones de lista.

- **Impacto:** 🔴 Alto
- **Esfuerzo:** Medio (generalizar el patrón `onBlur` ya presente en `RutaCompraDetail`)
- **Prioridad:** 🔥 Hacer inmediatamente

---

### #H11 · Falta selección múltiple + acciones bulk en muchos listados

**Problema:** Solo `GastosTab` (934 líneas) tiene asignación bulk de partidas. Tareas, empleados, OC, recursos, clientes no. Un usuario que quiera archivar 30 tareas termina haciendo una por una.

**Por qué afecta:** El patrón bulk ya está demostrado en el sistema (`GastosTab` con popover de partidas, asignación masiva). Falta exportarlo.

**Solución recomendada:**
- Crear `components/ui/bulk-actions.tsx` con checkboxes de cabecera y barra flotante de acciones ("Archivar 5" / "Asignar a…" / "Eliminar").
- Aplicar a `/tareas` (archivar, cambiar estado, reasignar), `/empleados` (cambiar estado activo), `/recursos` (importar/actualizar), `/compras` (cambiar estado OC).

**Beneficio esperado:** -90 % tiempo para operaciones masivas.

- **Impacto:** 🔴 Alto
- **Esfuerzo:** Medio
- **Prioridad:** ⏭️ Próxima versión

---

### #H12 · Tablas con anchos `w-24`, `w-16` hardcoded que rompen en pantallas pequeñas

**Problema:** `RecursosTable.tsx` y `KanbanClient.tsx` definen anchos fijos (`w-72 shrink-0` para columnas Kanban, `w-24` para "Código"). En pantallas chicas o con sidebar expandido aparecen scrolls horizontales permanentes.

**Por qué afecta:** Usuarios con laptops de 13" o tablets ven scroll horizontal constante. La regla de oro de SaaS modernos es **ningún scroll horizontal** salvo para tablas con columnas obligatorias.

**Solución recomendada:** Aceptar scroll horizontal solo en `recursos` y `proyectos` (porque sus columnas son muchas). En `kanban` usar `lg:flex-row flex-col` con tarjetas apiladas en móvil. Para las demás tablas, hacer las columnas "menores" ocultas en mobile (con un sheet lateral "Ver más" al hacer tap en una fila).

**Beneficio esperado:** UX consistente en todos los tamaños de pantalla.

- **Impacto:** 🟠 Medio
- **Esfuerzo:** Medio
- **Prioridad:** ⏭️ Próxima versión

---

### #H13 · Filtros de gastos en `GastosTab` son super potentes pero invisibles

**Problema:** `GastosTab.tsx` (934 líneas) tiene búsqueda + filtros colapsados + selector de columnas (con persistencia localStorage) + orden + asignación inline de partida + asignación bulk + importación Excel. Es probablemente el módulo más completo del CRM. Pero **la curva de descubrimiento es brutal**: los chips de filtro están bajo un toggle "Filtros" con badge numérico; el dropdown de columnas requiere buscar el botón "Columnas" en la barra; las acciones bulk solo aparecen tras seleccionar filas.

**Por qué afecta:** Los usuarios expertos usan el 100 %; los nuevos solo ven el botón "+ Nuevo gasto".

**Solución recomendada:**
- Convertir `GastosTab` en una **vista maestra con un panel lateral colapsable** (240-300px) que contenga filtros + agrupación + columnas + acciones masivas. Toggle persistente (≡ icono) en la esquina superior derecha.
- Cuando un usuario experto identifica los atajos frecuentes, ofrecer una barra de presets ("Mis filtros guardados") abajo del buscador — p. ej., "Cuadrilla Bofill — semana actual".
- Replicar este layout en `/recursos`, `/tareas`, `/proyectos`, donde aplica.

**Beneficio esperado:** Activación del 100 % de features por parte de usuarios nuevos.

- **Impacto:** 🟠 Medio
- **Esfuerzo:** Medio-Alto
- **Prioridad:** 🛣️ Futuras mejoras

---

### #H14 · No existe vista de "Gastos recientes" ni feed de actividad reciente del usuario

**Problema:** El dashboard muestra proyectos en alerta pero no dice "estos son los 5 últimos gastos que registraste tú". Un supervisor entrando al sistema cada mañana no tiene forma rápida de "¿qué hice ayer?".

**Por qué afecta:** Una de las consultas más frecuentes en cualquier ERP es "¿qué pasó con mis tareas / movimientos?".

**Solución recomendada:** Agregar al dashboard operativo un widget **"Mi actividad reciente"** que muestra:
- Mis últimas 5 tareas actualizadas
- Mis últimos 5 gastos registrados (con su factura si existe)
- Mis últimas 3 horas registradas
Cada item con link directo y timestamp relativo ("hace 2h").

**Beneficio esperado:** Visibilidad inmediata del contexto del usuario al abrir la app.

- **Impacto:** 🟢 Bajo-Medio
- **Esfuerzo:** Bajo
- **Prioridad:** ⏭️ Próxima versión

---

## 3. Formularios, creación y edición de registros

### #H15 · `/clientes/nuevo` no se ha auditado pero `nuevo-v2` style está disperso: presupuestos nuevo vs presupuesto editar

**Problema:** El codebase tiene `/presupuestos/nuevo-v2/page.tsx` (59 líneas, usa `PresupuestoV2Builder`) y rutas legacy `/presupuestos/[id]/editar` para presupuestos V1. La decisión de cuál URL sirve se hace en el detalle (`/presupuestos/[id]/page.tsx` decide dinámicamente), pero el usuario que escribe la URL a mano puede caer en el path V1.

**Por qué afecta:** Confusión, registros duplicados, datos en el modelo equivocado.

**Solución recomendada:**
- Redirigir `/presupuestos/[id]/editar` → `/presupuestos/[id]/editar-v2` siempre. Ocultar el path V1 del menú y de los resultados de búsqueda.
- Documentar en `/ayuda/presupuestos` que la versión V2 es la única soportada.
- Plan a corto plazo: **migrar V1 → V2** para los datos legacy, y eliminar las rutas V1.

**Beneficio esperado:** Eliminar duplicación de modelos, menos confusión, una sola fuente de verdad.

- **Impacto:** 🟠 Medio
- **Esfuerzo:** Medio (migración de datos)
- **Prioridad:** ⛏️ Hacer inmediatamente (pequeño refactor de redirect) + migración de fondo

---

### #H16 · `EmpleadoForm.tsx` (332 líneas) mezcla info personal, bancaria, horario y vacaciones

**Problema:** El formulario tiene al menos 4 dominios distintos:
1. Datos personales (nombre, cédula, correo, teléfono)
2. Datos laborales (cargo, departamento, fecha ingreso, salario)
3. Datos bancarios (banco, tipo, número de cuenta)
4. Horario semanal (toggle por día + horas)
5. Vacaciones

Todo en una sola página con scroll vertical largo. El usuario que entra a "solo cambiar el teléfono" tiene que pasar por todos los campos.

**Por qué afecta:** Formularios largos = errores, abandono, "ya lo lleno después".

**Solución recomendada:**
- Convertir `EmpleadoForm` a un layout con **tabs** o **acordeón** (Datos personales · Laboral · Horario · Banco · Vacaciones).
- Cada tab autosalva al cambiar de tab (o guarda al cerrar con confirmación si hay cambios pendientes). Patrón "draft" como en Notion / Linear.
- Lleva a la práctica el patrón `useUnsavedChangesWarning.ts` que ya existe en el repo (`hooks/`) para avisar al cerrar con cambios sin guardar.

**Beneficio esperado:** -50 % tiempo en actualizaciones parciales; menos errores por scroll-and-miss.

- **Impacto:** 🔴 Alto
- **Esfuerzo:** Medio
- **Prioridad:** ⏭️ Próxima versión

---

### #H17 · Formularios sin validación cliente visible: solo `if (!form.nombre) return`

**Problema:** La mayoría de forms en el repo hacen su propia validación manual sin librería (ej. `EmpleadoForm` líneas 115-116: `if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }`). Esto es propenso a inconsistencias: cada form decide qué validar y cómo.

**Por qué afecta:** UX inconsistente ("¿por qué en un form se valida fecha y en otro no?"); mensajes pobremente ubicados; sin validación inline por campo.

**Solución recomendada:**
- Adoptar un wrapper compartido `<FormField label="..." error={errors.x} required>` en `components/ui/form-field.tsx`.
- Conectar a `react-hook-form` (~9KB gzipped) que ya está implícito en `with-permiso.ts` (validación con Zod parcial en API). Aprovechar los schemas de `lib/api-schemas.ts` para validación client-AND-server con la misma definición.
- Mostrar errores inline por campo, no solo `setError(msg)` global.
- Estado de "guardando…" centrado en el botón submit (ya hay `Loader2`).

**Beneficio esperado:** Validación un cliente feliz, menos errores, formularios se sienten vivos.

- **Impacto:** 🔴 Alto
- **Esfuerzo:** Medio
- **Prioridad:** ⏭️ Próxima versión

---

### #H18 · Formularios sin feedback optimista (refresh manual de la lista)

**Problema:** Tras enviar un form (`handleSubmit` → `fetch POST` → `toast.exito` → `router.push` detalle), los listados que enlazan a este form se refrescan al reingresar, pero otras vistas (Kanban, Dashboard) no. Ejemplo: crear un cliente nuevo → vuelve al listado → todo OK. Pero si el usuario estaba en `/clientes/[id]` y crea un proyecto desde esa misma pantalla, no ve el nuevo proyecto hasta recargar.

**Por qué afecta:** Estados fantasma — "yo creé el proyecto, ¿por qué no aparece aquí?".

**Solución recomendada:** Tras cada mutación exitosa: `router.refresh()` PLUS broadcast local (custom event o zustand store) que las vistas escuchen. Implementar `useRevalidateOnFocus` (refrescar al volver a la tab) para que las vistas siempre reflejen datos frescos al volver.

**Beneficio esperado:** Cero inconsistencias visuales tras crear.

- **Impacto:** 🟢 Bajo
- **Esfuerzo:** Bajo
- **Prioridad:** ⛏️ Hacer inmediatamente

---

## 4. Detalle de proyecto (la pantalla más usada después del dashboard)

### #H19 · `/proyectos/[id]` tiene 4 grupos de tabs con sub-navigation y 9 sub-tabs · "tab overload"

**Problema:** La página de detalle de proyecto (`app/proyectos/[id]/page.tsx`, 1147 líneas) tiene:
- Grupo **Resumen** (1 tab: Resumen)
- Grupo **Dinero** (4 tabs: Gastos, Control presupuestario, Adicionales, EVM/Curva S)
- Grupo **Ejecución** (3 tabs: Programación, Punchlist, Bitácora)
- Grupo **Archivo** (2 tabs: Presupuestos, Documentos)

Total 10 vistas en una pantalla con doble navegación (grupo → sub-tabs). Es funcional pero exige mucho al usuario.

**Por qué afecta:** Cuando un supervisor abre el proyecto solo para ver el cronograma, tiene que pasar por 2 niveles (Ejecución → Programación). El overhead es acumulado.

**Solución recomendada:**
- **Eliminar el nivel "grupo"** y aplanar a 9 tabs en una sola barra (como Linear o Jira). Permite al ojo ver todas las opciones a la vez.
- Agregar **tabs sticky** (que se mantengan al hacer scroll). Hoy no lo son.
- Personalización: que el sistema aprenda cuál es la tab más usada por el usuario y la coloque primera (storage local).
- Considerar **resumen always-on**: una sidebar lateral de 240px con la info clave del proyecto (cliente, estado, presupuesto, últimos 3 gastos) que esté visible en TODAS las tabs. Reduce el "ir a Resumen para ver algo simple".

**Beneficio esperado:** -2 clics promedio por cada visita al detalle de proyecto.

- **Impacto:** 🔴 Alto
- **Esfuerzo:** Medio
- **Prioridad:** 🔥 Hacer inmediatamente

---

### #H20 · "Resumen" del proyecto está saturado: 5 cards de resumen financiero + 4 cards de indicadores = 9 bloques

**Problema:** La tab Resumen apila en orden:
- Alerta de presupuesto (si aplica)
- Banner "poblar control presupuestario" (si aplica)
- Panel "Indicadores de ejecución" (4 cards: Avance físico, Ejecución financiera, Forecast, Eficiencia)
- Tarjeta "Resumen financiero" (5 cards: Presupuestado, Gastos directos, M.O. Interna, Overhead, Balance)
- Resumen de cronogramas
- Resumen de presupuestos

Es una pared. Un gerente entrando a "¿cómo va este proyecto?" tiene que escanear 9 métricas en orden.

**Por qué afecta:** Información crítica enterrada al final. Lo más urgente (cuánto se ha gastado vs cuánto se presupuestó) está en el bloque 4, no arriba.

**Solución recomendada:**
- Reordenar: **alertas y métricas críticas primero**:
  1. Banner de alerta (si la hay)
  2. **Bloque "A dónde vamos"** (presupuesto vs gastado: 3-4 cards con barras grandes)
  3. Indicadores de ejecución (los 4 actuales, más compactos)
  4. Cronogramas y presupuestos (refs + ver detalles)
- Convertir la sección "Resumen financiero" en una sola visualización grande estilo **burndown**: línea de gasto planeado vs real, sin tecnicismos. Click → modal con desglose.

**Beneficio esperado:** Decisión ejecutiva en 5 segundos.

- **Impacto:** 🔴 Alto
- **Esfuerzo:** Medio
- **Prioridad:** 🔥 Hacer inmediatamente

---

### #H21 · Acciones destructivas sin confirmación consistente

**Problema:** El plan UX Fase 2 avanzó en migración de `alert()`/`confirm()` a `ConfirmDialog` + `useToast`. Pero revisar `DeleteProyectoButton`, `DeleteTareaButton`, `DeleteEmpleadoButton`, `DeleteClienteButton`, `DeleteRecursoButton`, `DeleteCronogramaButton`, `DeletePresupuestoButton`, `RutasCompraDetail` (cambio de estado) — **varios todavía no están migrados** al nuevo patrón (los que aparecen son candidatos previos a la fase 2). Esto ya fue documentado como "migración de los ~25 restantes".

**Por qué afecta:** Riesgo de borrar registros por doble clic; UX inconsistente entre módulos; el usuario nunca sabe si cierta acción es reversible.

**Solución recomendada:** Localizar todos los botones de borrado/cambio de estado y aplicarles el patrón canónico (botón acción → `setOpen(true)` → `ConfirmDialog` con `variante='peligro'` + `cargando` + `onConfirmar={async () => fetch + toast}`). Los botones `Archivar` también merecen confirmación textual explicando el efecto ("Se ocultará de listados por defecto. ¿Archivar?").

**Beneficio esperado:** Cero errores por clic accidental; feedback consistente.

- **Impacto:** 🔴 Alto
- **Esfuerzo:** Medio
- **Prioridad:** ⛏️ Hacer inmediatamente (siguiente sprint)

---

### #H22 · Vincular presupuesto a proyecto requiere formulario separado — oportunidad de inline

**Problema:** En `app/proyectos/[id]/page.tsx` y `/presupuestos/[id]/page.tsx` hay un componente `<VincularPresupuestoButton>` (modal grande). La lógica es: estás en un proyecto, quieres vincular un presupuesto que ya existe. Hoy: clic "Vincular" → modal → buscar → seleccionar. 4 clics.

**Por qué afecta:** Cuando un presupuesto se crea ANTES que el proyecto (flujo natural), la vinculación es la operación #1 del supervisor al configurar.

**Solución recomendada:**
- En la tab "Presupuestos" del proyecto, agregar un **combobox con búsqueda en tiempo real** que al seleccionar hace el PUT directamente. Cero clics extra (ya está la pestaña Presupuestos).
- Crear un nuevo presupuesto desde aquí mismo con un botón "**+ Nuevo presupuesto para este proyecto**" que abre el constructor con `defaultProyectoId` precargado (esto YA existe en `/presupuestos/nuevo-v2?proyectoId=X`).

**Beneficio esperado:** -3 clics y -1 modal en el flujo más común.

- **Impacto:** 🟠 Medio
- **Esfuerzo:** Bajo
- **Prioridad:** ⏭️ Próxima versión

---

### #H23 · Cronograma: no hay vista Gantt en la pantalla de proyecto, hay que navegar a `/cronograma/[id]`

**Problema:** El proyecto tiene **su propio cronograma** en la tab "Programación", pero el Gantt visual completo está en `/cronograma/[id]` (otra URL). Si el usuario quiere ver el cronograma de un proyecto específico, el flujo es: `/proyectos/[id]` → "Ejecución" → "Programación" → click en "Abrir cronograma completo" → nueva URL. Un clic de más.

**Por qué afecta:** Cualquier producto moderno (Jira, Asana, ClickUp) renderiza el Gantt inline en el detalle, sin cambiar de ruta.

**Solución recomendada:** Embedder el componente Gantt dentro de la tab Programación del proyecto (lazy-loaded). El Gantt completo en `/cronograma/[id]` queda para imprimir, editar en masa y comparar múltiples cronogramas.

**Beneficio esperado:** Eliminación de navegación cruzada; el Gantt donde corresponde.

- **Impacto:** 🟠 Medio
- **Esfuerzo:** Alto
- **Prioridad:** 🛣️ Futuras mejoras

---

### #H24 · Programación / Punchlist / Bitácora — sin atajos de "crear X para este proyecto"

**Problema:** Las tabs "Programación", "Punchlist" y "Bitácora" del proyecto permiten crear actividades, items y entradas, pero el botón de creación suele estar en la parte superior o como ícono flotante. Sin embargo, falta un atajo universal en el header del proyecto: una **botonera flotante** ("+ Crear") que se expande a: Crear tarea · Crear gasto · Crear actividad · Crear punchlist · Crear entrada bitácora.

**Por qué afecta:** Los usuarios power-user pierden tiempo navegando a 3-4 pestañas diferentes para crear elementos relacionados. ClickUp/Asana/Notion tienen un "+" centralizado que es la fuente #1 de creación.

**Solución recomendada:**
- Botón "**+ Crear en este proyecto**" en el header del detalle, junto a "Editar" / "Cerrar".
- Al hacer clic abre un menú Popover con las acciones anteriores. Cada una abre el form correspondiente con `defaultProyectoId` ya configurado.
- Atajo de teclado: `c` dentro de `/proyectos/[id]` abre el menú "+ Crear".

**Beneficio esperado:** Un único punto de creación contextual; estándar del mercado.

- **Impacto:** 🔴 Alto
- **Esfuerzo:** Medio
- **Prioridad:** ⏭️ Próxima versión

---

### #H25 · Bitácora / Punchlist — falta vista mobile

**Problema:** La bitácora de obra típicamente la llena el supervisor desde el celular en la obra. Un Punchlist también. Las páginas actuales son tablas server-rendered sin vista mobile, lo que significa zoom y scroll horizontal en campo.

**Por qué afecta:** UX en campo es el caso #1 de móvil. Y es donde este producto compite con apps específicas (Bauhaus, Procore).

**Solución recomendada:** Agregar vista móvil alternativa (cards verticales) para estas dos pantallas cuando `window.innerWidth < 768`. Botón flotante "**+ Nueva entrada**" visible en todo momento. Sin atajos de teclado (móvil).

**Beneficio esperado:** Adopción en campo por supervisores y encargados de obra.

- **Impacto:** 🟠 Medio
- **Esfuerzo:** Medio
- **Prioridad:** 🛣️ Futuras mejoras

---

## 5. Módulo de gastos (y el OCR recién agregado)

### #H26 · `GastosTab` (934 líneas) merece dividirse en sub-componentes

**Problema:** El componente es demasiado grande: contiene PartidaCell (popover de asignación), BulkAssign, ColumnPicker, ActionsMassSelect, ImportarGastosModal, GastoForm, ImportarExcel, etc. Es difícil de mantener, los juniors se pierden.

**Por qué afecta:** Bugs en bloque monolítico; duplicación al querer reutilizar el patrón en otros módulos.

**Solución recomendada:** Refactor estructural:
- `components/gastos/Table/GastosTable.tsx`
- `components/gastos/Table/PartidaCell.tsx`
- `components/gastos/Table/BulkAssignMenu.tsx`
- `components/gastos/Table/ColumnPicker.tsx`
- `components/gastos/Form/GastoForm.tsx`
- `components/gastos/Import/ImportarGastosModal.tsx`

Seguir el patrón de `RecursosTable` (376 líneas) que sí está mejor modularizado.

**Beneficio esperado:** Mantenibilidad, menos bugs en producción al cambiar piezas.

- **Impacto:** 🟠 Medio
- **Esfuerzo:** Medio
- **Prioridad:** ⛏️ Hacer inmediatamente (al refactorizar la página)

---

### #H27 · OCR (Fase B de backlog-ux-fase2): botón "Escanear factura" — validar que aparece antes de los demás campos

**Problema:** El plan del backlog propone agregar `<input file capture="environment">` con botón "Escanear factura" en `GastoForm.tsx`. Bien. Pero el patrón de UX debe ser: **el OCR debe ser la opción #1, no una secundaria**, porque el caso de uso real es "tengo una factura física en la mano" (~70 % de los gastos). Si el botón está al fondo del form, el usuario lo descubre tarde.

**Por qué afecta:** Si solo el 20 % de los usuarios descubren OCR, su costo (latencia ~3s de Gemini/Claude) es alto para valor bajo. Mejor: masivo uso.

**Solución recomendada:**
- En `GastoForm`, **antes del primer campo** (encabezado del form), renderizar un bloque visual grande:
  ```
  ┌─────────────────────────────────────────────┐
  │  📸  Escanea tu factura                     │
  │      Tomamos foto y llenamos todo           │
  │      por ti — solo revisa y guarda.         │
  │            [📷 Escanear factura]            │
  └─────────────────────────────────────────────┘
  ```
- Mantener al final del form un "Modo manual" colapsable si el usuario prefiere tipear.

**Beneficio esperado:** -70 % del tiempo de registro de gasto en el caso más común.

- **Impacto:** 🔴 Alto
- **Esfuerzo:** Bajo (cuestión de ubicación)
- **Prioridad:** ⛏️ Hacer inmediatamente

---

### #H28 · Filtros de gastos: chips visibles + "Filtros guardados" — falta

**Problema:** En `GastosTab` hay filtros colapsables con `SlidersHorizontal`, pero los chips visibles ("Filtros activos:") están condicionados a que haya filtros avanzados activos. El buscador textual NO genera chip.

**Por qué afecta:** El usuario no sabe qué filtro está aplicado con solo mirar el campo. Tiene que expandir el panel.

**Solución recomendada:**
- Mostrar **siempre** una barra de chips debajo del buscador, con cualquier filtro activo (incluida la búsqueda). Cada chip removable con X.
- Ofrecer **Filtros guardados**: el usuario puede nombrar el filtro actual ("Gastos de la semana de Bofill") y recuperarlo con un clic. Guardado en BD por usuario.

**Beneficio esperado:** -50 % tiempo enqueries típicas de gasto.

- **Impacto:** 🟠 Medio
- **Esfuerzo:** Bajo-Medio
- **Prioridad:** ⏭️ Próxima versión

---

### #H29 · Falta vista "Mis gastos pendientes de aprobar/revisar"

**Problema:** El estado `estado` del gasto es `Registrado → Revisado → Anulado`. No hay una vista fácil para el supervisor que dice "muéstrame los gastos en estado Registrado que aún no he revisado". Tiene que aplicar el filtro manualmente cada vez.

**Por qué afecta:** El flujo "revisar gastos" es diario para gerentes en construcción.

**Solución recomendada:** Link directo en el dashboard o sidebar: `/gastos?estado=Registrado&revisado=no` con conteo en un badge. El gerente entra, ve la cola, click por click revisa o marca como revisado (con `useToast` y `ConfirmDialog` si es masivo).

**Beneficio esperado:** Cola de revisión de gastos en un solo lugar.

- **Impacto:** 🟠 Medio
- **Esfuerzo:** Bajo
- **Prioridad:** ⏭️ Próxima versión

---

## 6. Módulo de tiempo (Horas del Equipo)

### #H30 · `HorasPageClient` (867 líneas) — vista semanal tipo time-tracking (excelente) pero solo mensual

**Problema:** El componente ofrece una **vista tipo calendario semanal** (drag & drop de bloques de tiempo, asignación de tipo, proyecto, cliente) que es **de lo mejor del producto** y comparable a Toggl/Clockify. Pero solo tiene vista semana y mes (probablemente). Falta **vista día** (importante para consultores / gerentes que necesitan ver "qué hice hoy") y **vista timeline personal** (mi semana como empleado).

**Por qué afecta:** Cada minuto invertido en el time tracker tiene que ser fácil. Si el usuario necesita "vista mes" para facturar, debe existir.

**Solución recomendada:**
- Agregar botones toggle "**Día · Semana · Mes**" arriba del calendario.
- Vista día: igual de detallada pero solo 24h, scroll vertical.
- Vista mes: heatmap por día (verde/rojo/gris según horas registradas vs esperadas).

**Beneficio esperado:** Cubre el ciclo completo de uso del time tracker.

- **Impacto:** 🟠 Medio
- **Esfuerzo:** Medio
- **Prioridad:** ⏭️ Próxima versión

---

### #H31 · `HorasPageClient` — no hay timer activo (start/stop)

**Problema:** Un usuario que entra a registrar una hora tiene que seleccionar hora de inicio y duración manualmente. Productos como Toggl, Clockify o Harvest tienen un **botón "Empezar a cronometrar"** que pone un timer en pantalla y, al detener, abre el form con horas = tiempo real.

**Por qué afecta:** Para consultores o freelancers internos (los que registran muchas horas al día), el patrón "timer" ahorra una enorme cantidad de clics y memoria. Hoy pierden tiempo recordando a qué hora empezaron.

**Solución recomendada:** Botón flotante "**⏱ Empezar**" siempre visible en `/horas`. Al detener, abre el BlockPopup con campos prellenados (horaInicio = hora actual - X, horas = X). Funciona incluso si el usuario navega a otra página (estado en localStorage).

**Beneficio esperado:** -50 % tiempo de registro para usuarios power.

- **Impacto:** 🟠 Medio
- **Esfuerzo:** Bajo-Medio (es local)
- **Prioridad:** ⏭️ Próxima versión

---

### #H32 · Sin dashboard personal ("Mis horas / Mis tareas / Mi semana")

**Problema:** Un empleado entrando al sistema cada mañana no tiene un **resumen personal**: ¿qué tareas tengo hoy? ¿cuántas horas llevo esta semana? ¿qué proyectos me faltan? Tiene que armar la respuesta navegando 4 módulos.

**Por qué afecta:** Producto personal = engagement. Es lo que distingue Notion/Linear (centrado en el individuo) de un ERP clásico (centrado en la empresa).

**Solución recomendada:** Crear `/mi` o `/dashboard/personal` con:
- Mis tareas hoy/vencidas (top 5)
- Mis horas esta semana (resumen con meta)
- Mis proyectos activos (cards simples)
- Mis gastos pendientes de aprobar
Disponible como primer ítem del sidebar (#H01) — icono 👤 o similar.

**Beneficio esperado:** Punto de entrada personal que mejora el engagement.

- **Impacto:** 🟠 Medio
- **Esfuerzo:** Medio
- **Prioridad:** ⛏️ Hacer inmediatamente (gran victoria rápida)

---

## 7. Módulo presupuestos / cotizaciones

### #H33 · `PresupuestoV2Builder` — flujo de creación largo sin vista previa en PDF durante edición

**Problema:** El constructor V2 (en `components/presupuestos/`) es muy potente (jerarquía Título → Capítulo → Partida, APU integrado por partida, RecursoPickerModal, indirectos). Pero tiene un problema de feedback: **el usuario no sabe si lo que está armando se ve bien** hasta que abre la vista de impresión. Para cotizaciones de 200+ partidas, es común equivocarse en formato que solo se descubre al generar el PDF.

**Por qué afecta:** Refactor del PDF cada 3 partidas = frustración. ClickUp tiene vista previa en vivo en tareas; Notion tiene previsualización al escribir.

**Solución recomendada:** Botón "**👁 Vista previa**" en la barra superior del constructor. Abre un panel lateral (drawer) con la vista A4 renderizada del presupuesto actual, que se actualiza en vivo (debounce 500ms). El usuario puede cerrar y seguir editando.

**Beneficio esperado:** Cero refactores del PDF.

- **Impacto:** 🔴 Alto
- **Esfuerzo:** Medio (reutilizar lógica de `/imprimir`)
- **Prioridad:** 🔥 Hacer inmediatamente

---

### #H34 · `DuplicarButton` — no avisa cuántas partidas se copiarán

**Problema:** El botón "Duplicar presupuesto" hace una copia completa (títulos, capítulos, partidas, APUs, indirectos). Un usuario con un presupuesto de 200 partidas necesita saber **qué tan grande será la copia antes de confirmar** y cuánto tardará.

**Por qué afecta:** Incertidumbre → clics innecesarios en "Cancelar" o duplicaciones accidentales.

**Solución recomendada:** En el `ConfirmDialog`, agregar:
> Vas a duplicar este presupuesto (123 partidas en 5 capítulos). El nuevo número será `COT-2027-NNN`.

Y mostrar un loader que indique progreso si la operación tarda >1s.

**Beneficio esperado:** Cero duplicaciones accidentales; feedback claro.

- **Impacto:** 🟢 Bajo
- **Esfuerzo:** Bajo
- **Prioridad:** ⛏️ Hacer inmediatamente

---

### #H35 · Cambio de estado de presupuesto + activar proyecto — debería ser wizard, no 2 pasos

**Problema:** Cuando un presupuesto se aprueba (`PUT /api/presupuestos/[id]/estado` con `Aprobado`), el proyecto asociado pasa a `En Ejecución` automáticamente. Eso está bien. Pero antes de aprobar, hay un "CambiarEstadoButton" y luego no hay una vista resumen que diga: "si apruebas, esto es lo que va a pasar".

**Por qué afecta:** El usuario avezado lo sabe; el nuevo no. La falta de contexto antes de acciones con efectos secundarios genera errores.

**Solución recomendada:** El `CambiarEstadoButton` ya tiene diálogo de confirmación (bien). Agregar al diálogo:
- Estado actual
- Nuevo estado
- **Side effects:** "Esto activará el proyecto XYZ, generará una notificación al cliente y bloqueará la edición de partidas."

**Beneficio esperado:** Cero sorpresas tras clicks irreversibles.

- **Impacto:** 🟠 Medio
- **Esfuerzo:** Bajo
- **Prioridad:** ⏭️ Próxima versión

---

## 8. Kanban y vistas alternativas

### #H36 · `/proyectos/kanban` (322 líneas) excelente, falta en presupuestos y oportunidades

**Problema:** El Kanban de proyectos (`KanbanClient.tsx`) soporta drag & drop entre columnas (no terminales), con feedback optimista, rollback en error, card con info clave. Está bien hecho. **Pero no hay Kanban equivalente para:**
- **Oportunidades** (mencionado en sidebar como "Pipeline", pero `/oportunidades` debe ser server-rendered con tabla)
- **Presupuestos** (4 estados: Borrador → Enviado → Aprobado/Rechazado)
- **Tareas** — existe Kanban pero básico
- **Gastos** (por revisar / aprobado / anulado)

**Por qué afecta:** Cuando un CRM/ERP tiene vistas alternativas (lista + Kanban + calendario + timeline), el usuario elige la que se adapte a su tarea.

**Solución recomendada:**
- Generalizar el patrón de `KanbanClient.tsx` a `<DraggableKanban>` reutilizable.
- Aplicarlo a `/presupuestos` (dragging Entre estados) y a `/oportunidades` (dragging entre etapas del pipeline).
- Conectar al dashboard: el widget de Pipeline de oportunidades debe ser ese mismo Kanban, no 4 cards estáticas.

**Beneficio esperado:** -50 % tiempo en transiciones de estado masivas.

- **Impacto:** 🔴 Alto
- **Esfuerzo:** Medio
- **Prioridad:** ⏭️ Próxima versión

---

## 9. Diseño visual, sistema y consistencia

### #H37 · `Badge` de shadcn existe pero muchos módulos re-implementan el suyo propio

**Problema:** `components/ui/badge.tsx` define `Badge` con 7 variants (`default`, `success`, `warning`, `danger`, `info`, `secondary`, `orange`) y `EstadoProyectoBadge` / `EstadoPresupuestoBadge` ya exportados. Pero `RecursosTable.tsx`, `TareasPageClient.tsx`, `ComprasPageClient.tsx`, `RutasCompraPageClient.tsx`, `KanbanClient.tsx`, `EmpleadosTable.tsx`, `GastosTab.tsx` **definen sus propios estilos de badge inline** (literalmente hardcodean `bg-green-100 text-green-700` directamente). Cada uno con un tono ligeramente distinto.

**Por qué afecta:** Inconsistencia visual, ruido, 15+ definiciones de "este es el badge verde de éxito". Si se quiere cambiar un tono de marca, hay que buscar 15 archivos.

**Solución recomendada:** Mapeo central en `lib/estados.ts` (o `components/ui/estados.tsx`) por dominio:
```ts
export const ESTADO_PROYECTO = { 'En Ejecución': 'success', 'Pausado': 'orange', ... }
export const ESTADO_OC       = { recibida: 'success', cancelada: 'danger', ... }
export const ESTADO_TAREA    = { 'En proceso': 'info', ... }
export const ESTADO_RUTA     = ...
export function EstadoBadge({ dominio, estado }) { return <Badge variant={MAPAS[dominio][estado]}>{label}</Badge> }
```

Eliminar todas las definiciones inline. Tener un único lugar para añadir un nuevo estado.

**Beneficio esperado:** Consistencia visual absoluta; mantenimiento trivial.

- **Impacto:** 🟠 Medio
- **Esfuerzo:** Bajo-Medio (refactor cosmético)
- **Prioridad:** ⛏️ Hacer inmediatamente

---

### #H38 · `Button` con 5 variants (`primary`, `secondary`, `ghost`, `danger`, `outline`) — pero módulos usan bg verde/rojo/azul hardcodeados

**Problema:** `Button` ya tiene todas las variantes necesarias. Pero muchos componentes **no usan `<Button>`** y aplican `className="bg-green-600 hover:bg-green-700"` directamente: `CambiarEstadoButton`, `TareasPageClient`, `ComprasPageClient`, `RecursosTable`, `EmpleadosTable`, etc.

**Por qué afecta:** Cambiar el padding, border-radius o focus-ring de TODOS los botones implica buscar 20 archivos. Y desincroniza estilos.

**Solución recomendada:**
- Auditoría rápida: `grep -r 'className=.*bg-(blue|green|red|amber)-600' components/ app/`.
- Cada caso pasa a `<Button variant="primary">` o `<Button variant="secondary">` o `<Button variant="danger">`.
- Crear una prop `color="success"` opcional en `Button` para casos específicos (verde "Aprobar") sin tener que hardcodear.

**Beneficio esperado:** Cambios globales de UI en un solo lugar.

- **Impacto:** 🟠 Medio
- **Esfuerzo:** Bajo
- **Prioridad:** ⛏️ Hacer inmediatamente

---

### #H39 · Falta modo de "alto contraste" / accesibilidad

**Problema:** El sistema soporta tema light/dark pero no hay opción de "alto contraste" para usuarios con baja visión. Además, muchos `text-muted-foreground` con fondos `bg-card` ofrecen ratios <4.5:1 (estándar WCAG AA).

**Por qué afecta:** Accesibilidad no es solo buena práctica, es cumplimiento en muchos contextos y abre puertas a empleados con discapacidad visual.

**Solución recomendada:** Auditar las combinaciones de color contrastantes con `axe DevTools`. Crear una variante `theme="high-contrast"` opcional en `ThemeProvider`. Reforzar focus rings visibles (hoy existen pero están sutiles).

**Beneficio esperado:** Cumplimiento WCAG 2.1 AA en el producto.

- **Impacto:** 🟢 Bajo-Medio
- **Esfuerzo:** Medio
- **Prioridad:** 🛣️ Futuras mejoras

---

### #H40 · Iconos `lucide-react` no usados consistentemente por dominio

**Problema:** Revisé los íconos y:
- El dominio de **proyectos** usa `FolderOpen` en unos sitios y `Building2` en otros.
- El de **recursos** usa `Package` o `Box` indistintamente.
- Las rutas (`/compras/rutas`) usan `Route` (lucide) y a veces `MapPin` para "paradas" vs `Map` en otros sitios.

Cada uno individualmente está bien; juntos, comunican inconsistencia.

**Por qué afecta:** Reconocimiento de patrones por íconos: si dos cosas son iguales (parada geográfica), deben tener el mismo ícono siempre.

**Solución recomendada:** Centralizar en `lib/iconos.ts` un mapa `ICONO_POR_CONCEPTO`:
```ts
export const ICONO = {
  proyecto:    FolderOpen,
  parada:      MapPin,
  cotizacion:  FileText,
  ...
}
```
Reemplazar usos dispersos.

**Beneficio esperado:** Iconografía predecible.

- **Impacto:** 🟢 Bajo
- **Esfuerzo:** Bajo
- **Prioridad:** 🛣️ Futuras mejoras

---

### #H41 · Animaciones inconsistentes — `transition-colors` en la mayoría, `transition-all` en algunos

**Problema:** Revisé estilo de transición: `Button.tsx` usa `transition-all duration-200`. `StatsCard.tsx` usa `transition-all duration-300` con `hover:translate-y-0.5`. Pero `KanbanCard` usa solo `hover:shadow-md`. Los `Link` de Next.js usan lo que decidas en className.

**Por qué afecta:** Sensación de "pulido" depende de consistencia. SaaS modernos tienen easing tokens.

**Solución recomendada:** Tailwind config con tokens de motion:
```js
transitionDuration: { DEFAULT: '150ms', slow: '200ms', slower: '300ms' }
transitionTimingFunction: { 'out-quint': 'cubic-bezier(0.22, 1, 0.36, 1)' }
```
Reemplazar `transition-all` por `transition-[colors,shadow,transform]` específicos.

**Beneficio esperado:** Pulido visual consistente.

- **Impacto:** 🟢 Bajo
- **Esfuerzo:** Bajo
- **Prioridad:** 🛣️ Futuras mejoras

---

### #H42 · Dark mode tiene contraste y acento de color diferente al light mode

**Problema:** El sidebar usa `bg-[#0b0f1a]` (literal hex hardcoded) en ambos modos. El resto usa tokens de Tailwind/shadcn que sí cambian. Los `Card` tienen `dark:bg-white/[0.03]` con `dark:border-white/[0.08]` — un look "glass" en dark, "card" en light.

**Por qué afecta:** Cuando dos modos se ven diferentes no es malo siempre, pero la jerarquía visual debe ser coherente. El sidebar "fijo" en dark hace que el light mode se sienta incompleto.

**Por qué afecta:** Confusión, necesidad de diseñar dos sistemas.

**Solución recomendada:** Estandarizar el sidebar al token del tema (`bg-sidebar` custom en `globals.css`). Mismas proporciones de contraste en ambos modos.

**Beneficio esperado:** Coherencia cross-theme.

- **Impacto:** 🟢 Bajo
- **Esfuerzo:** Bajo
- **Prioridad:** 🛣️ Futuras mejoras

---

### #H43 · Banner de éxito `SuccessBanner` (35 líneas) — convive con `useToast` y `ConfirmDialog` sin uso claro

**Problema:** `components/ui/success-banner.tsx` es un banner verde que aparece en `?msg=creado`. Patrón legacy en páginas `/clientes`, `/proyectos`, `/tareas` (vía `searchParams`). Pero el sistema global ahora tiene `useToast` con duración y mejor feedback. El banner verde desaparece en 3s pero el usuario lo nota poco.

**Por qué afecta:** Dos sistemas de feedback positivo (banner + toast). Confusión.

**Solución recomendada:**
- Mantener `SuccessBanner` solo para "llegué aquí desde otra pantalla tras un redirect del servidor" (donde no hay un cliente activo para mostrar toast).
- Para todas las acciones del lado cliente (POST/PUT/DELETE), usar `useToast`.
- Auditar cada `?msg=` URL y migrar a `useToast` en handlers.

**Beneficio esperado:** Un solo sistema de feedback positivo; más consistencia.

- **Impacto:** 🟢 Bajo
- **Esfuerzo:** Bajo
- **Prioridad:** ⛏️ Hacer inmediatamente

---

## 10. Detalles de productividad (lo que un usuario experto notaría)

### #H44 · No hay atajos de teclado globales (más allá de Cmd+K)

**Problema:** El sistema expone atajos solo en `CommandPalette` (Cmd+K, ↑/↓/Enter/Esc) y en algunos formularios específicos. No hay:
- `g` then `c` → ir a Clientes (estilo GitHub)
- `g` then `p` → ir a Proyectos
- `n` → nuevo (en contexto)
- `/` → enfocar buscador (estilo Algolia/Linear)
- `j/k` → siguiente/anterior fila en tablas

**Por qué afecta:** Los usuarios que más ahorran tiempo son los power users. Sin atajos, terminamos con 80 % del valor gastado por 20 % del tiempo.

**Solución recomendada:** Crear `hooks/useKeyboardShortcuts.ts` y registrar los atajos de navegación global. Indicador `?` que abre un modal listando todos los atajos. Atajos contextuales dentro de cada módulo (ej. en `/proyectos`, `Enter` abrir el proyecto seleccionado).

**Beneficio esperado:** -30 % tiempo de operación para usuarios diarios.

- **Impacto:** 🟠 Medio
- **Esfuerzo:** Medio
- **Prioridad:** ⏭️ Próxima versión

---

### #H45 · No hay deshacer (Undo) para acciones destructivas

**Problema:** ConfirmDialog + toast verde es bueno, pero un clic accidental aún borra datos. Productos modernos (Gmail, Slack, Notion) ofrecen **toast con acción "Deshacer"** durante 5-10 segundos.

**Por qué afecta:** Reduce la sensación de ansiedad del usuario.

**Solución recomendada:** En `useToast`, agregar opción `toast.exito(msg, { action: { label: 'Deshacer', onClick: () => restore() } })`. Para borrados, soft-delete primero (papelera), eliminar físicamente después de 30 días.

**Beneficio esperado:** Cero pérdida accidental de datos; UX más valiente (se puede borrar sin miedo).

- **Impacto:** 🟠 Medio
- **Esfuerzo:** Medio (requiere papelera por modelo)
- **Prioridad:** ⛏️ Hacer inmediatamente (al menos el soft delete)

---

### #H46 · Acciones masivas solo en gastos — falta en tareas, OC, recursos, proyectos

**Problema:** Ya cubierto parcialmente en #H11, pero el alcance es más amplio: tareas tienen archivado individual pero no masivo; OC permite cambio de estado solo uno a uno.

**Por qué afecta:** Mismo argumento que #H11.

**Solución recomendada:** Igual que #H11, con checkboxes de cabecera en cada listado y barra flotante de acciones masivas.

**Beneficio esperado:** -90 % tiempo para operaciones batch.

- **Impacto:** 🔴 Alto
- **Esfuerzo:** Medio
- **Prioridad:** ⏭️ Próxima versión

---

### #H47 · Falta vista mobile-first de los listados

**Problema:** Las tablas actuales no responden al ancho móvil. Usuario en `/tareas` desde el celular → scroll horizontal permanente.

**Por qué afecta:** Aunque el producto es de escritorio primario, los supervisores en obra acceden desde móvil. Una tabla "no usable" en móvil desincentiva el uso en campo.

**Solución recomendada:** Para `tareas`, `gastos`, `horas`, `clientes`, `proyectos`: vista móvil con cards en lugar de tabla cuando `window.innerWidth < 768`. Click en card → detalle. Cada card muestra 3 datos clave (título + 2 métricas).

**Beneficio esperado:** Uso sin fricción desde móvil; adopción por campo.

- **Impacto:** 🟠 Medio
- **Esfuerzo:** Medio (responsive, no nueva lógica)
- **Prioridad:** ⛏️ Hacer inmediatamente

---

### #H48 · Filtros que no se conservan al refrescar (no URL-driven) — excepto `/presupuestos` y `/facturacion`

**Problema:** Cubierto en #H08, pero con alcance mayor: cualquier listado debería tener `?estado=…&q=…` etc.

**Solución recomendada:** Política general: "toda vista de listado debe ser URL-driven con `?param=value&…`". Patrón `PresupuestosBuscador.tsx`.

**Beneficio esperado:** Universal: filtros compartibles, refrescables, linkables.

- **Impacto:** 🔴 Alto
- **Esfuerzo:** Medio (refactor sistemático)
- **Prioridad:** ⛏️ Hacer inmediatamente (siguiente sprint)

---

### #H49 · No hay vista de calendario de tareas por fecha

**Problema:** Las tareas tienen `fechaLimite`. El usuario puede filtrarlas por texto/estado pero no ver "qué tengo que entregar esta semana en formato calendario".

**Por qué afecta:** Estándar en todo SaaS moderno (Todoist, TickTick, Notion, Asana).

**Solución recomendada:** Agregar vista "**Calendario**" en `/tareas`, junto a Lista y Kanban. Mes con tareas como dots de color por estado/prioridad. Click en día → lista del día con opción rápida "+ Nueva tarea".

**Beneficio esperado:** Visualización temporal de la carga de trabajo.

- **Impacto:** 🟠 Medio
- **Esfuerzo:** Medio
- **Prioridad:** ⛭️ Próxima versión

---

### #H50 · `Resumen financiero` del proyecto: 5 cards alineadas horizontalmente — preferir una sola métrica grande

**Problema:** Las 5 cards (`Presupuestado · Gastos directos · M.O. · Overhead · Balance`) son pequeñas (text `text-lg`). Un gerente en mobile tiene que apretar la vista. La única que importa es **Balance = cuánto queda**.

**Por qué afecta:** La "única métrica que importa" está enterrada en la posición 5.

**Solución recomendada:** Mostrar **Balance** como la card principal (text `text-3xl`), con las 4 cards restantes secundarias debajo o como tooltip.

**Beneficio esperado:** Decisión en 1 vistazo.

- **Impacto:** 🟠 Medio
- **Esfuerzo:** Bajo
- **Prioridad:** ⛏️ Hacer inmediatamente

---

## 11. Gaps vs líderes del mercado (lo que Notion / ClickUp / Linear / Monday / Asana / Airtable / Odoo / HubSpot tienen)

Esta sección compara con productos líderes. No sugiere "copiar", sino identificar **capacidades** que un usuario moderno espera.

### #G01 · Notificaciones in-app (además de push/email)

**Problema:** `lib/notificaciones-cron.ts` y `lib/push.ts` sugieren notificaciones push/email. Pero no hay **campana de notificaciones in-app** en el header.

**Lo que falta vs competencia:**
- **Slack, Notion, Asana, HubSpot**: badge de campana con contador, dropdown con notificaciones, marcar como leído, agrupadas por tipo, navegación directa al item relacionado.
- **Solución propuesta:** Componente `<NotificationBell>` en `LayoutShell`, drawer lateral con feed de notificaciones del usuario. Marcar como leído al ver. Acciones rápidas desde la notificación ("Aprobar adicional", "Ver factura").

**Impacto:** 🟠 Medio · **Esfuerzo:** Medio · **Prioridad:** ⏭️ Próxima versión

---

### #G02 · Comentarios en casi todos los registros

**Problema:** Solo proyectos tienen Bitácora y Comentarios (en parte). Clientes, presupuestos, OC, tareas (sí), gastos, no.

**Lo que falta vs competencia:**
- **Linear, Asana, ClickUp, Notion**: hilos de comentarios en cada registro con `@menciones`, reacciones emoji, archivos adjuntos.

**Impacto:** 🟠 Medio · **Esfuerzo:** Medio · **Prioridad:** ⏭️ Próxima versión

---

### #G03 · Adjuntos polimórficos por registro

**Problema:** `/documentos` centraliza pero no hay archivos adjuntos en gastos (sí), OC, presupuestos, clientes. Hay un campo `archivoUrl` en `GastoProyecto` pero no en otros modelos.

**Lo que falta vs competencia:**
- **HubSpot, Odoo, Airtable**: campo "Archivos" en cada ficha; preview sin descargar.

**Impacto:** 🟠 Medio · **Esfuerzo:** Medio · **Prioridad:** ⛏️ Hacer inmediatamente (al menos wire-up en los modelos principales)

---

### #G04 · Automatizaciones ("Si X entonces Y")

**Problema:** El sistema tiene flujos automáticos codificados (auto-archivar tareas hace 7 días, auto-cerrar proyecto al aprobar presupuesto) pero no hay **editor visual de automatizaciones**.

**Lo que falta vs competencia:**
- **Odoo, HubSpot, Monday, Airtable**: "Triggers" configurables sin código. Si el cliente paga → crear tarea de seguimiento. Si se vence presupuesto → notificar vendedor.

**Impacto:** 🔴 Alto · **Esfuerzo:** Alto · **Prioridad:** 🛣️ Futuras mejoras

---

### #G05 · Vista mobile con menú inferior (bottom tab bar)

**Problema:** El sidebar es un drawer lateral en móvil que aparece tras un clic. UX típica moderna (Linear mobile, Notion mobile, Instagram) usa **bottom tab bar** en móvil con 4-5 íconos.

**Lo que falta vs competencia:** Indicador persistente de "dónde estoy" + acciones principales a 1 tap.

**Impacto:** 🟠 Medio · **Esfuerzo:** Bajo-Medio · **Prioridad:** ⏭️ Próxima versión

---

### #G06 · Búsqueda guardada + reportes recurrentes por email

**Problema:** No hay forma de guardar una vista de `/clientes?fuente=Instagram&tipo=Particular` para recibirla por email cada lunes.

**Lo que falta vs competencia:** **Linear, Notion, Monday** permiten "guardar vista" → "recibir resumen semanal".

**Impacto:** 🟢 Bajo-Medio · **Esfuerzo:** Medio · **Prioridad:** 🛣️ Futuras mejoras

---

### #G07 · Modo "offline" con service worker real

**Problema:** Existe `public/sw.js`, registrado (probablemente). Pero falta lógica de **offline-first**: registrar gastos y horas sin conexión y sincronizar al reconectar.

**Lo que falta vs competencia:** Linear, Notion web, Airtable ofrecen offline real. Imprescindible para supervisores en obra sin internet.

**Impacto:** 🔴 Alto (para usuarios campo) · **Esfuerzo:** Alto · **Prioridad:** 🛣️ Futuras mejoras

---

### #G08 · Audit log / historial de cambios visible

**Problema:** Recursos tienen `RecursoPriceHistory`. Pero no hay un feed de "¿qué cambió en este presupuesto?" accesible desde la ficha.

**Lo que falta vs competencia:** Linear tiene `activity` feed en cada entidad; Notion tiene "History" tab.

**Impacto:** 🟢 Bajo-Medio · **Esfuerzo:** Medio-Alto · **Prioridad:** 🛣️ Futuras mejoras

---

### #G09 · Recordatorios / fechas de seguimiento por cliente

**Problema:** Un cliente puede ser contactado cada 30 días. Hoy no hay forma de programar un recordatorio recurrente.

**Lo que falta vs competencia:** HubSpot, Pipedrive tienen recordatorios automáticos.

**Impacto:** 🟠 Medio · **Esfuerzo:** Medio · **Prioridad:** ⏭️ Próxima versión

---

### #G10 · Webhooks / integraciones externas (WhatsApp, DGII, banks)

**Problema:** No hay webhooks. La integración con WhatsApp parece ser manual (`cliente.whatsapp` es texto, no link).

**Lo que falta vs competencia:** Zapier/Make-style automation; deep-link `wa.me/...`; integración con APIs de bancos dominicanos para conciliación.

**Impacto:** 🔴 Alto (estratégico) · **Esfuerzo:** Alto · **Prioridad:** 🛣️ Futuras mejoras

---

## 12. Específicos del dominio de construcción (lo que un ERP de constructoras debe tener)

### #C01 · Cuadrillas y asignación de personal a obra

**Problema:** El modelo `Empleado` existe pero no hay concepto explícito de "Cuadrilla" (team para una obra). Un proyecto puede tener varios empleados asignados pero la UI no lo muestra.

**Lo que falta:** Pantalla `/proyectos/[id]?tab=equipo` con cards de empleados asignados, rol, fechas de inicio/fin, foto.

**Impacto:** 🟠 Medio · **Esfuerzo:** Medio · **Prioridad:** ⏭️ Próxima versión

---

### #C02 · Materiales con cantidad consumida vs presupuestada por partida

**Problema:** En el `Control presupuestario` se ve presupuesto vs gasto ($), pero no se ve **cantidad consumida por material** (kg, ml, unidades). Para el supervisor en obra, es más relevante "¿cuánta varilla de 3/8 he metido?" que "¿cuánto he gastado en varilla?".

**Lo que falta:** En `ProyectoPartida`, agregar `cantidadEjecutada` y `cantidadPresupuestada`. Mostrar en la vista de control como dos barras paralelas.

**Impacto:** 🟠 Medio · **Esfuerzo:** Medio (requiere migración de modelo) · **Prioridad:** ⏭️ Próxima versión

---

### #C03 · Avance físico diferenciado (obra vs melamina)

**Problema:** El proyecto tiene `avanceFisico` global. Para remodelaciones que incluyen cocina, el avance de cocina vs avance de obra general deberían poder medirse por separado.

**Lo que falta:** Un panel de avance desglosado por módulo: "Obra civil 60% · Cocina 30% · Instalación eléctrica 80%".

**Impacto:** 🟠 Medio · **Esfuerzo:** Medio-Alto · **Prioridad:** 🛣️ Futuras mejoras

---

### #C04 · Visualización de planos / fotos en línea de tiempo

**Problema:** El proyecto tiene Documentos pero no hay flujo "fotos del antes / durante / después" organizado por fecha.

**Lo que falta:** Sección "Galería de obra" en `/proyectos/[id]?tab=fotos` con timeline vertical (estilo Instagram para obras).

**Impacto:** 🟠 Medio · **Esfuerzo:** Medio · **Prioridad:** ⏭️ Próxima versión

---

### #C05 · Cotización → negociación → contrato → ejecución, todo en una vista timeline

**Problema:** La trazabilidad Cotización → Contrato → Ejecución existe en datos pero no hay una vista "línea de tiempo del cliente" que conecte los eventos visualmente.

**Lo que falta:** En `/clientes/[id]` o `/proyectos/[id]`, un timeline vertical con: Presupuesto creado · Enviado · Visto por cliente · Aprobado · Adicional · Cobros parciales · Cierre.

**Impacto:** 🔴 Alto (gran diferenciación vs competencia) · **Esfuerzo:** Medio · **Prioridad:** 🔥 Hacer inmediatamente (es la pieza más diferenciable)

---

## 13. Tabla priorizada — Top 20 victorias (foco en **🔥 Hacer inmediatamente**)

| # | Hallazgo | Impacto | Esfuerzo | Prioridad |
|---|---------|---------|----------|-----------|
| 1 | #H03 Cmd+K debe buscar más entidades + recientes + fuzzy | 🔴 | B-M | 🔥 |
| 2 | #H06 Reordenar dashboard por criticidad | 🔴 | B | 🔥 |
| 3 | #H10 Edición inline en todas las tablas | 🔴 | M | 🔥 |
| 4 | #H19 Aplanar tabs del proyecto (sin "grupos") | 🔴 | M | 🔥 |
| 5 | #H20 Reordenar "Resumen" del proyecto por criticidad | 🔴 | M | 🔥 |
| 6 | #H27 Hacer del OCR la opción #1 en GastoForm | 🔴 | B | 🔥 |
| 7 | #H32 Crear `/dashboard/personal` (Mi día) | 🟠 | M | 🔥 |
| 8 | #H33 Vista previa en vivo del PDF en PresupuestoV2 | 🔴 | M | 🔥 |
| 9 | #C05 Timeline del cliente/proyecto (diferenciador) | 🔴 | M | 🔥 |
| 10 | #H07 Búsqueda en tiempo real en `/clientes` | 🟠 | B | 🔥 |
| 11 | #H15 Redirect /presupuestos/[id]/editar → /editar-v2 | 🟠 | B | 🔥 |
| 12 | #H21 Migrar todos los ConfirmDialog restantes | 🔴 | M | 🔥 |
| 13 | #H18 router.refresh tras mutaciones + revalidar foco | 🟢 | B | 🔥 |
| 14 | #H37 Centralizar badges por dominio (eliminar hardcoded) | 🟠 | B-M | 🔥 |
| 15 | #H38 Eliminar botones hardcoded fuera de `<Button>` | 🟠 | B | 🔥 |
| 16 | #H43 Reemplazar SuccessBanner con useToast en handlers | 🟢 | B | 🔥 |
| 17 | #H26 Refactorizar `GastosTab` en sub-componentes | 🟠 | M | 🔥 |
| 18 | #H48 Política general: listados URL-driven | 🔴 | M | ⏭️ |
| 19 | #H16 EmpleadoForm con tabs + autosave | 🔴 | M | ⏭️ |
| 20 | #H47 Vistas mobile de los listados | 🟠 | M | ⏭️ |

---

## 14. Plan de implementación sugerido (en sprints de 2 semanas)

### Sprint 1 — Fundaciones de feedback y reordenamiento (impacto inmediato)
- #H07 (búsqueda clientes en tiempo real)
- #H18 (router.refresh + revalidar foco)
- #H21 (migrar ConfirmDialog restantes)
- #H27 (OCR como opción #1 en GastoForm)
- #H37 (consolidar badges)
- #H38 (eliminar botones hardcoded)
- #H43 (SuccessBanner → useToast)
- #H15 (redirect legacy presupuestos)

### Sprint 2 — Acelerar al usuario experto
- #H10 (edición inline)
- #H06 (reordenar dashboard)
- #H20 (reordenar resumen proyecto)
- #H50 (Balance como métrica principal)
- #H03 (extender CommandPalette)
- #H28 (filtros persistentes)

### Sprint 3 — Diferenciación y vistas alternativas
- #H19 (aplanar tabs proyecto)
- #H33 (preview en vivo PDF presupuesto)
- #H36 (Kanban para presupuestos/oportunidades)
- #C05 (timeline del cliente/proyecto)
- #H32 (`/dashboard/personal`)

### Sprint 4 — Productividad avanzada
- #H11/#H46 (acciones masivas)
- #H16 (EmpleadoForm con tabs)
- #H17 (validación con react-hook-form + Zod)
- #H26 (refactor GastosTab)
- #H22 (combobox vincular presupuesto)

### Sprint 5 — Mobile, integraciones y polish
- #H47 (vistas mobile)
- #H05 (breadcrumbs)
- #H44 (atajos de teclado globales)
- #H49 (calendario de tareas)
- #G05 (bottom tab bar móvil)

### Backlog estratégico (no bloqueante)
- #G01 campana de notificaciones
- #G02 comentarios por registro
- #G04 editor de automatizaciones
- #G07 offline real
- #C01 / #C02 / #C03 / #C04 mejoras específicas de construcción

---

## 15. Métricas de éxito sugeridas

Después del Sprint 1-2, se deberían poder medir (vía analytics o heatmaps):

- **Time-to-action**: del login al primer clic significativo.
  - Meta: bajar de 30s a 10s.
- **Clics por tarea**: tareas completadas por sesión.
  - Meta: subir 25 % con edición inline + atajos.
- **Búsquedas abandonadas**: cuántas búsquedas devuelven 0 resultados.
  - Meta: bajar 50 % con fuzzy + chips visibles.
- **Uso de Cmd+K**: open/close events × usuario activo.
  - Meta: >3 aperturas/usuario/semana.
- **% de operaciones via edición inline vs modal**: con logging ligero.
- **Net Promoter Score interno**: tras deploy v1.6.

---

## 16. Cierre

El producto tiene una base técnica sólida, decisiones de UX atinadas (toasts, palette, kanban, módulo de gastos con OCR) y un equipo que itera rápido (5 fases UX en junio 2026). Las recomendaciones de esta auditoría apuntan a:

- **Eliminar inconsistencia** (badges, botones, iconos) — bajo esfuerzo, alto retorno.
- **Convertir listados en URL-driven + paginación server-side** — elimina deuda conocida.
- **Aplanar jerarquías de tabs en pantallas críticas** — reduce carga cognitiva sin reescribir lógica.
- **Adoptar el patrón "crear en contexto"** — ClickUp/Asana lo demostraron.

El Top 20 priorizado representa ~5 semanas de trabajo concentrado con **impacto masivo en la productividad diaria**. Los gaps vs líderes (automatizaciones, offline, webhooks) son proyectos de 2-3 meses y posicionan al producto de forma diferencial.

Para avanzar: proponer al equipo el **Sprint 1** tal como está descrito — son tareas de bajo/medio esfuerzo, alto impacto, y dejan el código listo para los siguientes sprints sin reescrituras.

