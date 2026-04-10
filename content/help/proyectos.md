# Proyectos

## ¿Qué hace?
Centraliza toda la información de una obra o trabajo: cliente, fechas, presupuesto, gastos, horas del equipo, cronogramas, adicionales (cambios de alcance), punchlist y métricas EVM.

## ¿Para qué sirve?
Tener un punto de control único por obra. Desde un proyecto se conecta todo: gastos directos, mano de obra interna, presupuestos, cronogramas Gantt, órdenes de cambio y la lista de pendientes de entrega.

---

## Cómo se usa

### Crear un proyecto
1. Ir a **Proyectos → Nuevo proyecto**
2. Ingresar el nombre del proyecto (ej: `Remodelación Casa Pérez`)
3. Seleccionar el cliente o crear uno nuevo
4. Definir fecha de inicio y fecha estimada de entrega
5. Guardar — el proyecto queda en estado **Activo**

### Tabs del proyecto

| Tab | Qué contiene |
|-----|-------------|
| **Resumen** | Indicadores de ejecución, resumen financiero, rentabilidad real, presupuestos y cronogramas vinculados |
| **Presupuestos** | Cotizaciones asociadas al proyecto |
| **Adicionales** | Cambios de alcance (change orders) que modifican el presupuesto vigente |
| **Gastos** | Todos los egresos vinculados a esta obra |
| **Punchlist** | Lista de pendientes/defectos a resolver antes de la entrega |
| **EVM / Curva S** | Earned Value Management: gráfico de valor planificado vs ganado vs costo real |
| **Control presupuestario** | Comparación partida por partida del presupuesto vs gastos reales |
| **Bitácora** | Registro diario de avance de obra con fotos |

---

## Indicadores de ejecución

En el tab Resumen se muestran 4 indicadores clave:

- **Avance físico**: porcentaje de obra completada (se actualiza desde la bitácora)
- **Ejecución financiera**: porcentaje del presupuesto gastado
- **Forecast de costo**: proyección del costo total al 100% de avance
- **Varianza forecast**: diferencia entre presupuesto y forecast (positivo = bajo presupuesto)

---

## Adicionales (Change Orders)

Los adicionales son modificaciones al alcance del proyecto que el cliente solicita después del presupuesto original.

### Flujo de estados
```
Propuesto → Aprobado → Facturado
         → Rechazado
```

### Cómo funcionan
1. Ir al tab **Adicionales** del proyecto
2. Crear un adicional con título, descripción y monto
3. Cuando el cliente aprueba, cambiar estado a **Aprobado**
4. El monto aprobado se suma automáticamente al **presupuesto vigente**
5. Todos los KPIs (margen, balance, forecast) se recalculan con el presupuesto vigente

---

## Punchlist

Lista de detalles o defectos que deben resolverse antes de la entrega formal al cliente.

### Flujo de estados
```
Abierto → En progreso → Resuelto → Verificado → Cerrado
```

### Campos
- **Título**: qué hay que corregir
- **Ubicación**: dónde (ej: "Baño principal 2do piso")
- **Categoría**: tipo de trabajo (Pintura, Plomería, Eléctrico, Acabado, etc.)
- **Prioridad**: baja / media / alta / crítica
- **Asignado a**: responsable de resolver
- **Fecha límite**: plazo para resolución

### Timestamps automáticos
- Al marcar como **Resuelto** se registra la fecha de resolución
- Al marcar como **Verificado** se registra quién verificó y cuándo

---

## EVM / Curva S

Earned Value Management permite monitorear la salud financiera del proyecto con 3 métricas:

| Métrica | Significado |
|---------|------------|
| **PV** (Planned Value) | Valor planificado a la fecha según el cronograma |
| **EV** (Earned Value) | Valor ganado = presupuesto × % avance real |
| **AC** (Actual Cost) | Costo real gastado a la fecha |

### Índices
- **SPI** (Schedule Performance Index) = EV/PV — mayor a 1 = adelantado
- **CPI** (Cost Performance Index) = EV/AC — mayor a 1 = bajo presupuesto
- **EAC** (Estimate at Completion) = BAC/CPI — proyección del costo final

### Cómo capturar un snapshot
1. Ir al tab **EVM / Curva S**
2. Clic en **Capturar snapshot** — el sistema calcula automáticamente PV, EV y AC desde los datos del proyecto
3. Con 2+ snapshots se genera el gráfico de curva S

---

## Cronogramas vinculados

En el tab Resumen aparece la sección **Cronogramas** con todos los Gantt asociados al proyecto. Desde ahí puedes:
- Ver cada cronograma con su estado, fechas y cantidad de actividades
- Crear un cronograma nuevo pre-vinculado al proyecto

---

## Campos importantes

| Campo | Qué significa |
|-------|--------------|
| Estado | Prospecto / Activo / En Ejecución / Completado / Pausado / Cancelado |
| Presupuesto estimado | Monto base acordado con el cliente |
| Presupuesto vigente | Presupuesto estimado + adicionales aprobados |
| Avance físico | % de obra completada (0-100) |
| Presupuesto base | ID del presupuesto aprobado usado como referencia |

---

## Factor de carga social

La mano de obra interna (horas registradas × costo/hora del usuario) se multiplica por el **factor de carga social** configurado en **Configuración → Costos**. Este factor incluye prestaciones laborales (vacaciones, regalía, seguridad social, etc.).

Ejemplo: si un empleado tiene costo/hora de RD$ 500 y el factor es 1.45, el costo real por hora es RD$ 725.

---

## Errores comunes

- No vincular gastos al proyecto → el análisis de rentabilidad queda incompleto
- Dejar proyectos en "Activo" cuando ya terminaron → contamina reportes
- No registrar adicionales → el margen aparece peor de lo que es
- No actualizar el avance físico → los indicadores EVM no son útiles

---

## Tips

- Usa un nombre claro que incluya cliente y fecha: `Casa Martínez – Ago 2025`
- Crea el proyecto antes de registrar cualquier gasto, así todo queda vinculado desde el inicio
- Captura snapshots EVM semanalmente para tener una curva S representativa
- Usa el punchlist desde que inicies la fase de acabados, no solo al final
