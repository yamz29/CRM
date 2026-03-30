# Pipeline de Ventas

El módulo de Pipeline te permite gestionar el ciclo completo de ventas, desde el primer contacto con un cliente potencial hasta el cierre y creación del proyecto.

## Flujo de ventas

```
Lead → Levantamiento → Cotización → Negociación → Ganado / Perdido
```

Cada oportunidad avanza por estas etapas según el estado real de la negociación.

## Crear una oportunidad

1. Ve a **Pipeline** en el menú lateral
2. Haz clic en **Nueva Oportunidad**
3. Completa los datos:
   - **Nombre**: describe brevemente el trabajo (ej: "Cocina Principal - Casa González")
   - **Cliente**: selecciona el cliente existente
   - **Etapa**: etapa inicial (por defecto: Lead)
   - **Valor estimado**: monto aproximado del proyecto
   - **Responsable**: persona encargada del seguimiento

## Mover entre etapas

**Vista Kanban**: arrastra la tarjeta de una columna a otra.

**Vista Lista**: haz clic en la fila para abrir el panel lateral y edita la etapa desde allí.

## Panel lateral (Drawer)

Al hacer clic en una oportunidad se abre un panel con:

- **Datos generales**: valor, probabilidad, fecha de cierre estimada
- **Cotizaciones vinculadas**: presupuestos asociados con enlace directo
- **Actividades**: historial de interacciones (llamadas, reuniones, etc.)
- **Acciones**: editar, marcar como ganada o perdida

## Registrar actividades

En el panel lateral, selecciona el tipo de actividad y escribe una descripción. Tipos disponibles:
- Llamada, WhatsApp, Reunión, Visita, Correo, Nota

Presiona Enter o el botón + para agregar.

## Crear cotización

Desde el panel lateral, haz clic en **Nueva cotización**. Se abrirá el formulario de presupuesto pre-vinculado a esta oportunidad y cliente.

## Marcar como Ganada

1. Haz clic en **Ganada** (botón verde en el panel lateral)
2. Ingresa el nombre del proyecto que se creará
3. Selecciona el tipo de proyecto
4. Se creará automáticamente el proyecto y serás redirigido a él

## Marcar como Perdida

1. Haz clic en **Perdida** (botón rojo)
2. Opcionalmente registra el motivo
3. La oportunidad pasa a la columna "Perdido"

## Métricas del Pipeline

En la parte superior del Pipeline y en el Dashboard verás:

- **En Pipeline**: cantidad de oportunidades activas
- **Valor Pipeline**: suma del valor estimado de las activas
- **Tasa de cierre**: porcentaje de oportunidades ganadas vs cerradas
