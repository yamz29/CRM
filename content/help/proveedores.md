# Proveedores

## ¿Qué hace?
Mantiene un catálogo normalizado de suplidores, contratistas y proveedores de servicios con sus datos de contacto y condiciones comerciales.

## ¿Para qué sirve?
Estandarizar los nombres de proveedores en facturas y órdenes de compra. En lugar de escribir el nombre a mano cada vez (con variaciones como "Ferretería Central", "FERRETERIA CENTRAL SRL", "Ferr. Central"), se selecciona del catálogo.

---

## Cómo se usa

### Crear un proveedor
1. Ir a **Proveedores → Nuevo proveedor**
2. Completar los datos:
   - **Nombre / Razón social**: nombre oficial
   - **RNC / Cédula**: para fines fiscales
   - **Teléfono**: número principal
   - **Persona de contacto**: nombre del vendedor o representante
   - **Correo**: email de contacto
   - **Condiciones de pago**: ej: "30 días", "contado", "50% anticipo"
   - **Dirección**: ubicación física
3. Guardar

### Buscar proveedores
Usa la barra de búsqueda para filtrar por nombre, RNC, contacto o correo.

### Desactivar un proveedor
Los proveedores no se eliminan — se **desactivan**. Esto los oculta de las búsquedas pero mantiene el historial de facturas y compras vinculadas.

Para ver proveedores inactivos, activa el checkbox **"Mostrar inactivos"**.

---

## Campos importantes

| Campo | Significado |
|-------|------------|
| RNC | Registro Nacional de Contribuyentes — necesario para facturas con NCF |
| Condiciones de pago | Términos acordados: contado, 15 días, 30 días, 50% anticipo, etc. |
| Activo | Si está activo aparece en búsquedas; si no, queda solo como referencia histórica |

---

## Dónde se usa

- **Facturas de egreso**: al crear una factura de egreso puedes seleccionar el proveedor del catálogo
- **Órdenes de compra**: cada OC se vincula a un proveedor
- **Catálogo**: el proveedor normalizado reemplaza el texto libre en los gastos

---

## Tips

- Completa las condiciones de pago — se copian automáticamente a las órdenes de compra
- Usa el RNC correcto para que las facturas coincidan con los registros fiscales
- Si un proveedor cambia de razón social, edita el existente en vez de crear uno nuevo
