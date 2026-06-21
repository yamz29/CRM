# Sugerencia automática de reparto de overhead por proyecto/mes

**Fecha:** 2026-06-21
**Estado:** Aprobado (pendiente revisión final del usuario)

## Problema

Hoy el "Overhead distribuido" (`/contabilidad/overhead`) reparte el pool mensual de
gastos fijos (oficina/taller/general) entre los proyectos activos **tecleando a mano**
el % de cada uno. No hay ninguna guía: el usuario adivina. Se quiere que el sistema
**sugiera** ese % por proyecto, ponderando la **duración** del proyecto en el mes y el
**esfuerzo** invertido, dejando la sugerencia como punto de partida editable.

## Objetivo

Botón **"Sugerir %"** en la pantalla de Overhead que calcula un % sugerido por proyecto
(con desglose de cómo se formó), rellena los inputs existentes y **no persiste nada** hasta
que el usuario revise y pulse "Guardar reparto" (flujo actual intacto).

Fuera de alcance (v1): UI para editar los pesos, persistencia de histórico de avance
físico, aplicación automática sin intervención humana.

## Enfoque elegido

**Índice de esfuerzo compuesto + sugerencia no destructiva.** Se mezclan 5 señales, cada
una normalizada como *cuota* (fracción que suma 1 entre los proyectos activos del mes), se
combinan con pesos, se prorratea por días activos en el mes (la "duración") y se re-normaliza
a 100%.

Descartados: *driver único* (ignora horas/avance/presupuesto que se pidió mezclar) y
*auto-aplicar* (quita el control humano y puede repartir injustamente sin revisión).

## Señales disponibles (por proyecto y mes)

| Señal | Fuente | Histórica por mes |
|---|---|---|
| `costoMes` | `GastoProyecto` destinoTipo=proyecto, RD$, no Anulado, fecha ∈ mes | Sí |
| `costoAcum` | `GastoProyecto` (mismos filtros) con fecha < fin de mes | Sí |
| `horas` | `RegistroHoras.horas`, fecha ∈ mes, proyectoId | Sí |
| `presupuesto` | `Proyecto.presupuestoEstimado` | Estático |
| `avance` | `Proyecto.avanceFisico` (0-100) | Solo foto actual |
| `diasActivos` | `fechaInicio` … `fechaCierre`/`fechaEstimada` ∩ mes | Sí (derivado) |

Advertencia documentada: `avanceFisico` es un único entero "hoy", sin histórico mensual.
Por eso entra con peso bajo (5%) y para meses pasados es una aproximación.

## Fórmula

Para cada proyecto `p` activo en el mes y cada señal `i`:

```
cuotaᵢ(p) = señalᵢ(p) / Σ señalᵢ(activos)          // fracción, suma 1 entre proyectos
score(p)  = Σᵢ wᵢ · cuotaᵢ(p)                       // Σ wᵢ = 1
score(p) *= diasActivos(p,mes) / diasDelMes         // prorrateo por duración
%(p)      = 100 · score(p) / Σ score(activos)       // re-normaliza a 100%
```

### Pesos por defecto (configurables)

```
costoMes 0.35 | horas 0.25 | costoAcum 0.20 | presupuesto 0.15 | avance 0.05
```

Constante `PESOS_SUGERENCIA_DEFAULT` en `lib/overhead.ts`. Override opcional vía
`Configuracion` clave `overhead_pesos_sugerencia` (JSON con las mismas claves). Si el JSON
es inválido o falta, se usan los defaults. Los pesos leídos se re-normalizan a Σ=1 antes de
usarse (tolerancia a que el usuario no sume exactamente 1).

## Reglas de borde

1. **Señal con total 0** entre todos los proyectos (ej. ese mes nadie registró horas): su
   peso se **redistribuye** proporcionalmente entre las señales con total > 0. Se hace
   re-normalizando los pesos de las señales "vivas" a Σ=1. Un mes sin horas no anula el score.
2. **Todas las señales 0** para todos: reparto **igual**, prorrateado por `diasActivos`. Si
   además `diasActivos` es 0 para todos, reparto estrictamente igual (100/N).
3. **Proyecto sin `fechaInicio`**: se asume activo todo el mes (`diasActivos = diasDelMes`),
   no se penaliza la duración.
4. **`diasActivos` se recorta al mes**: intersección de `[fechaInicio, fin]` con el rango del
   mes, donde `fin = fechaCierre ?? fechaEstimada ?? fin del mes`. Mínimo 0, máximo `diasDelMes`.
5. **Redondeo**: cada % a 2 decimales. El residuo de redondeo (para que la suma quede ≤ 100
   exacto) se ajusta en el proyecto de **mayor score**, evitando que la suma dispare el bloqueo
   de >100% al guardar (`validarReparto` rechaza > 100.01).
6. **Conjunto de proyectos**: idéntico al del `GET /api/contabilidad/overhead` actual
   (estado ∈ {Activo, En Ejecución} y no archivada, ∪ con gasto en el mes, ∪ con fila
   `DistribucionOverhead` existente). La sugerencia se calcula solo sobre ese conjunto.

## Componentes

### `lib/overhead.ts` (lógica pura, testeable)

