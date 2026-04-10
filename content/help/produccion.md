# Producción (Taller)

## ¿Qué hace?
Gestiona el proceso de fabricación de módulos de melamina en el taller, desde la compra de materiales hasta el control de calidad final, pasando por 8 etapas de producción.

## ¿Para qué sirve?
Llevar control visual del flujo de fabricación, asignar trabajadores a cada etapa, verificar la calidad en puntos clave y saber en todo momento dónde está cada módulo en el proceso.

---

## Etapas de producción

```
Compra de Materiales → Recepción → Corte → Canteo → Mecanización → QC Proceso → Ensamble → QC Final
```

| Etapa | Qué ocurre |
|-------|-----------|
| **Compra de Materiales** | Se generan y gestionan las compras necesarias |
| **Recepción** | Se verifica que llegó todo lo pedido |
| **Corte** | Se cortan las planchas según el despiece |
| **Canteo** | Se aplica canto a las piezas cortadas |
| **Mecanización** | Perforaciones, bisagras, rieles, etc. |
| **QC Proceso** | Control de calidad antes de ensamblar |
| **Ensamble** | Se arma el módulo completo |
| **QC Final** | Inspección final antes de despachar |

---

## Cómo se usa

### Crear una orden de producción
1. Ir a **Producción → Nueva orden**
2. Dos opciones:
   - **Importar desde presupuesto**: selecciona un presupuesto con módulos de melamina y el sistema crea los items automáticamente
   - **Agregar manualmente**: crea items uno por uno con nombre, tipo y dimensiones

### Vista Kanban
La vista principal muestra un tablero tipo Kanban con 8 columnas (una por etapa). Cada tarjeta es un módulo en producción.

- **Arrastrar y soltar**: mueve un módulo a la siguiente etapa
- **Colores de prioridad**: Alta (rojo), Media (amarillo), Baja (verde)

### Control de calidad (QC)
En las etapas de QC se presenta un checklist que debe completarse antes de avanzar:

**QC Proceso** (antes de ensamble):
- Piezas cortadas a medida correcta
- Canteado aplicado correctamente
- Mecanizaciones completas
- Sin defectos visuales
- Materiales coinciden con especificación

**QC Final** (después de ensamble):
- Ensamble firme y escuadrado
- Herrajes funcionales
- Acabado limpio sin marcas
- Dimensiones finales correctas
- Listo para instalación

### Asignar trabajadores
Cada item puede tener trabajadores asignados por etapa. Esto permite saber quién está trabajando en qué.

### Lista de materiales
La orden de producción genera automáticamente una lista consolidada de materiales necesarios (tableros, cantos, herrajes) con cantidades totales.

---

## Estados de la orden

| Estado | Significado |
|--------|------------|
| **Pendiente** | Creada pero sin iniciar |
| **En Proceso** | Al menos un item está en producción |
| **Completada** | Todos los items pasaron QC Final |
| **Cancelada** | Orden cancelada |

La orden se marca automáticamente como **Completada** cuando el último item pasa QC Final.

---

## Tips

- Importa desde presupuesto para no tener que copiar datos manualmente
- Actualiza la etapa de cada módulo en tiempo real para tener visibilidad
- No saltes QC Proceso — detectar errores antes de ensamblar ahorra material y tiempo
- Asigna trabajadores para saber la carga de trabajo de cada persona
