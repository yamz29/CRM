# Cronogramas (Gantt)

## ¿Qué hace?
Planifica las actividades de una obra en un diagrama Gantt interactivo con dependencias, avance por actividad y seguimiento de plazos.

## ¿Para qué sirve?
Visualizar la secuencia de trabajo, identificar actividades atrasadas y coordinar cuadrillas. Se vincula al proyecto y opcionalmente al presupuesto para generar actividades desde las partidas.

---

## Cómo se usa

### Crear un cronograma
1. Ir a **Cronogramas → Nuevo cronograma**
2. Completar nombre, fecha de inicio y vincular al proyecto
3. Agregar actividades manualmente o generar desde un presupuesto

### Generar desde presupuesto
Si el cronograma está vinculado a un proyecto con presupuesto aprobado:
1. Clic en **Generar desde presupuesto**
2. El sistema crea una actividad por cada partida del presupuesto
3. Las actividades se agrupan por capítulo
4. Ajusta fechas y duraciones según la planificación real

### Agregar actividades manualmente
1. Clic en **Nueva actividad**
2. Completar: nombre, fecha inicio, duración (días), cuadrilla asignada
3. Opcionalmente definir dependencia (ej: "no puede empezar hasta que termine X")

---

## Diagrama Gantt

El Gantt muestra:
- **Barras de actividad**: longitud proporcional a la duración
- **Barras de avance**: porcentaje completado en color sobre la barra
- **Dependencias**: líneas que conectan actividades secuenciales
- **Hitos**: puntos diamante para eventos clave (ej: "Entrega de cocina")
- **Línea de hoy**: referencia visual del día actual

### Colores de estado
| Color | Estado |
|-------|--------|
| Gris | Pendiente |
| Azul | En Ejecución |
| Verde | Completado |
| Rojo | Atrasado (fecha fin pasada y no completado) |

---

## Registrar avance

1. Clic en una actividad para expandir el detalle
2. Ingresar el porcentaje de avance (0-100%)
3. Opcionalmente agregar un comentario y seleccionar el usuario que reporta
4. El avance se registra con fecha y queda en el historial

---

## Dependencias

Las actividades pueden tener dependencias tipo **Fin-Inicio (FS)**: la actividad B no puede empezar hasta que termine A.

Ejemplo:
- "Piso porcelanato" depende de "Demolición de piso"
- "Pintura" depende de "Estucado"

---

## Estados del cronograma

| Estado | Significado |
|--------|------------|
| Planificado | Aún no ha iniciado la ejecución |
| En Ejecución | Obra en progreso |
| Pausado | Detenido temporalmente |
| Terminado | Todas las actividades completadas |

---

## Vínculo con el proyecto

Desde el tab **Resumen** del proyecto se muestran todos los cronogramas vinculados con acceso directo al Gantt. También puedes crear un cronograma nuevo pre-vinculado desde ahí.

---

## Tips

- Asigna cuadrillas a las actividades para saber quién está en qué tarea
- Actualiza el avance al menos semanalmente para detectar atrasos temprano
- Usa hitos para marcar entregas parciales o inspecciones importantes
- Si una actividad tiene rendimiento definido en el APU, la duración se calcula automáticamente
