import { useState, useEffect } from 'react'
import {
  IconClock,
  IconX,
  IconAlertTriangle,
  IconCheckCircle,
  IconRefresh,
} from './Icons'
import { apiFetch } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { formatDateFromISO } from '../utils/validators'

const MIN_LIMIT = 1
const MAX_LIMIT = 16
const DEFAULT_LIMIT = 6
const RANGE_ERROR_MESSAGE = 'Ingresa un valor entero entre 1 y 16 horas.'

async function checkCurrentOverload(newLimit) {
  try {
    const todayData = await apiFetch('/api/today/')
    if (!todayData) return null

    const overloadedDays = []

    // 1. Revisar tareas de hoy
    const dueTodayTasks = todayData.due_today || []
    const dueTodayHours = dueTodayTasks.reduce(
      (sum, t) => sum + (Number(t.estimated_hours) || 0),
      0
    )
    if (dueTodayHours > newLimit) {
      overloadedDays.push({
        label: 'Hoy',
        date: todayData.today,
        hours: dueTodayHours,
        excess: Math.round((dueTodayHours - newLimit) * 10) / 10,
      })
    }

    // 2. Revisar tareas próximas
    const upcomingTasks = todayData.upcoming || []
    const hoursByDate = {}
    upcomingTasks.forEach((t) => {
      if (t.scheduled_date) {
        hoursByDate[t.scheduled_date] =
          (hoursByDate[t.scheduled_date] || 0) + (Number(t.estimated_hours) || 0)
      }
    })

    Object.entries(hoursByDate).forEach(([date, hours]) => {
      if (hours > newLimit) {
        overloadedDays.push({
          label: formatDateFromISO(date),
          date,
          hours: Math.round(hours * 10) / 10,
          excess: Math.round((hours - newLimit) * 10) / 10,
        })
      }
    })

    return overloadedDays
  } catch {
    return null
  }
}

