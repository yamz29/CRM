# Empleados

## ¿Qué hace?
Mantiene la ficha de cada empleado: datos personales, cargo, departamento, fecha de ingreso/salida, horario contractual y solicitudes de vacaciones/permisos con su saldo de días.

## ¿Para qué sirve?
Tener en un solo lugar la información laboral del equipo y controlar cuántos días de vacaciones le quedan a cada empleado, sin depender de hojas de cálculo externas.

---

## Cómo se usa

### Crear un empleado
1. Ir a **Empleados → Nuevo Empleado**
2. Completar nombre, cédula, cargo y departamento
3. Indicar la **fecha de ingreso**
4. Definir el horario contractual: activar cada día laborable y su hora de entrada/salida/horas — cada día es independiente, así que viernes o sábado pueden tener un horario distinto al resto de la semana
5. (Opcional) Vincular el empleado a un **usuario del sistema** para sumar automáticamente sus horas de "Horas del equipo"
6. Definir los **días de vacaciones por año** (por defecto 14, según ley dominicana)
7. Guardar

### Registrar vacaciones o permisos
1. Entrar a la ficha del empleado
2. En la sección **Vacaciones y permisos**, click en **Nueva solicitud**
3. Elegir el tipo (Vacaciones / Permiso / Licencia Médica / Otro), las fechas y un motivo opcional
4. La solicitud queda en estado **Solicitado** hasta que se apruebe o rechace
5. Al aprobar una solicitud de tipo Vacaciones, los días se restan del saldo anual disponible

### Salario
El campo salario es sensible y **solo lo ve y edita el usuario con rol Admin**. El resto de usuarios con acceso al módulo no lo verá en ninguna pantalla ni reporte.

### Horas del equipo
Si el empleado está vinculado a un usuario del sistema, su ficha muestra el total de horas registradas ese mes en el módulo "Horas del equipo" (modelo `RegistroHoras`, asociado al login del usuario). Este vínculo es manual y opcional — se configura desde el formulario de edición del empleado.

---

## Campos importantes

| Campo | Qué significa |
|-------|--------------|
| Fecha de ingreso/salida | Marca el inicio y fin de la relación laboral |
| Horario contractual | Entrada, salida y horas por día — configurable de forma independiente para cada día de la semana |
| Usuario vinculado | Cuenta del sistema cuyas horas de "Horas del equipo" se suman en la ficha del empleado |
| Días de vacaciones por año | Derecho anual del empleado (configurable por empleado) |
| Saldo disponible | Días de vacaciones aprobados restados al derecho anual del año en curso |

---

## Errores comunes

- ❌ **No marcar "Aprobado" una solicitud de vacaciones** → el saldo disponible no se actualiza
- ❌ **Cambiar a "Inactivo" sin poner fecha de salida** → dificulta el historial laboral

---

## Tips

- 💡 Usa el filtro de "Activos/Inactivos" en la lista para ver solo el personal vigente
- 💡 El saldo de vacaciones se recalcula automáticamente cada año calendario
