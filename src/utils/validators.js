/**
 * Utilidades de validación y formateo en cliente para formularios de eventos.
 */

/**
 * Tipos de evento disponibles, con sus etiquetas en español.
 * @type {Array<{value: string, label: string}>}
 */
export const EVENT_TYPES = [
  { value: 'wedding', label: 'Boda' },
  { value: 'social', label: 'Social' },
  { value: 'corporate', label: 'Corporativo' },
  { value: 'birthday', label: 'Cumpleaños' },
  { value: 'other', label: 'Otro' },
]

/**
 * Estados del evento disponibles, con sus etiquetas en español.
 * @type {Array<{value: string, label: string}>}
 */
export const EVENT_STATUSES = [
  { value: 'planning', label: 'Planificación' },
  { value: 'in_progress', label: 'En curso' },
  { value: 'finished', label: 'Finalizado' },
]

const ALLOWED_EVENT_TYPES = EVENT_TYPES.map((option) => option.value)
const ALLOWED_STATUSES = EVENT_STATUSES.map((option) => option.value)

/**
 * Tipos de gestión (subtarea logística) disponibles, con sus etiquetas en español.
 * @type {Array<{value: string, label: string}>}
 */
export const TASK_TYPES = [
  { value: 'book_venue', label: 'Reservar salón' },
  { value: 'send_invitations', label: 'Enviar invitaciones' },
  { value: 'confirm_catering', label: 'Confirmar catering' },
  { value: 'coordinate_vendors', label: 'Coordinar proveedores' },
  { value: 'other', label: 'Otra' },
]

/**
 * Prioridades disponibles para una gestión, con sus etiquetas en español.
 * @type {Array<{value: string, label: string}>}
 */
export const TASK_PRIORITIES = [
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
]

/**
 * Estados de una gestión, con las mismas etiquetas que usa el backend.
 * @type {Array<{value: string, label: string}>}
 */
export const TASK_STATUSES = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'done', label: 'Hecho' },
  { value: 'postponed', label: 'Pospuesto' },
]

const ALLOWED_TASK_TYPES = TASK_TYPES.map((option) => option.value)

/**
 * Traduce el valor crudo del backend a su etiqueta en español.
 * @param {Array<{value: string, label: string}>} options
 * @param {string} value
 * @returns {string}
 */
export function getOptionLabel(options, value) {
  return options.find((option) => option.value === value)?.label || 'No especificado'
}

// Meses abreviados para el formato único de fechas de la app: DD/Mmm/AAAA (p. ej. 11/Sep/2026)
const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

/**
 * Convierte una fecha ISO AAAA-MM-DD al formato de la app, DD/Mmm/AAAA (p. ej. 11/Sep/2026).
 * Todas las fechas que se muestran al usuario pasan por aquí.
 * @param {string} isodate - Fecha en formato AAAA-MM-DD.
 * @returns {string}
 */
export function formatDateFromISO(isodate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((isodate || '').trim())
  if (!match) return (isodate || '').trim()
  return `${match[3]}/${MONTHS_SHORT[Number(match[2]) - 1]}/${match[1]}`
}

/**
 * Fecha de hoy en formato AAAA-MM-DD según el reloj local del navegador.
 * @returns {string}
 */
export function todayISO() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/**
 * Días de calendario entre dos fechas ISO (b - a), sin depender de la zona horaria.
 * @param {string} a - AAAA-MM-DD
 * @param {string} b - AAAA-MM-DD
 * @returns {number}
 */
export function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000)
}

/**
 * Valida una fecha AAAA-MM-DD (la que entrega <input type="date">):
 * estructura, rango de años y existencia real del día en el calendario.
 * @param {string} strValue
 * @returns {string|null} - Mensaje de error o null si es válida.
 */
function validateDateString(strValue) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(strValue)

  if (!match) {
    return 'Elige una fecha válida en el calendario.'
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (year < 1900 || year > 2100) {
    return 'El año debe estar entre 1900 y 2100.'
  }

  // Validar existencia real del día en el mes y año (bisiestos, meses de 30/31 días)
  const dateObj = new Date(year, month - 1, day)
  if (
    dateObj.getFullYear() !== year ||
    dateObj.getMonth() !== month - 1 ||
    dateObj.getDate() !== day
  ) {
    return 'La fecha ingresada no corresponde a un día válido en el calendario.'
  }

  return null
}

/**
 * Valida un campo individual según las reglas de negocio.
 * @param {string} fieldName - Nombre del campo.
 * @param {any} value - Valor actual del campo.
 * @param {Object} [options]
 * @param {string} [options.originalDate] - Fecha guardada del evento al editarlo: se permite
 *   conservarla aunque ya haya pasado, pero no cambiarla por otra fecha pasada.
 * @returns {string|null} - Mensaje de error o null si es válido.
 */
