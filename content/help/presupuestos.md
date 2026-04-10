# Presupuestos

## ¿Qué hace?
Permite crear cotizaciones profesionales con estructura de títulos, capítulos y partidas. Calcula subtotales, descuentos e ITBIS automáticamente.

## ¿Para qué sirve?
Generar propuestas económicas para los clientes con desglose detallado de cada partida de trabajo. El presupuesto aprobado se convierte en la base para el control financiero del proyecto.

---

## Estructura de un presupuesto

```
Presupuesto COT-2026-001
├── Título: Obra Civil
│   ├── Capítulo: Demolición
│   │   ├── Partida: Demolición de piso existente — 45 m² × RD$ 350
│   │   └── Partida: Retiro de escombros — 1 gl × RD$ 8,000
│   └── Capítulo: Albañilería
│       ├── Partida: Piso porcelanato — 45 m² × RD$ 1,200
│       └── Partida: Fraguado — 45 m² × RD$ 150
└── Título: Carpintería
    └── Capítulo: Cocina
        ├── Partida: Mueble bajo 60cm — 4 ud × RD$ 12,500
        └── Partida: Mueble aéreo 60cm — 3 ud × RD$ 8,200
```

### Jerarquía
- **Títulos**: agrupación de primer nivel (Obra Civil, Carpintería, Eléctrico)
- **Capítulos**: subdivisiones dentro de un título
- **Partidas**: líneas de trabajo con cantidad, unidad y precio unitario

---

## Cómo se usa

### Crear un presupuesto
1. Ir a **Presupuestos → Nuevo presupuesto**
2. Seleccionar cliente y opcionalmente vincularlo a un proyecto
3. Agregar títulos, capítulos y partidas
4. El sistema calcula subtotales automáticamente

### Configurar descuento e ITBIS
- **Descuento**: porcentaje o monto fijo sobre el subtotal
- **ITBIS**: se puede activar al 18% estándar o al 1.8% (Norma 07-07)
- El total se calcula: `(Subtotal - Descuento) + ITBIS`

### Partidas desde APU
Las partidas pueden vincularse a un **Análisis de Precio Unitario (APU)** del catálogo. Al hacerlo, el precio unitario se calcula automáticamente desde los costos del APU.

### Estados del presupuesto
```
Borrador → Enviado → Aprobado / Rechazado
```

### Presupuesto base del proyecto
Al aprobar un presupuesto, puedes marcarlo como **presupuesto base** del proyecto. Esto:
- Copia las partidas al módulo de Control Presupuestario
- Establece el presupuesto estimado del proyecto
- Sirve de referencia para comparar gastos reales vs presupuestados

---

## Indirectos

Las líneas de indirectos son porcentajes que se aplican sobre el costo directo de las partidas:
- **Administración**: gastos generales del negocio (5-15%)
- **Imprevistos**: margen para eventualidades (3-10%)
- **Utilidad**: margen de ganancia deseado (10-25%)

Se configuran por presupuesto y se muestran como líneas separadas en el total.

---

## Tips

- Usa códigos claros en las partidas (1.1, 1.2, 2.1) para referencia fácil
- Aprovecha el catálogo de APU para no recalcular precios cada vez
- Mantén actualizado el estado del presupuesto para que el pipeline refleje la realidad
- Cuando apruebes un presupuesto, vincúlalo al proyecto como presupuesto base
