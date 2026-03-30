# Materiales y Tableros

## ¿Qué hace?
Administra el catálogo de materiales de producción: tableros (MDP, MDF, HDF), cantos (ABS, PVC) y herrajes (bisagras, correderas, jaladera).

## ¿Para qué sirve?
Tener precios actualizados en un solo lugar. Cuando se calcula un módulo de cocina, un despiece o un APU, los costos se toman automáticamente de aquí.

---

## Cómo se usa

### Agregar un material nuevo
1. Ir a **Melamina → Materiales → Nuevo material**
2. Seleccionar el **tipo**:
   - `tablero` → planchas de MDP, MDF, HDF, etc.
   - `canto` → rollo de tapacanto ABS, PVC, madera
   - `herraje` → bisagras, correderas, jaladores, pernos
3. Completar: nombre, código (opcional), precio, dimensiones
4. Guardar

A partir de ese momento el material está disponible en el configurador de módulos, el despiece y el catálogo de APU.

### Actualizar precios
- Abre el material → edita el precio → Guardar
- El cambio aplica a nuevos cálculos. Los módulos ya guardados conservan el precio original (snapshot).

---

## Tipos de materiales

| Tipo | Ejemplos | Unidad típica | Campos clave |
|------|----------|--------------|--------------|
| Tablero | MDP Blanco 18mm, MDF 15mm, HDF 6mm | plancha | Largo × Ancho × Espesor |
| Canto | ABS Blanco 22mm, PVC Negro 1mm | metro (ml) | Ancho, Espesor |
| Herraje | Bisagra Clip 110°, Corredera 450mm | par / ud | — |

---

## Ejemplo real

Se agrega el material **"MDP Blanco Snow 18mm"**:
- Tipo: `tablero`
- Precio: RD$ 2,800 por plancha
- Dimensiones: 2440mm × 1830mm × 18mm

Al calcular una cocina, el sistema usa esas dimensiones para el nesting y ese precio para estimar el costo por planchas necesarias.

Se agrega también **"Canto ABS Blanco 0.4mm"**:
- Tipo: `canto`
- Precio: RD$ 17 por metro

Cuando se asigna ese canto en el despiece de un módulo, el sistema calcula automáticamente cuántos metros se necesitan y sugiere la cantidad en la pestaña **Materiales**.

---

## Errores comunes

- ❌ **Crear módulos sin asignar tablero** → el cálculo de costo queda en RD$ 0
- ❌ **Precios desactualizados** → actualiza siempre que llegue una nueva factura del proveedor
- ❌ **No usar códigos** → dificulta la búsqueda cuando el catálogo crece

---

## Tips

- 💡 Usa un código consistente: `MDP-BL-18`, `CANTO-ABS-BL`, `BIS-CLIP-110`
- 💡 El campo **Espesor** en tableros es importante: el despiece lo usa para calcular dimensiones internas de cajones y cuerpos
- 💡 Mantén el catálogo limpio — un material duplicado con diferente nombre genera inconsistencias en los costos
