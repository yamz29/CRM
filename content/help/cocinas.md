# Configurador de Cocinas

## ¿Qué hace?
Permite diseñar una cocina en planta y alzado, colocando módulos sobre paredes o como islas, y calcular automáticamente los materiales y el presupuesto.

## ¿Para qué sirve?
Presentarle al cliente una visualización del diseño y obtener en segundos el costo real de materiales, sin cálculos manuales ni hojas de Excel.

---

## Cómo se usa

### Paso 1 — Crear el proyecto de cocina
1. Ir a **Cocinas → Nuevo proyecto**
2. Ingresar el nombre (ej: `Cocina Residencia García`)
3. Seleccionar el **layout**:
   - `Lineal` → una sola pared
   - `En L` → dos paredes perpendiculares
   - `En U` → tres paredes
4. Configurar las medidas de cada pared en mm
5. Guardar

### Paso 2 — Colocar módulos
1. En el panel izquierdo, busca o filtra los módulos disponibles
2. Para colocar en pared:
   - Selecciona la pared activa (pestaña en la vista de elevación)
   - Clic en **Pared** en la tarjeta del módulo
   - Clic en la posición deseada sobre el alzado
3. Para colocar como isla o península:
   - Clic en **Isla** en la tarjeta del módulo
   - La vista cambia a **Planta**
   - Clic en el espacio libre del plano

### Paso 3 — Ajustar posición y nivel
- Arrastra los módulos horizontalmente en el alzado para moverlos
- Selecciona un módulo (clic) para ver sus propiedades en el panel derecho
- Cambia el **nivel**: `base`, `alto`, `torre` o `isla`
- Para módulos aéreos, ajusta la **altura desde el suelo** (default: 1400mm)

### Paso 4 — Calcular materiales
1. Clic en **Calcular** (botón verde en el header)
2. El panel derecho muestra por cada material:
   - Planchas necesarias y dimensiones
   - % de aprovechamiento
   - Costo estimado
3. Clic en **Ver lista de cortes** → descarga el `.txt` para la CNC
4. Clic en **Ver nesting** → visualiza el layout de piezas en cada plancha
5. Clic en **Generar Presupuesto** → crea el presupuesto formal con tableros, cantos y herrajes

---

## Tipos de módulos

| Tipo | Dónde va | Nivel en el alzado |
|------|----------|--------------------|
| Base con puertas / cajones | Pegado a la pared, a nivel del suelo | Base |
| Aéreo con puertas | Colgado en la pared, arriba del mesón | Alto |
| Columna / Torre | Pared, de piso a techo | Torre |
| Electrodoméstico | Posición en pared, no genera corte | — |
| Isla / Península | Centro del espacio, libre | Isla |

---

## Vistas disponibles

| Vista | Para qué sirve |
|-------|---------------|
| **Elevación** | Ver el alzado de una pared a la vez. Aquí se colocan y ajustan módulos |
| **Planta** | Vista aérea del espacio. Aquí se colocan islas y se verifica el layout general |

---

## Ejemplo real

Diseño de cocina en L para **"Residencia García"**:
- Pared A (3,200mm): 3 módulos base 60cm + 1 módulo base 80cm con horno
- Pared B (2,400mm): 1 módulo esquinero + 2 módulos base 60cm
- Pared A, nivel alto: 3 módulos aéreos 40cm a 1,500mm del piso
- Centro: 1 isla 120×90cm

Al calcular:
- **4 planchas MDP Blanco 18mm** — aprovechamiento 78%
- **1 plancha HDF 6mm** — fondos
- **Presupuesto generado**: COT-2025-014
  - Capítulo Tableros: RD$ 11,200
  - Capítulo Cantos y Herrajes: RD$ 3,840
  - **Total: RD$ 15,040**

---

## Errores comunes

- ❌ **Módulos sin tablero asignado** → el cálculo de costo queda en RD$ 0. Verifica que cada módulo tenga material configurado en su ficha
- ❌ **Módulos sin despiece** → aparecen en el nesting sin piezas. Genera el despiece primero desde el módulo melamina
- ❌ **Colocar módulos aéreos sobre módulos base sin verificar altura** → revisa que el alto del módulo base + el `alturaDesdeSupelo` no se superpongan

---

## Tips

- 💡 Selecciona la pared correcta antes de colocar un módulo — solo puedes colocar en la pared activa (resaltada en azul)
- 💡 Usa ESC para cancelar la colocación de un módulo sin colocarlo
- 💡 Los módulos aéreos y los módulos base no se bloquean entre sí — puedes tener ambos en la misma posición horizontal
