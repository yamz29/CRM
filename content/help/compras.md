# Órdenes de Compra

## ¿Qué hace?
Gestiona el proceso formal de compra de materiales y servicios a proveedores, desde la solicitud hasta la recepción y facturación.

## ¿Para qué sirve?
Formalizar las compras con un documento numerado (OC-2026-0001), hacer seguimiento de lo que se pidió vs. lo que se recibió, y tener trazabilidad del gasto antes de que llegue la factura.

---

## Flujo de estados

```
Borrador → Enviada → Recibida parcial → Recibida → Facturada
                                                  → Cancelada
```

| Estado | Significado |
|--------|------------|
| **Borrador** | En preparación, se pueden agregar/editar items |
| **Enviada** | Enviada al proveedor, esperando entrega |
| **Recibida parcial** | Algunos items recibidos, otros pendientes |
| **Recibida** | Todos los items recibidos en su totalidad |
| **Facturada** | La factura del proveedor fue registrada |
| **Cancelada** | Orden cancelada (solo desde borrador) |

---

## Cómo se usa

### Crear una orden de compra
1. Ir a **Compras → Nueva OC**
2. Seleccionar el **proveedor** del catálogo (las condiciones de pago se copian automáticamente)
3. Opcionalmente vincular a un **proyecto**
4. Definir fecha de entrega estimada
5. Clic en **Crear y agregar items** — se abre el detalle de la OC

### Agregar líneas (items)
En el detalle de la OC:
1. Clic en **Agregar línea**
2. Completar: descripción, unidad, cantidad, precio unitario
3. El subtotal se calcula automáticamente
4. Los totales de la OC se actualizan en tiempo real

### Editar y eliminar items
- Solo se pueden editar/eliminar items cuando la OC está en **borrador**
- Clic en el ícono de lápiz para editar, o papelera para eliminar

### Enviar al proveedor
Cuando la OC está lista:
1. Clic en **Marcar como enviada**
2. El estado cambia y los items ya no son editables

### Registrar recepción
Cuando llegan los materiales:
1. Clic en **Registrar recepción**
2. Para cada item, ingresa la cantidad recibida
3. Clic en **Confirmar recepción**
4. El sistema determina automáticamente si es recepción parcial o total

### Marcar como facturada
Cuando llega la factura del proveedor:
1. Clic en **Marcar facturada**
2. Se recomienda crear la factura de egreso correspondiente en Contabilidad

---

## KPIs de la lista

En la vista principal de Compras se muestran:
- **Total OC**: cantidad de órdenes de compra
- **Pendiente de recibir**: valor total de OC en borrador o enviadas
- **Total recibido**: valor total de OC recibidas y facturadas

---

## Detalle de la OC

La vista de detalle muestra:
- Datos del proveedor (nombre, RNC, teléfono, correo)
- Proyecto vinculado (con link directo)
- Tabla de items con cantidad pedida vs recibida
- Totales: subtotal, ITBIS y total

---

## Tips

- Crea la OC antes de hacer la compra — sirve como respaldo y control
- Vincula siempre al proyecto para que el gasto sea trazable
- Registra la recepción para saber qué falta por entregar
- Usa las condiciones de pago del catálogo de proveedores para consistencia
