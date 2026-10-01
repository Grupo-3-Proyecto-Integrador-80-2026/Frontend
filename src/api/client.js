/**
 * Cliente HTTP único para la API REST (Django + DRF).
 *
 * Centraliza la URL base y convierte cualquier fallo (red caída, 4xx, 5xx)
 * en un ApiError con un mensaje en español listo para mostrarse en la UI,
 * de modo que ninguna vista muestre textos técnicos como "Failed to fetch".
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

export const CONNECTION_ERROR_MESSAGE =
  'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.'

// Nombres legibles de los campos que el backend puede devolver en `details`
const FIELD_LABELS = {
  name: 'Nombre',
  event_type: 'Tipo de evento',
  contact: 'Cliente / contacto',
  location: 'Lugar',
  event_date: 'Fecha del evento',
  description: 'Descripción',
  status: 'Estado',
  type: 'Tipo de gestión',
  scheduled_date: 'Fecha objetivo',
  estimated_hours: 'Horas estimadas',
  priority: 'Prioridad',
  note: 'Nota',
  event: 'Evento',
}

// Mensaje por defecto según el código HTTP, cuando el backend no envía uno
const STATUS_MESSAGES = {
  400: 'Algunos datos no son válidos. Revísalos e inténtalo de nuevo.',
  401: 'Tu sesión no es válida. Inicia sesión de nuevo.',
  403: 'No tienes permiso para realizar esta acción.',
  404: 'No encontramos lo que buscas. Es posible que se haya eliminado.',
}

const SERVER_ERROR_MESSAGE =
  'Ocurrió un problema en el servidor. Inténtalo de nuevo en unos minutos.'

export class ApiError extends Error {
  /**
   * @param {string} message - Mensaje en español para la UI.
   * @param {number|null} status - Código HTTP (null si no hubo respuesta).
   * @param {Object<string, string>} fieldErrors - Errores por campo, ya aplanados.
   */
  constructor(message, status = null, fieldErrors = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

/**
 * Aplana el objeto `details` de DRF ({ campo: ['msg', ...] }) a { campo: 'msg' }.
 * @param {unknown} details
 * @returns {Object<string, string>}
 */
function flattenDetails(details) {
  if (!details || typeof details !== 'object') return {}

  return Object.entries(details).reduce((acc, [field, value]) => {
    const message = Array.isArray(value) ? value[0] : value
    if (typeof message === 'string') acc[field] = message
    return acc
  }, {})
}

/**
 * Construye una línea legible por campo: "Fecha objetivo: Introduzca una fecha válida."
 * @param {Object<string, string>} fieldErrors
 * @returns {string}
 */
export function describeFieldErrors(fieldErrors) {
  return Object.entries(fieldErrors)
    .map(([field, message]) => `${FIELD_LABELS[field] || field}: ${message}`)
    .join(' ')
}

/**
 * Ejecuta una petición a la API y devuelve el JSON de la respuesta.
 * @param {string} path - Ruta relativa, p. ej. '/api/events/'.
 * @param {Object} [options]
 * @param {string} [options.method='GET']
 * @param {Object} [options.body] - Se serializa como JSON.
 * @param {Object} [options.params] - Query params; se omiten los vacíos.
 * @param {AbortSignal} [options.signal] - Permite cancelar peticiones obsoletas.
 * @returns {Promise<any>}
 * @throws {ApiError}
 */
export async function apiFetch(path, { method = 'GET', body, params, signal } = {}) {
  const url = new URL(path, BASE_URL)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined) {
        url.searchParams.set(key, value)
      }
    })
  }

  let response
  try {
    response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new ApiError(CONNECTION_ERROR_MESSAGE)
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    if (response.status >= 500) {
      throw new ApiError(SERVER_ERROR_MESSAGE, response.status)
    }

    const fieldErrors = flattenDetails(data?.details)
    const fieldSummary = describeFieldErrors(fieldErrors)
    const message =
      response.status === 400 && fieldSummary
        ? `${data?.error || STATUS_MESSAGES[400]} ${fieldSummary}`
        : STATUS_MESSAGES[response.status] || data?.error || SERVER_ERROR_MESSAGE

    throw new ApiError(message, response.status, fieldErrors)
  }

  return data
}
