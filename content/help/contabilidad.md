# Contabilidad

## ¿Qué hace?
Gestiona facturas de ingreso y egreso, pagos, cuentas bancarias y conciliación. Es el módulo de control financiero operativo del negocio.

## ¿Para qué sirve?
Llevar registro de lo que se cobra y se paga, conciliar con los estados de cuenta del banco, y tener visibilidad del flujo de caja. No es un sistema fiscal — para eso se usa el ERP del contador externo.

---

## Tabs del módulo

| Tab | Contenido |
|-----|-----------|
| **Facturas** | Listado de facturas de ingreso y egreso con estado de pago |
| **Cuentas** | Cuentas bancarias con saldo calculado desde movimientos |
| **Conciliación** | Cruce de movimientos bancarios con facturas registradas |
| **Proveedores** | Catálogo de suplidores (también accesible desde /proveedores) |

---

## Facturas

### Crear una factura
1. Ir a **Contabilidad → Nueva factura**
2. Seleccionar **tipo**: ingreso (cobro a cliente) o egreso (pago a proveedor)
3. Completar: número, fecha, monto, ITBIS
4. Para egresos: seleccionar proveedor del catálogo
5. Para ingresos: seleccionar cliente
6. Opcionalmente vincular a un proyecto

### Campos importantes

| Campo | Significado |
|-------|------------|
| NCF | Número de Comprobante Fiscal — requerido para fines fiscales en RD |
| Destino | A qué se imputa: proyecto específico, oficina, taller o general |
| Estado | pendiente / parcial / pagada / anulada |
| Proveedor | Suplidor del catálogo normalizado (para egresos) |

### Importar facturas desde CSV
Para carga masiva de facturas de egreso:
1. Preparar un CSV con columnas: numero, fecha, proveedor, descripcion, subtotal, itbis, total
2. Ir a **Contabilidad → Importar CSV**
3. Subir el archivo — el sistema crea las facturas y vincula proveedores automáticamente

---

## Registrar pagos

1. Desde la factura, clic en **Registrar pago**
2. Ingresar monto, fecha, método de pago (Transferencia, Efectivo, Cheque, Tarjeta)
3. Seleccionar la cuenta bancaria de origen
4. El pago se registra y el estado de la factura se actualiza automáticamente:
   - Si el total pagado = total factura → **Pagada**
   - Si el total pagado < total factura → **Parcial**

---

## Cuentas bancarias

Registra las cuentas del negocio (corriente, ahorro, tarjeta de crédito) con saldo inicial. Los movimientos (débitos y créditos) ajustan el saldo automáticamente.

### Tipos de cuenta
- **Corriente / Ahorro**: saldo = saldo inicial + créditos - débitos
- **Tarjeta de crédito**: saldo = débitos - créditos (deuda)

---

## Conciliación bancaria

Permite cruzar los movimientos registrados con el estado de cuenta real del banco:
1. Seleccionar la cuenta bancaria
2. Marcar cada movimiento como **conciliado** cuando coincida con el extracto
3. Los movimientos no conciliados quedan pendientes de revisión

---

## Resumen financiero (KPIs)

En la parte superior del módulo se muestran:
- **Total ingresos**: suma de facturas de ingreso
- **Total egresos**: suma de facturas de egreso
- **Cobrado / Pagado**: montos efectivamente cobrados y pagados
- **Por cobrar / Por pagar**: saldos pendientes

---

## Tips

- Registra las facturas en el momento, no al final del mes
- Vincula siempre las facturas de egreso al proyecto correspondiente para que el control presupuestario sea preciso
- Usa NCF para todas las facturas que necesiten soporte fiscal
- Concilia semanalmente para detectar discrepancias temprano
