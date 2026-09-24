/**
 * Utilidades de validación y formateo en cliente para formularios de eventos.
 */

const ALLOWED_EVENT_TYPES = ['wedding', 'social', 'corporate', 'birthday', 'other']
const ALLOWED_STATUSES = ['planning', 'in_progress', 'finished']

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

const ALLOWED_TASK_TYPES = TASK_TYPES.map((option) => option.value)

/**
 * Formatea automáticamente el texto de fecha a medida que el usuario escribe,
 * asegurando la estructura DD/MM/AAAA.
 * @param {string} value - Texto ingresado.
 * @returns {string} - Texto formateado con separadores de barra.
 */
export function autoFormatDateInput(value) {
  if (!value) return ''

  // Permitir sólo dígitos y barras
  const clean = value.replace(/[^\d/]/g, '')
  const digitsOnly = clean.replace(/\//g, '').slice(0, 8)

  if (digitsOnly.length === 0) {
    return ''
  }

  if (digitsOnly.length <= 2) {
    return clean.endsWith('/') && digitsOnly.length === 2 ? `${digitsOnly}/` : digitsOnly
  }

  if (digitsOnly.length <= 4) {
    const day = digitsOnly.slice(0, 2)
    const month = digitsOnly.slice(2)
    return clean.endsWith('/') && digitsOnly.length === 4 ? `${day}/${month}/` : `${day}/${month}`
  }

  const day = digitsOnly.slice(0, 2)
  const month = digitsOnly.slice(2, 4)
  const year = digitsOnly.slice(4, 8)
  return `${day}/${month}/${year}`
}

/**
 * Convierte una fecha de formato DD/MM/AAAA a formato ISO AAAA-MM-DD (para el backend).
 * @param {string} ddmmyyyy - Fecha en formato DD/MM/AAAA.
 * @returns {string} - Fecha en formato AAAA-MM-DD.
 */
export function formatDateToISO(ddmmyyyy) {
  if (!ddmmyyyy) return ''
  const trimmed = ddmmyyyy.trim()

  // Si ya viene en formato ISO AAAA-MM-DD, retornarlo directamente
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }

  const parts = trimmed.split('/')
  if (parts.length === 3) {
    const [day, month, year] = parts
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  return trimmed
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

      // Validar formato DD/MM/AAAA
      const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/
      const match = strValue.match(dateRegex)

      if (!match) {
        return 'El formato de fecha debe ser DD/MM/AAAA (ej. 28/10/2026).'
      }

      const day = Number(match[1])
      const month = Number(match[2])
      const year = Number(match[3])

      // Validar rangos numéricos
      if (day < 1 || day > 31) {
        return 'El día debe estar entre 01 y 31.'
      }
      if (month < 1 || month > 12) {
        return 'El mes debe estar entre 01 y 12.'
      }
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
 * Valida una fecha en formato DD/MM/AAAA: estructura, rangos numéricos y
 * existencia real del día en el calendario (bisiestos, meses de 30/31 días).
 * @param {string} strValue - Fecha en formato DD/MM/AAAA.
 * @returns {string|null} - Mensaje de error o null si es válida.
 */
function validateDateString(strValue) {
  // Validar formato DD/MM/AAAA
  const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/
  const match = strValue.match(dateRegex)

  if (!match) {
    return 'El formato de fecha debe ser DD/MM/AAAA (ej. 28/10/2026).'
  }

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])

  // Validar rangos numéricos
  if (day < 1 || day > 31) {
    return 'El día debe estar entre 01 y 31.'
  }
  if (month < 1 || month > 12) {
    return 'El mes debe estar entre 01 y 12.'
  }
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
        return 'La fecha programada es obligatoria.'
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