export function validateEventField(fieldName, value, { originalDate } = {}) {
  const strValue = typeof value === 'string' ? value.trim() : value

  switch (fieldName) {
    case 'name': {
      if (!strValue) {
        return 'El nombre del evento es obligatorio.'
      }
      if (strValue.length < 3) {
        return 'El nombre debe tener al menos 3 caracteres.'
      }
      if (strValue.length > 200) {
        return 'El nombre no puede exceder los 200 caracteres.'
      }
      return null
    }

    case 'event_date': {
      if (!strValue) {
        return 'La fecha del evento es obligatoria.'
      }
      const formatError = validateDateString(strValue)
      if (formatError) return formatError
      if (strValue < todayISO() && strValue !== originalDate) {
        return 'La fecha del evento no puede ser anterior a hoy.'
      }
      return null
    }

    case 'event_type': {
      if (!strValue) {
        return 'Debes seleccionar un tipo de evento.'
      }
      if (!ALLOWED_EVENT_TYPES.includes(strValue)) {
        return 'El tipo de evento seleccionado no es válido.'
      }
      return null
    }

    case 'status': {
      if (!strValue) {
        return 'Debes seleccionar un estado inicial.'
      }
      if (!ALLOWED_STATUSES.includes(strValue)) {
        return 'El estado seleccionado no es válido.'
      }
      return null
    }

    case 'contact': {
      if (strValue && strValue.length > 255) {
        return 'La información de contacto no puede superar los 255 caracteres.'
      }
      return null
    }

    case 'location': {
      if (strValue && strValue.length > 255) {
        return 'La ubicación o recinto no puede superar los 255 caracteres.'
      }
      return null
    }

    case 'description': {
      if (strValue && strValue.length > 2000) {
        return 'La descripción no puede exceder los 2000 caracteres.'
      }
      return null
    }

    default:
      return null
  }
}

/**
 * Valida todo el formulario de evento.
 * @param {Object} formData - Objeto con los datos del formulario.
 * @param {Object} [options] - Ver validateEventField (originalDate).
 * @returns {Object} - Diccionario de errores { [fieldName]: string }.
 */
export function validateEventForm(formData, options = {}) {
  const errors = {}
  const fields = ['name', 'event_date', 'event_type', 'status', 'contact', 'location', 'description']

  for (const field of fields) {
    const error = validateEventField(field, formData[field], options)
    if (error) {
      errors[field] = error
    }
  }

  return errors
}

/**
 * Valida un campo individual del formulario de creación de gestiones
 * (subtareas logísticas) según las reglas de negocio.
 * @param {string} fieldName - Nombre del campo.
 * @param {any} value - Valor actual del campo.
 * @param {Object} [options]
 * @param {string} [options.eventDate] - Fecha del evento (AAAA-MM-DD): la fecha objetivo no puede superarla.
 * @param {string} [options.originalDate] - Fecha guardada de la gestión al editarla: se permite
 *   conservarla aunque ya haya pasado.
 * @returns {string|null} - Mensaje de error o null si es válido.
 */
export function validateSubtaskField(fieldName, value, { eventDate, originalDate } = {}) {
  const strValue = typeof value === 'string' ? value.trim() : value

  switch (fieldName) {
    case 'name': {
      if (!strValue) {
        return 'El nombre de la gestión es obligatorio.'
      }
      if (strValue.length > 200) {
        return 'El nombre no puede exceder los 200 caracteres.'
      }
      return null
    }

    case 'type': {
      if (!strValue) {
        return 'Debes seleccionar un tipo de gestión.'
      }
      if (!ALLOWED_TASK_TYPES.includes(strValue)) {
        return 'El tipo de gestión seleccionado no es válido.'
      }
      return null
    }

    case 'scheduled_date': {
      if (!strValue) {
        return 'La fecha objetivo es obligatoria.'
      }
      const formatError = validateDateString(strValue)
      if (formatError) return formatError
      if (strValue === originalDate) return null
      // La gestión debe hacerse entre hoy y el día del evento
      if (strValue < todayISO()) {
        return 'La fecha objetivo no puede ser anterior a hoy.'
      }
      if (eventDate && strValue > eventDate) {
        // El "word joiner" (\u2060) evita que la fecha se parta en dos líneas tras una barra
        const date = formatDateFromISO(eventDate).replaceAll('/', '/\u2060')
        return `La fecha objetivo no puede ser posterior a la fecha del evento (${date}).`
      }
      return null
    }

    case 'estimated_hours': {
      if (strValue === null || strValue === undefined || strValue === '') {
        return 'Las horas estimadas son obligatorias.'
      }

      const hoursStr = String(strValue)

      // Aceptar números con hasta 1 posición decimal (ej. 2, 2.5, .5)
      if (!/^(\d+(\.\d?)?|\.\d)$/.test(hoursStr)) {
        return 'Las horas estimadas deben ser un número con máximo 1 decimal.'
      }

      if (Number(hoursStr) <= 0) {
        return 'Las horas estimadas deben ser un valor mayor a 0.'
      }

      return null
    }

    default:
      return null
  }
}

/**
 * Valida todo el formulario de creación de gestiones (subtareas logísticas).
 * @param {Object} formData - Objeto con los datos del formulario.
 * @param {Object} [options] - Ver validateSubtaskField (eventDate, originalDate).
 * @returns {Object} - Diccionario de errores { [fieldName]: string }.
 */
export function validateSubtaskForm(formData, options = {}) {
  const errors = {}
  const fields = ['name', 'type', 'scheduled_date', 'estimated_hours']

  for (const field of fields) {
    const error = validateSubtaskField(field, formData[field], options)
    if (error) {
      errors[field] = error
    }
  }

  return errors
}

/**
 * Indica si una gestión pendiente quedó después de la fecha de su evento
 * (por ejemplo, porque el evento se adelantó). Las gestiones hechas no cuentan.
 * @param {{scheduled_date: string, status: string}} task
 * @param {string} [eventDate] - AAAA-MM-DD
 * @returns {boolean}
 */
export function isAfterEventDate(task, eventDate) {
  return Boolean(eventDate) && task.status !== 'done' && task.scheduled_date > eventDate
}
