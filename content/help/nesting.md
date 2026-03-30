# Nesting

## ¿Qué hace?
Organiza automáticamente todas las piezas de un módulo sobre las planchas disponibles, minimizando el desperdicio de material.

## ¿Para qué sirve?
Saber exactamente cuántas planchas se necesitan y cómo distribuir los cortes antes de ir a la sierra. Reduce el desperdicio, mejora el aprovechamiento y genera la orden de corte para la CNC.

---

## Cómo se usa

### Desde un módulo melamina
1. Tener el despiece completo (pestaña **Despiece**)
2. Ir a la pestaña **Nesting**
3. El sistema coloca automáticamente todas las piezas en planchas virtuales
4. Ajusta el **kerf** (ancho del corte de sierra, típicamente 3-4mm) si es necesario
5. Activa o desactiva la **rotación** según las restricciones del veteado
6. Haz clic en **Imprimir** para generar la orden de corte visual

### Desde el Configurador de Cocinas
1. Arma la cocina completa con todos los módulos
2. Clic en **Calcular** (botón verde en el header)
3. En el panel derecho verás el resumen por material
4. Clic en **Ver nesting** → modal con el layout visual por plancha y por material
5. Clic en **Ver lista de cortes** → descarga el archivo `.txt` para importar en la CNC

---

## Cómo leer el resultado

```
┌──────────────────────────────────────────┐
│  ┌──────────────┐  ┌────────┐            │
│  │  Lat 900×300 │  │Piso    │            │
│  │              │  │364×300 │            │
│  └──────────────┘  └────────┘            │
│  ┌───────────────────────┐               │
│  │  Puerta 876×396       │               │
│  └───────────────────────┘               │
│                          Aprovech: 74%   │
└──────────────────────────────────────────┘
```

| Elemento | Qué significa |
|----------|--------------|
| Cada rectángulo de color | Una pieza del módulo |
| Número dentro | Dimensiones: Largo × Ancho en mm |
| `R` en la esquina | La pieza fue rotada 90° |
| `% aprovechamiento` | Porcentaje del área de la plancha utilizado |

---

## Ejemplo real

Un módulo base de 90cm tiene 8 piezas. El nesting las organiza en **1 plancha MDP Blanco** con **74% de aprovechamiento**. El 26% restante (sobrante) puede reutilizarse para piezas pequeñas de otro módulo.

Una cocina completa de 10 módulos genera: 4 planchas MDP Blanco 18mm + 1 plancha HDF 6mm para los fondos = costo estimado RD$ 15,200.

---

## Archivos de corte CNC

El archivo `.txt` descargado sigue el formato tabular con estas columnas:

```
Length  Width  Quantity  Material  Texture  Label  Edgebands(×4)  Customer
```

Este formato es compatible con software de sala de corte como **Biesse Optix**, **Ardis**, y similares.

---

## Errores comunes

- ❌ **Aprovechamiento menor al 40%** → puede indicar que las piezas son más grandes que la plancha configurada. Verifica las dimensiones del tablero en el catálogo.
- ❌ **Piezas que no aparecen en el nesting** → su largo o ancho supera las dimensiones de la plancha disponible
- ❌ **Kerf en 0** → produce cálculos irreales. Usa siempre mínimo 3mm para el corte de sierra

---

## Tips

- 💡 Activa **Rotación permitida** para mejorar automáticamente el aprovechamiento
- 💡 Un aprovechamiento por encima del **70%** es bueno. Sobre **85%** es excelente
- 💡 El kerf estándar para sierra de mesa es **3.2mm**, para CNC de panel **4mm**