```ts
export interface PesosSugerencia {
  costoMes: number; horas: number; costoAcum: number; presupuesto: number; avance: number
}
export const PESOS_SUGERENCIA_DEFAULT: PesosSugerencia

export interface SenalesProyecto {
  proyectoId: number
  costoMes: number; costoAcum: number; horas: number
  presupuesto: number; avance: number
  diasActivos: number
}

export interface SugerenciaProyecto {
  proyectoId: number
  porcentaje: number            // 0-100, redondeado, suma ≤ 100
  desglose: {                   // aporte de cada señal al score (en puntos de %)
    costoMes: number; horas: number; costoAcum: number
    presupuesto: number; avance: number
  }
}

// Función pura: recibe señales + diasDelMes + pesos, devuelve sugerencias con desglose.
export function sugerirReparto(
  proyectos: SenalesProyecto[],
  diasDelMes: number,
  pesos?: PesosSugerencia,
): SugerenciaProyecto[]

// Helper: normaliza pesos a Σ=1 y redistribuye los de señales muertas.
export function normalizarPesos(
  pesos: PesosSugerencia,
  senalesVivas: Record<keyof PesosSugerencia, boolean>,
): PesosSugerencia
```

El **desglose** se expresa en puntos porcentuales finales: para cada señal, su aporte =
`wᵢ · cuotaᵢ(p)` escalado por el mismo factor de prorrateo y re-normalización que el % total,
de modo que `Σ desglose(p) = porcentaje(p)`. Así el usuario ve "de este 22%, 8 vino del costo
del mes, 6 de horas, …".

### `lib/overhead-data.ts` (carga server-only)

```ts
// Carga las 6 señales por proyecto para (anio, mes), sobre el conjunto de IDs candidatos.
export async function senalesDelMes(
  anio: number, mes: number, proyectoIds: number[],
): Promise<SenalesProyecto[]>

// Lee pesos de Configuracion('overhead_pesos_sugerencia') o devuelve los defaults.
export async function pesosSugerencia(): Promise<PesosSugerencia>

// diasDelMes derivado de rangoMes (ya existe).
```

`costoMes`/`costoAcum` con `groupBy(proyectoId)` sobre `GastoProyecto` (filtros del pool de
proyecto: destinoTipo='proyecto', moneda=RD$, estado≠Anulado). `horas` con `groupBy` sobre
`RegistroHoras`. `presupuesto`/`avance`/fechas desde `Proyecto`.

### `GET /api/contabilidad/overhead/sugerencia?anio&mes`

Permiso `contabilidad/ver`. Valida anio/mes igual que el GET actual. Reconstruye el mismo
conjunto de proyectos candidatos que el GET actual (extraer ese cálculo a un helper compartido
para no duplicar lógica), carga señales, lee pesos, llama `sugerirReparto`, responde:

```json
{ "anio": 2026, "mes": 6, "sugerencias": [
  { "proyectoId": 12, "porcentaje": 22.5,
    "desglose": { "costoMes": 8.1, "horas": 6.0, "costoAcum": 4.2,
                  "presupuesto": 3.0, "avance": 1.2 } } ] }
```

No escribe en base de datos.

### `OverheadClient.tsx` (UI)

- Botón **"Sugerir %"** junto a "Guardar reparto". Estado `sugiriendo`.
- Al pulsar: `GET …/sugerencia?anio&mes`, rellena `pcts` con los % sugeridos (mismo mapa que
  ya usa). Toast `exito`: "Sugerencia aplicada — revisa antes de guardar".
- Guarda el desglose en estado (`Record<proyectoId, desglose>`) y lo muestra en la tabla: por
  fila, un popover/tooltip (icono `Info`) que lista el aporte de cada señal en puntos de %.
  Mientras no haya sugerencia para esa fila, no se muestra desglose.
- Editar un input manualmente no recalcula el desglose (queda como referencia de la última
  sugerencia); se puede limpiar al cambiar de mes.
- No cambia el flujo de guardado: sigue usando el POST actual con validación ≤100%.

## Manejo de errores

- Endpoint con anio/mes inválido → 400 (igual que GET actual).
- Sin proyectos candidatos → `sugerencias: []`; el botón aplica nada y muestra toast neutro.
- Fallo de red en el cliente → `toast.error("No se pudo calcular la sugerencia")`, inputs sin
  tocar.
- JSON de pesos inválido en Configuracion → log `console.error` + defaults (no rompe).

## Testing

`lib/__tests__/overhead.test.ts` (ya existe), casos para `sugerirReparto` y `normalizarPesos`:

1. Caso base: 2-3 proyectos con señales distintas → % proporcional esperado, suma = 100,
   `Σ desglose = porcentaje` por proyecto.
2. Señal con total 0 (sin horas el mes) → peso de horas redistribuido; resto consistente.
3. Todas las señales 0 → reparto igual prorrateado por días.
4. Prorrateo por duración: proyecto activo medio mes recibe ~½ frente a uno igual a mes completo.
5. Proyecto sin fechaInicio → tratado como mes completo.
6. Redondeo: suma exacta ≤ 100, residuo en el de mayor score.
7. `normalizarPesos` con señales muertas → Σ=1 sobre las vivas.

Verificación manual: gates del proyecto (`npx tsc --noEmit`, `npm run lint`, build) y prueba
en navegador en `/contabilidad/overhead` (sugerir, ver desglose, editar, guardar).

## Archivos afectados

- `lib/overhead.ts` (añadir lógica pura + tipos + constante)
- `lib/overhead-data.ts` (añadir carga de señales + lectura de pesos)
- `app/api/contabilidad/overhead/route.ts` (extraer helper de "conjunto candidato")
- `app/api/contabilidad/overhead/sugerencia/route.ts` (nuevo)
- `app/contabilidad/overhead/OverheadClient.tsx` (botón + desglose)
- `lib/__tests__/overhead.test.ts` (tests nuevos)
- Sin cambios de schema; `Configuracion` ya existe (clave/valor).
