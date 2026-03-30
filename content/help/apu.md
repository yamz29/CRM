# APU — Análisis de Precio Unitario

## ¿Qué hace?
Calcula cuánto cuesta producir una unidad de trabajo: 1 m² de piso, 1 módulo instalado, 1 puerta colocada.

## ¿Para qué sirve?
Construir presupuestos precisos. En lugar de estimar "a ojo", el APU descompone cada ítem en materiales, mano de obra y equipos con sus cantidades y precios reales.

---

## Cómo se usa

### Crear un APU
1. Ir a **APU → Nuevo APU**
2. Nombrar el análisis (ej: `Instalación piso porcelanato 60×60`)
3. Definir la unidad de medida: `m²`, `ml`, `ud`, `glb`
4. Agregar insumos uno a uno:
   - Seleccionar el recurso del catálogo (material, mano de obra, equipo)
   - Definir el **rendimiento** (cuánto se usa por unidad)
   - El sistema calcula automáticamente el costo parcial
5. El total se actualiza en tiempo real
6. Guardar y reutilizar en presupuestos

### Usar un APU en un presupuesto
Una vez guardado, el APU aparece disponible como línea de presupuesto. Al agregar la cantidad de unidades (ej: 40 m²), el sistema multiplica automáticamente.

---

## Campos importantes

| Campo | Qué significa |
|-------|--------------|
| Unidad | Cómo se mide ese trabajo: m², ml, ud, glb |
| Rendimiento | Cuánto recurso se usa por unidad (ej: 1.1 m² de cerámica por m²) |
| Factor | Multiplicador de desperdicio o eficiencia (1.10 = 10% extra) |
| Costo directo | Suma de materiales + mano de obra + equipos |

---

## Ejemplo real

Para cotizar **40 m² de piso**, se crea el APU `Piso cerámica 30×30`:

| Insumo | Rendimiento | Precio unit. | Costo/m² |
|--------|------------|--------------|----------|
| Cerámica 30×30 | 1.10 m² | RD$ 180 | RD$ 198 |
| Pegamento cerámico | 3.5 kg | RD$ 35 | RD$ 122.50 |
| Mano de obra instalador | 0.8 hr | RD$ 200 | RD$ 160 |
| **Total** | | | **RD$ 480.50/m²** |

Resultado: **40 m² × RD$ 480.50 = RD$ 19,220**

---

## Errores comunes

- ❌ **No incluir desperdicio en el rendimiento** → el costo real supera lo cotizado
- ❌ **Usar precios desactualizados** → actualiza el catálogo de recursos cada vez que llegue una factura nueva
- ❌ **APUs muy genéricos** → es mejor tener `Piso cerámica 30×30` y `Piso porcelanato 60×60` por separado que un solo `Instalación de piso`

---

## Tips

- 💡 Crea un APU una vez, úsalo en todos los presupuestos que necesiten ese ítem
- 💡 Incluye siempre la mano de obra aunque el cliente no la vea por separado — afecta el costo real
- 💡 El factor de desperdicio típico en construcción: **cerámica 10%, pintura 15%, madera 20%**
