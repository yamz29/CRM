# Nómina

## ¿Qué hace?
Genera períodos de pago quincenales con una línea por cada empleado activo que tiene salario asignado, calcula horas extra, AFP y SFS, y produce una plantilla en Excel lista para pagar (transferencia bancaria).

## ¿Para qué sirve?
Reemplazar la hoja de cálculo manual de nómina: el sistema calcula automáticamente las deducciones de ley y deja un historial de cada quincena pagada.

---

## Cómo se usa

### Crear un período
1. Ir a **Nómina → Nuevo Período**
2. Confirmar o ajustar las fechas de la quincena (1-15 o 16-fin de mes)
3. Guardar — se crea una línea por cada empleado **activo con salario asignado**

### Ajustar horas extra y bonificaciones
1. Entrar al período (estado **Borrador**)
2. Por cada empleado, editar **Horas extra**, **Bonificaciones** u **Otros descuentos**
3. Click en el ícono de guardar de la fila — el sistema recalcula AFP, SFS y el total neto al instante

### Descargar la plantilla de pago
- Botón **Descargar plantilla de pago**: genera un Excel con nombre, cédula, banco, número de cuenta y el desglose completo de cada pago — listo para subir al banco o repartir como comprobante
- Los usuarios sin rol Admin descargan solo los datos bancarios (sin el detalle salarial)

### Cerrar el período
- Botón **Marcar como Pagada**: congela el período (ya no se pueden editar las líneas) y registra la fecha de pago

---

## Cómo se calcula

```
Salario base (quincena) = Salario mensual / 2
Tarifa hora              = (Salario mensual / 23.83) / Horas por día
Valor hora extra         = Horas extra × Tarifa hora × Factor hora extra (1.35 por defecto)
Total bruto               = Salario base + Valor hora extra + Bonificaciones
AFP                       = Total bruto × 2.87%
SFS                       = Total bruto × 3.04%
Total neto                = Total bruto − AFP − SFS − Otros descuentos
```

Las tasas de AFP, SFS y el factor de hora extra se configuran en **Configuración → Nómina**.

**Simplificación deliberada**: no se aplican topes salariales a AFP/SFS ni se calcula ISR (impuesto sobre la renta). Si un empleado supera el tope o aplica retención de ISR, ajusta manualmente con el campo **Otros descuentos**.

---

## Campos importantes

| Campo | Qué significa |
|-------|--------------|
| Horas extra | Se ingresan manualmente por línea — el sistema no las calcula desde asistencia |
| Banco / Tipo de cuenta / Número de cuenta | Datos del empleado usados para armar la plantilla de pago (se editan en la ficha del empleado) |
| Estado | Borrador (editable) → Pagada (congelado, con fecha de pago) |

---

## Errores comunes

- ❌ **Empleado sin salario asignado** → no aparece en el período (revisa su ficha en Empleados)
- ❌ **Editar líneas después de marcar Pagada** → no se puede; si hubo un error, crea un ajuste en el siguiente período
- ❌ **No registrar el banco/cuenta del empleado** → la plantilla sale con esas columnas vacías

---

## Tips

- 💡 Revisa el botón **Marcar como Pagada** solo cuando ya verificaste todas las líneas — congela el período
- 💡 Sugerencias para evolucionar este módulo: regalía navideña (13vo sueldo), vincular vacaciones aprobadas al descuento de días, y tope salarial de AFP/SFS si la empresa lo requiere