export default function DailyLimitModal({ isOpen, onClose }) {
  const { user, updateUser } = useAuth()
  const initialValue = user?.daily_hours_limit ?? DEFAULT_LIMIT

  const [limit, setLimit] = useState(String(initialValue))
  const [errorMsg, setErrorMsg] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState({ type: null, message: '', overloadedDays: [] })

  useEffect(() => {
    if (isOpen) {
      setLimit(String(user?.daily_hours_limit ?? DEFAULT_LIMIT))
      setErrorMsg(null)
      setFeedback({ type: null, message: '', overloadedDays: [] })
    }
  }, [isOpen, user?.daily_hours_limit])

  if (!isOpen) return null

  const handleInputChange = (e) => {
    const val = e.target.value
    setLimit(val)
    setFeedback({ type: null, message: '', overloadedDays: [] })

    const num = Number(val)
    if (!val.trim() || isNaN(num) || num < MIN_LIMIT || num > MAX_LIMIT || !Number.isInteger(num)) {
      setErrorMsg(RANGE_ERROR_MESSAGE)
    } else {
      setErrorMsg(null)
    }
  }

  const isInvalid = Boolean(errorMsg || !limit.trim())

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    const num = Number(limit)
    if (isInvalid || isNaN(num) || num < MIN_LIMIT || num > MAX_LIMIT || !Number.isInteger(num)) {
      setErrorMsg(RANGE_ERROR_MESSAGE)
      return
    }

    setIsSubmitting(true)
    setFeedback({ type: null, message: '', overloadedDays: [] })

    try {
      const data = await apiFetch('/api/settings/daily-limit/', {
        method: 'PATCH',
        body: { daily_hours_limit: num },
      })

      if (typeof updateUser === 'function') {
        updateUser({ daily_hours_limit: data.daily_hours_limit })
      }

      const overloaded = await checkCurrentOverload(num)

      if (overloaded && overloaded.length > 0) {
        setFeedback({
          type: 'warning',
          message: 'Límite actualizado',
          overloadedDays: overloaded,
        })
      } else {
        setFeedback({
          type: 'success',
          message: '¡Configuración guardada!',
          overloadedDays: [],
        })
      }
      // Nota: Eliminamos el timer de cierre automático. El usuario decide cuándo salir.
    } catch {
      setFeedback({
        type: 'error',
        message: 'No se pudo guardar la configuración. Revisa tu conexión.',
        overloadedDays: [],
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const isCompleted = feedback.type === 'success' || feedback.type === 'warning'

  return (
    <div className="confirm-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="limit-modal-title">
      <div className="confirm-dialog" style={{ maxWidth: '440px', textAlign: 'left', padding: '24px' }}>
        
        {/* Cabecera limpia */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="confirm-dialog-icon" style={{ margin: 0, width: '36px', height: '36px' }}>
              <IconClock size={20} />
            </div>
            <h2 id="limit-modal-title" className="confirm-dialog-title" style={{ margin: 0, fontSize: '18px' }}>
              Límite diario de gestión
            </h2>
          </div>
          <button
            type="button"
            className="btn-cancel-pro btn-small"
            style={{ padding: '6px', borderRadius: '50%' }}
            onClick={onClose}
            aria-label="Cerrar ventana"
          >
            <IconX size={16} />
          </button>
        </div>

        <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5, margin: '0 0 16px 0' }}>
          Define el máximo de horas que dedicas por jornada. Te avisaremos oportunamente si al programar o mover gestiones excedes este tiempo.
        </p>

        {/* FEEDBACK: ÉXITO */}
        {feedback.type === 'success' && (
          <div
            role="status"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: '8px',
              marginBottom: '16px',
            }}
          >
            <IconCheckCircle size={20} className="icon-emerald" />
            <div style={{ fontSize: '13px', color: '#065f46' }}>
              <strong>{feedback.message}</strong>
              <div style={{ marginTop: '2px' }}>
                Tu disponibilidad diaria ahora es de <strong>{limit} horas</strong>.
              </div>
            </div>
          </div>
        )}

        {/* FEEDBACK: ADVERTENCIA REDISEÑADA (Sin saturar) */}
        {feedback.type === 'warning' && (
          <div
            role="status"
            style={{
              padding: '12px 14px',
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '8px',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <IconAlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0 }} />
              <strong style={{ fontSize: '13px', color: '#92400e' }}>
                Nuevo límite guardado ({limit}h/día)
              </strong>
            </div>

            <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#78350f', lineHeight: 1.4 }}>
              Detectamos que algunas jornadas ya programadas superan esta nueva meta:
            </p>

            <ul style={{ margin: '0 0 8px 0', paddingLeft: '18px', fontSize: '12px', color: '#92400e' }}>
              {feedback.overloadedDays.map((d) => (
                <li key={d.date} style={{ marginBottom: '3px' }}>
                  <strong>{d.label}:</strong> {d.hours}h planificadas (excede por {d.excess}h)
                </li>
              ))}
            </ul>

            <span style={{ display: 'block', fontSize: '11px', color: '#b45309', fontStyle: 'italic' }}>
              Al mover o editar tareas en esos días, podrás reprogramarlas con facilidad.
            </span>
          </div>
        )}

        {/* FEEDBACK: ERROR */}
        {feedback.type === 'error' && (
          <div className="banner-alert banner-error" role="alert" style={{ marginBottom: '16px' }}>
            <IconAlertTriangle size={18} className="icon-rose" />
            <span style={{ flex: 1, fontSize: '13px' }}>{feedback.message}</span>
            <button
              type="button"
              className="btn-alert-retry"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              <IconRefresh size={14} />
              <span>Reintentar</span>
            </button>
          </div>
        )}

        {/* FORMULARIO */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="field-group" style={{ marginBottom: '20px' }}>
            <label htmlFor="daily-hours-limit-input" className="field-label" style={{ fontWeight: 600 }}>
              Horas diarias permitidas (1 a 16) <span className="req-star">*</span>
            </label>
            <input
              id="daily-hours-limit-input"
              type="number"
              min={MIN_LIMIT}
              max={MAX_LIMIT}
              step="1"
              value={limit}
              onChange={handleInputChange}
              className={`field-input ${isInvalid ? 'field-input-error' : ''}`}
              placeholder="Ej: 6"
              autoFocus
              disabled={isSubmitting || isCompleted}
              aria-invalid={isInvalid}
              style={{ fontSize: '15px' }}
            />
            {errorMsg && (
              <span className="field-error-text" style={{ marginTop: '5px', display: 'block' }}>
                {errorMsg}
              </span>
            )}
            <small className="field-hint" style={{ marginTop: '6px', display: 'block' }}>
              Valor habitual recomendado: 6 horas/día.
            </small>
          </div>

          <div className="confirm-dialog-actions" style={{ marginTop: '16px' }}>
            {isCompleted ? (
              <button
                type="button"
                className="btn-submit-pro"
                onClick={onClose}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Entendido
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn-sec-pro"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-submit-pro"
                  disabled={isInvalid || isSubmitting}
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar límite'}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}