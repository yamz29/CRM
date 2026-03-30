# Informe de Prueba ERP Gonzalva

## 1. Resumen ejecutivo
El sistema ERP Gonzalva presenta un nivel de madurez **medio-alto**. Es una herramienta robusta para la gestión técnica de presupuestos (APUs) y fabricación de mobiliario (Melamina). La interfaz es moderna, rápida y está bien enfocada en el flujo de trabajo de una constructora o taller dominicano.

**Veredicto:** El sistema **ya es apto para uso real** en el área de presupuestos y control de proyectos, aunque requiere pulir detalles de validación en la entrada de datos para evitar errores de usuario.

---

## 2. Lo que funciona bien
- **Catálogo y APU**: La integración es fluida; cualquier cambio en "Recursos" se hereda correctamente al crear nuevas partidas.
- **Constructor V2**: Es la "joya de la corona". Permite una organización jerárquica (Título -> Capítulo -> Partida) comparable a software profesional pesado.
- **Módulo de Melamina**: El despiece automático y cálculo de aprovechamiento de planchas es un valor agregado crítico para talleres.
- **Reportes Profesionales**: Las cotizaciones impresas tienen un formato limpio y profesional, listas para el cliente final.

---

## 3. Errores encontrados

### Bug 1: Concatenación de cantidades en Constructor V2
- **Módulo:** Presupuestos (Constructor V2)
- **Severidad:** Alta
- **Pasos para reproducir:**
  1. Abrir edición de un presupuesto en V2.
  2. Al insertar una partida, el campo de cantidad a veces no se limpia, concatenando el nuevo valor con el "1" predeterminado.
- **Resultado actual:** Cantidades erróneas (ej: "101" en vez de "10").
- **Hipótesis:** No hay un evento `selectAll` o `clearOnFocus` en el input.
- **Recomendación:** Implementar `onFocus="this.select()"` en todos los campos numéricos del constructor.

### Bug 2: Capítulos vacíos en impresión
- **Módulo:** Reportes / Presupuestos
- **Severidad:** Baja
- **Pasos para reproducir:**
  1. Crear un presupuesto con varios títulos sugeridos pero solo usar uno.
  2. Imprimir la cotización.
- **Resultado actual:** El PDF muestra capítulos con valor $0.00 que ensucian el documento.
- **Recomendación:** Filtrar y no renderizar en el reporte filas cuyo subtotal sea exactamente 0.

---

## 4. Problemas de UX / flujo
- **Dropdowns Saturados**: En el módulo de APU, el selector de recursos es un dropdown normal. Con un catálogo real de 500+ materiales, será inmanejable.
- **Navegación Circular**: Al guardar un recurso, sería ideal volver a la búsqueda filtrada anterior en lugar de a la lista general completa.

---

## 5. Inconsistencias de lógica de negocio
- **Utilidad sobre Indirectos**: El sistema suma (Costo Directo + Indirectos) y sobre eso aplica la Utilidad. Es válido, pero muchas constructoras prefieren separar la utilidad del costo administrativo (Indirectos). Sería ideal que fuera configurable.

---

## 6. Riesgos técnicos o funcionales
- **Actualización de Precios Histórica**: No hay un botón para "Actualizar precios" en un presupuesto viejo si los materiales en el catálogo subieron. Esto obliga a borrar y re-insertar partidas manualmente.

---

## 7. Top 10 mejoras más valiosas
1.  **Búsqueda en Selectores**: Implementar Select2 o similar en todos los dropdowns de materiales.
2.  **Duplicar Presupuesto**: Botón de clonar para no empezar de cero cada vez.
3.  **Exportación a Excel**: Habilitar descarga en .xlsx para ajustes manuales externos.
4.  **Actualización Masiva por %**: Poder subir 5% a todos los recursos de una categoría.
5.  **Estado Automático**: Que el proyecto pase a "Activo" al aprobar el presupuesto.
6.  **Fotos en Melamina**: Asociar renders o bocetos al módulo de fabricación.
7.  **Resumen de Materiales**: Generar lista de compra total sumando todas las partidas.
8.  **Firma Digital**: Espacio configurable para firma del supervisor en el reporte.
9.  **Validación de RNC**: Plugin de validación para el formato de cédula/RNC de Rep. Dom.
10. **Tooltip de Ayuda**: Pequeños `?` que expliquen términos como "P.A." (Precio Alzado).

---

## 8. Prioridad recomendada
- **Arreglar de inmediato**: Bug de cantidades en Constructor V2.
- **Mejorar pronto**: Searchable Selects y Duplicar Presupuesto.
- **Puede esperar**: Exportación a Excel y sistema de notificaciones.

---

## 9. Veredicto final
- **¿La app ya puede usarse?** Sí.
- **¿Para qué sí?** Cotizaciones de obra civil, despiece de melamina y control financiero de proyectos.
- **¿Para qué todavía no?** Control de inventario físico (stock en almacén) o contabilidad fiscal.
- **Siguiente paso inteligente**: Refinar la usabilidad del Constructor V2, ya que es donde el usuario pasa la mayor parte del tiempo.
