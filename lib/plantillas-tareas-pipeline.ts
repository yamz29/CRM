// Plantillas de tareas predefinidas por etapa del pipeline
// Se usan como seed y como referencia para auto-creación

export const PLANTILLAS_DEFAULT = [
  // ── Lead ──
  { etapa: 'Lead', titulo: 'Contactar cliente', descripcion: 'Primer contacto: llamada o WhatsApp para confirmar interés', prioridad: 'Alta', diasLimite: 1, orden: 1 },
  { etapa: 'Lead', titulo: 'Calificar oportunidad', descripcion: 'Confirmar presupuesto disponible, plazo deseado y alcance general', prioridad: 'Media', diasLimite: 2, orden: 2 },

  // ── Levantamiento ──
  { etapa: 'Levantamiento', titulo: 'Agendar visita de levantamiento', descripcion: 'Coordinar fecha y hora para visita al sitio', prioridad: 'Alta', diasLimite: 2, orden: 1 },
  { etapa: 'Levantamiento', titulo: 'Tomar medidas del espacio', descripcion: 'Medir el área, tomar fotos y notas del sitio', prioridad: 'Alta', diasLimite: 5, orden: 2 },
  { etapa: 'Levantamiento', titulo: 'Documentar requerimientos del cliente', descripcion: 'Registrar preferencias de materiales, colores, distribución y funcionalidad', prioridad: 'Media', diasLimite: 5, orden: 3 },

  // ── Cotización ──
  { etapa: 'Cotización', titulo: 'Diseñar módulos en Espacios', descripcion: 'Crear el diseño modular con medidas y materiales definidos', prioridad: 'Alta', diasLimite: 3, orden: 1 },
  { etapa: 'Cotización', titulo: 'Crear presupuesto', descripcion: 'Generar presupuesto detallado con costos de materiales y mano de obra', prioridad: 'Alta', diasLimite: 5, orden: 2 },
  { etapa: 'Cotización', titulo: 'Enviar cotización al cliente', descripcion: 'Enviar presupuesto formal por correo o WhatsApp', prioridad: 'Alta', diasLimite: 6, orden: 3 },

  // ── Negociación ──
  { etapa: 'Negociación', titulo: 'Seguimiento con el cliente', descripcion: 'Contactar para responder dudas y negociar términos', prioridad: 'Alta', diasLimite: 2, orden: 1 },
  { etapa: 'Negociación', titulo: 'Ajustar presupuesto si necesario', descripcion: 'Modificar cotización según retroalimentación del cliente', prioridad: 'Media', diasLimite: 5, orden: 2 },
  { etapa: 'Negociación', titulo: 'Confirmar cierre y forma de pago', descripcion: 'Acordar condiciones finales, anticipo y calendario de pagos', prioridad: 'Alta', diasLimite: 7, orden: 3 },
]
