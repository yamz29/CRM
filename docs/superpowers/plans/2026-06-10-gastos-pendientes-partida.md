# Gastos pendientes de asignar partida — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar en el módulo global de Gastos (`/gastos`) un filtro y badge para los gastos que ya tienen `proyectoId` pero no tienen `partidaId` asignada (típicamente generados desde Facturación), y permitir asignarles la partida desde ahí mismo reutilizando `GastoForm`.

**Architecture:** Cambio 100% client-side en `app/gastos/GastosPageClient.tsx`. La lista de gastos ya se carga completa al cliente (`gastosIniciales`), así que el nuevo filtro es un criterio adicional en el `useMemo` existente. No se toca la API ni el schema. Este proyecto no tiene suite de tests automatizados (ver `CLAUDE.md`); la verificación es manual en navegador con `npm run dev`.

**Tech Stack:** Next.js 16 (App Router), React, TypeScript, Tailwind.

---

### Task 1: Filtro, contador y badge "Pendiente de asignar partida"

**Files:**
- Modify: `app/gastos/GastosPageClient.tsx`

- [ ] **Step 1: Agregar estado de filtro `soloSinPartida`**

En `app/gastos/GastosPageClient.tsx`, junto a los demás estados de filtro (alrededor de la línea 77-80), agregar:

```tsx
  const [soloSinPartida, setSoloSinPartida] = useState(false)
```

- [ ] **Step 2: Definir el helper `esSinPartida` y aplicar el criterio en `filtered`**

Justo antes del `useMemo` de `filtered` (alrededor de la línea 82), agregar el helper:

```tsx
  const esSinPartida = (g: Gasto) => g.proyectoId != null && g.partida == null
```

Luego, dentro del `filtered` `useMemo` (líneas 82-98), agregar la condición del nuevo filtro junto a las existentes:

```tsx
  const filtered = useMemo(() => {
    return gastos.filter(g => {
      if (filtroDestino  && g.destinoTipo !== filtroDestino) return false
      if (filtroProyecto && String(g.proyectoId) !== filtroProyecto) return false
      if (filtroEstado   && g.estado !== filtroEstado) return false
      if (soloSinPartida && !esSinPartida(g)) return false
      if (q) {
        const lq = q.toLowerCase()
        if (
          !g.descripcion.toLowerCase().includes(lq) &&
          !(g.suplidor?.toLowerCase().includes(lq)) &&
          !(g.referencia?.toLowerCase().includes(lq)) &&
          !(g.categoria?.toLowerCase().includes(lq))
        ) return false
      }
      return true
    })
  }, [gastos, q, filtroDestino, filtroProyecto, filtroEstado, soloSinPartida])
```

- [ ] **Step 3: Agregar tarjeta de filtro "Pendiente de asignar partida" junto a las de `DESTINO_CONFIG`**

Calcular el conteo de gastos sin partida. Justo antes del `return (` del componente (después de `const totalFiltrado = ...`, línea 142), agregar:

```tsx
  const sinPartidaCount = gastos.filter(esSinPartida).length
```

En el grid de "Stats cards" (líneas 167-191), después del `.map` de `DESTINO_CONFIG`, agregar una tarjeta adicional dentro del mismo `<div className="grid ...">`:

```tsx
        {sinPartidaCount > 0 && (
          <button
            onClick={() => setSoloSinPartida(!soloSinPartida)}
            className={`rounded-xl border p-3 text-left transition-all ${
              soloSinPartida
                ? 'ring-2 ring-primary border-primary/50 bg-card'
                : 'bg-card border-border hover:border-border/60'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                <HelpCircle className="w-3 h-3" />
                Sin partida
              </span>
            </div>
            <p className="text-lg font-bold text-foreground tabular-nums">{sinPartidaCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">pendientes de asignar partida</p>
          </button>
        )}
```

(El ícono `HelpCircle` ya está importado en la línea 7.)

- [ ] **Step 4: Incluir el nuevo filtro en "Limpiar" y mostrar badge por fila**

En la condición de "Limpiar" (línea 226), agregar `soloSinPartida`:

```tsx
        {(q || filtroDestino || filtroProyecto || filtroEstado || soloSinPartida) && (
          <button onClick={() => { setQ(''); setFiltroDestino(''); setFiltroProyecto(''); setFiltroEstado(''); setSoloSinPartida(false) }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors">Limpiar</button>
        )}
```

En la columna "Destino" de la tabla (líneas 265-267), agregar el badge "Sin partida" junto a `DestinoBadge` cuando aplique:

```tsx
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <DestinoBadge destino={g.destinoTipo} proyecto={g.proyecto} />
                        {esSinPartida(g) && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            <HelpCircle className="w-3 h-3" />
                            Sin partida
                          </span>
                        )}
                      </div>
                    </td>
```

- [ ] **Step 5: Verificación manual en navegador**

Run: `npm run dev`

1. Ir a `/gastos`. Si existen gastos con `proyectoId` set y sin partida (típicamente creados desde una factura tipo egreso con proyecto asignado en `/contabilidad/facturas`), debe aparecer la tarjeta amarilla "Sin partida" con el conteo correcto.
2. Click en la tarjeta → la lista se filtra mostrando solo esos gastos; cada fila muestra el badge "Sin partida".
3. Click en "editar" (lápiz) sobre uno de esos gastos → se abre `GastoForm`. Confirmar que aparece el selector de "Partida" con las opciones del proyecto correspondiente (agrupadas por capítulo).
4. Seleccionar una partida y guardar → al recargar la lista (`reload()`), ese gasto ya no debe tener el badge "Sin partida" y el contador de la tarjeta debe bajar en 1 (o la tarjeta desaparece si llega a 0).
5. Click en "Limpiar" → el filtro `soloSinPartida` se desactiva y vuelve la lista completa.

**Si en el paso 3 el selector de "Partida" no aparece o no guarda correctamente** (por ejemplo porque `proyectoIdSeleccionado` no dispara el fetch de `/api/proyectos/[id]/partidas` cuando el form se abre fuera del contexto de proyecto), corregir `components/gastos/GastoForm.tsx` ajustando la condición que calcula `pid` (alrededor de la línea 101) para que también considere `form.proyectoIdSeleccionado` cuando `destinoTipo === 'proyecto'` independientemente de cómo se abrió el form. Documentar el ajuste exacto hecho en el commit.

- [ ] **Step 6: Commit**

```bash
git add app/gastos/GastosPageClient.tsx
git commit -m "feat(gastos): filtro y badge para gastos pendientes de asignar partida"
```

(Si hubo ajuste en `GastoForm.tsx`, incluirlo también en este commit.)

---

## Self-review notes

- Cobertura del spec: filtro ✅ (Step 2-3), contador ✅ (Step 3), badge por fila ✅ (Step 4), reutilización de `GastoForm` ✅ (Step 5, con plan de contingencia si falla la verificación manual).
- Tipos: `Gasto.proyectoId: number | null` y `Gasto.partida: {...} | null` ya existen en la interfaz (líneas 28 y 30) — `esSinPartida` usa exactamente esos campos.
- No se requiere cambio en `app/api/gastos/route.ts` ni en el schema, conforme al spec.
