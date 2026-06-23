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
4. Definir el horario contractual: hora de entrada/salida, horas por día y días laborables
5. Definir los **días de vacaciones por año** (por defecto 14, según ley dominicana)
6. Guardar

### Registrar vacaciones o permisos
1. Entrar a la ficha del empleado
2. En la sección **Vacaciones y permisos**, click en **Nueva solicitud**
3. Elegir el tipo (Vacaciones / Permiso / Licencia Médica / Otro), las fechas y un motivo opcional
4. La solicitud queda en estado **Solicitado** hasta que se apruebe o rechace
5. Al aprobar una solicitud de tipo Vacaciones, los días se restan del saldo anual disponible

### Salario
El campo salario es sensible y **solo lo ve y edita el usuario con rol Admin**. El resto de usuarios con acceso al módulo no lo verá en ninguna pantalla ni reporte.

---

## Campos importantes

| Campo | Qué significa |
|-------|--------------|
| Fecha de ingreso/salida | Marca el inicio y fin de la relación laboral |
| Horario contractual | Hora de entrada, salida y horas por día pactadas |
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
