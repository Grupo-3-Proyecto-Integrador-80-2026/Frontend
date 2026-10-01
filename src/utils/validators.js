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

/**
 * Convierte una fecha ISO AAAA-MM-DD a formato legible DD/MM/AAAA.
 * @param {string} isodate - Fecha en formato AAAA-MM-DD.
 * @returns {string} - Fecha en formato DD/MM/AAAA.
 */
export function formatDateFromISO(isodate) {
  if (!isodate) return ''
  const trimmed = isodate.trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-')
    return `${day}/${month}/${year}`
  }

  return trimmed
}

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/**
 * Convierte una fecha ISO AAAA-MM-DD a un texto corto como "28 oct".
 * @param {string} isodate - Fecha en formato AAAA-MM-DD.
 * @returns {string}
 */
export function formatDateShort(isodate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isodate || '')
  if (!match) return isodate || ''
  return `${Number(match[3])} ${MONTHS_SHORT[Number(match[2]) - 1]}`
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
 * @returns {string|null} - Mensaje de error o null si es válido.
 */
export function validateEventField(fieldName, value) {
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
      return validateDateString(strValue)
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
 * @returns {Object} - Diccionario de errores { [fieldName]: string }.
 */
export function validateEventForm(formData) {
  const errors = {}
  const fields = ['name', 'event_date', 'event_type', 'status', 'contact', 'location', 'description']

  for (const field of fields) {
    const error = validateEventField(field, formData[field])
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
 * @returns {string|null} - Mensaje de error o null si es válido.
 */
export function validateSubtaskField(fieldName, value) {
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
      return validateDateString(strValue)
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
 * @returns {Object} - Diccionario de errores { [fieldName]: string }.
 */
export function validateSubtaskForm(formData) {
  const errors = {}
  const fields = ['name', 'type', 'scheduled_date', 'estimated_hours']

  for (const field of fields) {
    const error = validateSubtaskField(field, formData[field])
    if (error) {
      errors[field] = error
    }
  }

  return errors
}
