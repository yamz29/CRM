// Guías de "Primeros pasos" por rol.
// Cada paso tiene un slug que se cruza con /api/onboarding/progreso
// para marcar "completado" cuando el sistema ya tiene datos reales.
//
// Las imágenes son placeholders. Para agregarlas:
//   1. Captura la pantalla con Snipping Tool / Cmd+Shift+4
//   2. Guarda en public/help/onboarding/<nombre>.png
//   3. La referencia ya está en el guion, aparece automáticamente

export interface Paso {
  /** Identificador único que se cruza con el checklist del API */
  slug: string
  titulo: string
  /** Descripción larga en markdown-light (saltos de línea con \n) */
  descripcion: string
  /** Link al módulo donde ejecutar la acción */
  ctaHref: string
  ctaLabel: string
  /** Nombre del archivo en /public/help/onboarding/. Opcional. */
  imagen?: string
  /** Tips/atajos extras opcionales */
  tips?: string[]
}

export interface Guia {
  rol: 'vendedor' | 'supervisor' | 'contable'
  titulo: string
  intro: string
  pasos: Paso[]
}

export const GUIAS: Guia[] = [
  // ── VENDEDOR ────────────────────────────────────────────────────────────
  {
    rol: 'vendedor',
    titulo: 'Flujo de venta — del lead al proyecto',
    intro: 'Tu trabajo es convertir interesados en clientes activos. Esta es la secuencia típica desde que llega un prospecto hasta que se firma una obra.',
    pasos: [
      {
        slug: 'crear-cliente',
        titulo: '1. Registrar el cliente',
        descripcion:
          'Antes de cotizar, necesitas el cliente en el sistema. Crea uno con su nombre, RNC si aplica, teléfono y correo. Si es persona física puedes dejar el RNC vacío.\n\nUna vez creado, podrás vincularlo a oportunidades, presupuestos y facturas.',
        ctaHref: '/clientes/nuevo',
        ctaLabel: 'Crear primer cliente',
        imagen: 'vendedor-01-cliente.png',
        tips: [
          'El RNC dominicano es de 9 u 11 dígitos. Si lo dejas vacío después no podrás emitir factura fiscal a ese cliente.',
          'Pega el RNC y verifica el nombre — el sistema tiene catálogo DGII y lo autocompleta.',
        ],
      },
      {
        slug: 'crear-oportunidad',
        titulo: '2. Crear una oportunidad',
        descripcion:
          'Una "oportunidad" representa un proyecto potencial — algo que estás cotizando o negociando. Tiene etapas (Lead → Levantamiento → Cotización → Negociación → Ganado/Perdido) que mueves arrastrando en el pipeline.\n\nVincúlala al cliente del paso anterior y ponle un monto estimado.',
        ctaHref: '/oportunidades',
        ctaLabel: 'Ir al pipeline',
        imagen: 'vendedor-02-oportunidad.png',
        tips: [
          'Usa la vista Kanban (default) para arrastrar entre etapas con drag & drop.',
          'Si pierdes la oportunidad, márcala como Perdida y registra el motivo — ayuda a entender patrones.',
        ],
      },
      {
        slug: 'crear-presupuesto',
        titulo: '3. Hacer el presupuesto',
        descripcion:
          'Desde la oportunidad, crea el presupuesto. Tienes 2 opciones:\n\n• **Nuevo desde cero** — más flexible, agregas títulos, capítulos y partidas a mano o con el buscador APU.\n• **Importar desde Excel** — pega tu plantilla y se carga automáticamente.\n\nEl sistema calcula subtotales, descuentos, indirectos e ITBIS. Podes guardar y volver a editar las veces que necesites.',
        ctaHref: '/presupuestos/nuevo-v2',
        ctaLabel: 'Nuevo presupuesto',
        imagen: 'vendedor-03-presupuesto.png',
        tips: [
          'Usa el catálogo APU (botón "Insertar desde catálogo") para reutilizar partidas comunes con análisis de costos.',
          'Las notas amarillas no suman al total — sirven para aclarar al cliente.',
          'Imprime para PDF desde el detalle del presupuesto.',
        ],
      },
      {
        slug: 'crear-proyecto',
        titulo: '4. Ganar la oportunidad y crear el proyecto',
        descripcion:
          'Cuando el cliente firma, abre la oportunidad y haz click en "Ganada". Te pedirá un nombre para el proyecto y se crea automáticamente — vinculando cliente, presupuesto y oportunidad.\n\nDesde ese momento el seguimiento pasa de Pipeline a Proyectos.',
        ctaHref: '/oportunidades',
        ctaLabel: 'Volver al pipeline',
        imagen: 'vendedor-04-ganar.png',
        tips: [
          'El proyecto arranca en estado "Adjudicado". El supervisor lo mueve a "En Ejecución" cuando empieza la obra.',
        ],
      },
    ],
  },

  // ── SUPERVISOR ──────────────────────────────────────────────────────────
  {
    rol: 'supervisor',
    titulo: 'Supervisión de obra — del arranque al cierre',
    intro: 'Tu trabajo es ejecutar el proyecto y reportar el avance. Esta es la secuencia desde que recibes el proyecto adjudicado hasta que terminás la obra.',
    pasos: [
      {
        slug: 'crear-cronograma',
        titulo: '1. Armar el cronograma',
        descripcion:
          'Cada proyecto necesita un cronograma con sus actividades. Desde el proyecto, abre la pestaña Programación y crea uno nuevo.\n\nAgrega actividades con fecha de inicio, duración, dependencias entre ellas (FS, SS, FF, SF) y avance %. El sistema calcula la ruta crítica automáticamente.',
        ctaHref: '/proyectos',
        ctaLabel: 'Ver proyectos activos',
        imagen: 'supervisor-01-cronograma.png',
        tips: [
          'El Gantt soporta drag & drop para mover actividades.',
          'Activa "Saltar fines de semana" para que las fechas no caigan en sábados/domingos.',
          'Exporta el Gantt a PDF antes de imprimir o presentar al cliente.',
        ],
      },
      {
        slug: 'registrar-bitacora',
        titulo: '2. Registrar avance diario en la bitácora',
        descripcion:
          'Todos los días sube una entrada de bitácora con: descripción del avance, fotos, clima, # personas en obra y % de avance del proyecto.\n\nEste registro es la prueba de que la obra está caminando — el cliente y la dirección lo consultan.',
        ctaHref: '/proyectos',
        ctaLabel: 'Abrir un proyecto',
        imagen: 'supervisor-02-bitacora.png',
        tips: [
          'Las fotos se comprimen automáticamente en el navegador antes de subir, no agobian el servidor.',
          'Si actualizas el % de avance en la bitácora, también se actualiza el avance del proyecto.',
        ],
      },
      {
        slug: 'crear-adicional',
        titulo: '3. Gestionar adicionales / Change Orders',
        descripcion:
          'Cuando el cliente pide algo fuera del alcance original, registralo como Adicional desde la pestaña Adicionales del proyecto. Lleva: número, título, monto y estado (propuesto / aprobado / rechazado).\n\nLos aprobados se suman al presupuesto vigente automáticamente, sin tener que tocar el presupuesto base.',
        ctaHref: '/proyectos',
        ctaLabel: 'Ir a proyectos',
        imagen: 'supervisor-03-adicionales.png',
        tips: [
          'Si tu proceso es hacer un presupuesto aparte para el adicional, podés vincularlo al proyecto y luego "Convertir en adicional" con un click — usa el monto del presupuesto automáticamente.',
          'Los propuestos sin decidir bloquean el cierre formal del proyecto.',
        ],
      },
      {
        slug: 'cerrar-proyecto',
        titulo: '4. Cerrar el proyecto al terminar',
        descripcion:
          'Cuando la obra termina físicamente, primero marca avance al 100% y completa todas las actividades del cronograma. Después pasa al cierre formal:\n\nDesde el detalle del proyecto → botón "Cerrar proyecto". El sistema valida que no hayan facturas pendientes ni adicionales sin decidir, y genera un informe de cierre imprimible con margen, variación, desglose por capítulo y observaciones.',
        ctaHref: '/proyectos/kanban',
        ctaLabel: 'Pipeline de proyectos',
        imagen: 'supervisor-04-cerrar.png',
        tips: [
          'Solo se cierra cuando todas las facturas están cobradas. Si falta cobrar, primero coordina con contabilidad.',
          'Una vez cerrado, NO se puede registrar más gastos, facturas ni pagos del proyecto. Solo un admin puede reabrirlo.',
        ],
      },
    ],
  },

  // ── CONTABLE ────────────────────────────────────────────────────────────
  {
    rol: 'contable',
    titulo: 'Contabilidad — facturas, pagos y conciliación',
    intro: 'Tu trabajo es mantener al día las facturas (emitidas y recibidas), los pagos y la conciliación bancaria. Esta es la secuencia para empezar de cero.',
    pasos: [
      {
        slug: 'configurar-cuenta',
        titulo: '1. Configurar cuentas bancarias',
        descripcion:
          'Antes de registrar pagos necesitas las cuentas configuradas. Ve a Contabilidad → Cuentas y agrega cada cuenta bancaria de la empresa: nombre, banco, número, moneda y saldo inicial.\n\nEstos datos los usarás cada vez que registres un pago o importes movimientos.',
        ctaHref: '/contabilidad',
        ctaLabel: 'Ir a Contabilidad',
        imagen: 'contable-01-cuentas.png',
        tips: [
          'Si tienes cuentas en USD y RD$, créalas por separado. El sistema no convierte automáticamente.',
        ],
      },
      {
        slug: 'registrar-factura',
        titulo: '2. Registrar facturas (cobros y gastos)',
        descripcion:
          'Hay 2 tipos:\n\n• **Ingreso** (cobro al cliente): vincúlala al proyecto y cliente. Usa la sección Facturación.\n• **Egreso** (gasto al proveedor): vincúlala al proyecto si aplica. Puedes subir la foto/PDF y el OCR de IA extrae los datos (proveedor, RNC, NCF, totales, ITBIS, propina legal).',
        ctaHref: '/contabilidad/facturas/nueva',
        ctaLabel: 'Nueva factura',
        imagen: 'contable-02-factura.png',
        tips: [
          'El OCR funciona mejor con fotos planas y bien iluminadas. Si sale mal, click en "Reintentar con Claude" para usar otro modelo.',
          'Las proformas (sin NCF) las puedes convertir a fiscal después con el botón "Convertir a fiscal".',
        ],
      },
      {
        slug: 'registrar-pago',
        titulo: '3. Registrar pagos sobre facturas',
        descripcion:
          'Cada factura puede tener uno o varios pagos parciales. Desde el detalle de una factura → "Registrar Pago": fecha, monto, método, cuenta bancaria y referencia.\n\nEl sistema actualiza solo el saldo y el estado (Pendiente / Parcial / Pagada). Si seleccionaste cuenta bancaria, también se crea un movimiento bancario automático.',
        ctaHref: '/facturacion',
        ctaLabel: 'Ver facturas',
        imagen: 'contable-03-pago.png',
        tips: [
          'Si vinculas el pago a una cuenta, queda conciliado automáticamente.',
          'Si después editas o eliminas un pago, los totales se recalculan solos.',
        ],
      },
      {
        slug: 'importar-movimientos',
        titulo: '4. Importar movimientos del banco y conciliar',
        descripcion:
          'Mensualmente descarga el extracto bancario en CSV/Excel del portal del banco. Desde Contabilidad → Conciliación → Importar extracto, subí el archivo y mapeá las columnas.\n\nDespués usa la vista de Conciliación para vincular cada movimiento con su factura correspondiente. Lo que no coincide queda como "sin conciliar" para revisar.',
        ctaHref: '/contabilidad',
        ctaLabel: 'Ir a conciliación',
        imagen: 'contable-04-conciliacion.png',
        tips: [
          'Los pagos que tú registras dentro del sistema con cuenta bancaria ya quedan conciliados — no hay que volver a hacerlos.',
          'Podés exportar el conciliado a Excel con formato (moneda, totales, freeze de cabecera).',
        ],
      },
    ],
  },
]
