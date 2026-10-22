/**
 * Utilidades derivadas de la carga de trabajo y del estado de las gestiones.
 * Todas son funciones puras: reciben datos de la API y no mutan sus argumentos.
 */

import { todayISO } from './validators'

/**
 * Estados de una gestión que todavía consumen horas del organizador.
 * @type {string[]}
 */
export const ACTIVE_STATUSES = ['pending', 'in_progress']

/**
 * Cuenta las gestiones por categoría de estado.
 * @param {Array<{status: string}>} subtasks
 * @returns {{total: number, done: number, pending: number, postponed: number}}
 *   `pending` agrupa las gestiones en estado `pending` e `in_progress`.
 */
export function countByStatus(subtasks) {
  const list = Array.isArray(subtasks) ? subtasks : []

  return list.reduce(
    (counts, task) => {
      counts.total += 1
      if (task?.status === 'done') {
        counts.done += 1
      } else if (task?.status === 'postponed') {
        counts.postponed += 1
      } else if (ACTIVE_STATUSES.includes(task?.status)) {
        counts.pending += 1
      }
      return counts
    },
    { total: 0, done: 0, pending: 0, postponed: 0 }
  )
}

/**
 * Días, desde `fromDate` en adelante, cuya suma de horas de gestiones activas
 * de todos los eventos supera el límite diario del organizador.
 * @param {Array<{subtasks?: Array<{scheduled_date: string, estimated_hours: string|number, status: string}>}>} events
 * @param {number} limit - Límite diario en horas.
 * @param {string} [fromDate] - Fecha ISO desde la que se evalúa (por defecto, hoy).
 * @returns {Map<string, number>} Mapa fecha ISO → horas activas acumuladas.
 */
export function overloadedDays(events, limit, fromDate = todayISO()) {
  const hoursByDate = new Map()
  const maxHours = Number(limit)
  const list = Array.isArray(events) ? events : []

  if (!Number.isFinite(maxHours)) return new Map()

  list.forEach((event) => {
    const subtasks = Array.isArray(event?.subtasks) ? event.subtasks : []

    subtasks.forEach((task) => {
      if (!task?.scheduled_date || task.scheduled_date < fromDate) return
      if (!ACTIVE_STATUSES.includes(task.status)) return

      const hours = Number(task.estimated_hours)
      if (!Number.isFinite(hours)) return

      hoursByDate.set(task.scheduled_date, (hoursByDate.get(task.scheduled_date) || 0) + hours)
    })
  })

  const overloaded = new Map()
  hoursByDate.forEach((hours, date) => {
    // Se redondea a 1 decimal para evitar que errores de coma flotante (2.1 + 3.9)
    // marquen como sobrecargado un día que está justo en el límite.
    if (Math.round(hours * 10) > maxHours * 10) overloaded.set(date, hours)
  })

  return overloaded
}

/**
 * Horas acumuladas del día de la gestión si es activa y ese día está sobrecargado.
 * @param {Map<string, number>} overloadByDate - Resultado de `overloadedDays`.
 * @param {{scheduled_date: string, status: string}} task
 * @returns {number|null} Horas del día sobrecargado, o null si no aplica.
 */
export function getDayOverload(overloadByDate, task) {
  if (!(overloadByDate instanceof Map) || !task?.scheduled_date) return null
  if (!ACTIVE_STATUSES.includes(task.status)) return null

  const hours = overloadByDate.get(task.scheduled_date)
  return hours ?? null
}

/**
 * Texto legible del desglose por estado, con singular y plural correctos.
 * Ejemplo: `2 completadas · 1 pendiente · 3 pospuestas`.
 * @param {{done?: number, pending?: number, postponed?: number}} counts
 * @returns {string}
 */
export function formatStatusBreakdown({ done = 0, pending = 0, postponed = 0 } = {}) {
  return [
    `${done} ${done === 1 ? 'completada' : 'completadas'}`,
    `${pending} ${pending === 1 ? 'pendiente' : 'pendientes'}`,
    `${postponed} ${postponed === 1 ? 'pospuesta' : 'pospuestas'}`,
  ].join(' · ')
}
