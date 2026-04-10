# Control de Horas

## ¿Qué hace?
Registra las horas trabajadas por cada miembro del equipo, vinculadas a un proyecto específico o a trabajo general del negocio.

## ¿Para qué sirve?
Conocer el costo real de mano de obra por proyecto, controlar la productividad del equipo y tener evidencia del tiempo dedicado a cada obra si el cliente lo solicita.

---

## Cómo se usa

### Registrar horas
1. Ir a **Horas → Nueva entrada**
2. Seleccionar el **empleado**
3. Seleccionar el **proyecto** al que corresponden las horas
4. Ingresar la **fecha** y la **cantidad de horas**
5. Agregar una **descripción** breve del trabajo realizado
6. Guardar

### Ver reportes
- Filtra por empleado, proyecto o rango de fechas
- El resumen muestra el total de horas y el costo de mano de obra estimado

---

## Campos importantes

| Campo | Qué significa |
|-------|--------------|
| Empleado | Miembro del equipo que realizó el trabajo |
| Proyecto | Obra a la que se cargan las horas |
| Horas | Cantidad de horas trabajadas en esa sesión |
| Descripción | Qué trabajo se realizó (ej: "Instalación módulos cocina") |

---

## Ejemplo real

El carpintero **Ramón** trabaja el lunes en la **"Residencia García"**:
- Mañana (4 hrs): Armado de módulos base
- Tarde (4 hrs): Instalación de puertas y bisagras

Se registran dos entradas o una sola de 8 horas con descripción combinada.

Al cierre del mes, el sistema muestra:
- Proyecto "Residencia García": **48 horas de carpintería** → costo mano de obra: **RD$ 12,000**
- Proyecto "Edificio Centro": **32 horas** → costo: **RD$ 8,000**

---

## Factor de carga social

El costo de mano de obra se calcula como:

```
Costo real = Horas × Costo/hora del empleado × Factor de carga social
```

El **factor de carga social** se configura en **Configuración → Costos** y refleja las prestaciones laborales obligatorias en RD (vacaciones, regalía navideña, seguro familiar de salud, AFP, riesgos laborales, etc.).

Ejemplo: con costo/hora de RD$ 500 y factor 1.45 → el costo real por hora es **RD$ 725**.

Este costo aparece en el resumen financiero del proyecto como "M.O. Interna" con la indicación del factor aplicado.

---

## Errores comunes

- ❌ **Registrar horas días después sin recordar los detalles** → pierde precisión la descripción. Registra el mismo día o al final de cada jornada
- ❌ **No vincular horas a un proyecto** → el costo de mano de obra queda invisible en el análisis del proyecto
- ❌ **Un solo empleado "general"** → crea un empleado por persona para poder analizar la productividad individual

---

## Tips

- 💡 Registrar al final de cada jornada toma menos de 2 minutos y da información muy valiosa
- 💡 La descripción del trabajo ayuda a justificar el tiempo ante el cliente en caso de disputas
- 💡 Compara las horas estimadas en el APU vs. las horas reales registradas → verás si tus estimaciones son precisas
