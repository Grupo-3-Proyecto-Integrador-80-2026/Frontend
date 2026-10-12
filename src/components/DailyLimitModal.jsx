import { useState, useEffect, useRef } from 'react'
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
const RANGE_ERROR_MESSAGE = 'El límite diario debe ser entre 1 y 16 horas.'

/**
 * Consulta las gestiones activas del usuario y calcula si algún día
 * (hoy o próximos) supera el nuevo límite que el usuario intenta configurar.
 */
async function checkCurrentOverload(newLimit) {
  try {
    const todayData = await apiFetch('/api/today/')
    if (!todayData) return null

    const overloadedDays = []

    // 1. Verificar el día de hoy
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
        excess: dueTodayHours - newLimit,
      })
    }

    // 2. Verificar gestiones en los próximos días
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
          hours,
          excess: hours - newLimit,
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
  const timerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

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

      // Analizar si las gestiones actuales causan sobrecarga con el nuevo límite
      const overloaded = await checkCurrentOverload(num)

      if (overloaded && overloaded.length > 0) {
        setFeedback({
          type: 'warning',
          message: 'Límite diario actualizado correctamente.',
          overloadedDays: overloaded,
        })
      } else {
        setFeedback({
          type: 'success',
          message: 'Límite diario actualizado correctamente.',
          overloadedDays: [],
        })
      }

      // Cierre automático suave de 6 segundos si no interactúa
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        onClose()
      }, 6000)
    } catch {
      setFeedback({
        type: 'error',
        message: 'No pudimos guardar tu configuración.',
        overloadedDays: [],
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleManualClose = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    onClose()
  }

  const isCompleted = feedback.type === 'success' || feedback.type === 'warning'

  return (
    <div className="confirm-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="limit-modal-title">
      <div className="confirm-dialog" style={{ maxWidth: '460px', textAlign: 'left' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="confirm-dialog-icon">
              <IconClock size={20} />
            </div>
            <h2 id="limit-modal-title" className="confirm-dialog-title" style={{ margin: 0 }}>
              Límite diario de gestión
            </h2>
          </div>
          <button
            type="button"
            className="btn-cancel-pro btn-small"
            onClick={handleManualClose}
            aria-label="Cerrar modal"
          >
            <IconX size={16} />
          </button>
        </div>

        <p className="field-hint" style={{ marginTop: '12px' }}>
          Configura cuántas horas máximas al día puedes dedicar a la organización de eventos. Si
          reprogramas gestiones y superas este límite, el sistema te advertirá sobre la sobrecarga (US-07 / US-08).
        </p>

        {/* FEEDBACK DE ÉXITO SIN SOBRECARGA */}
        {feedback.type === 'success' && (
          <div className="banner-alert banner-success" role="status" style={{ margin: '14px 0' }}>
            <IconCheckCircle size={18} className="icon-emerald" />
            <div style={{ flex: 1, fontSize: '13px' }}>
              <strong>{feedback.message}</strong>
              <p style={{ margin: '4px 0 0 0', color: '#065f46' }}>
                Tu disponibilidad diaria ahora es de <strong>{limit}h</strong>. Tus gestiones planificadas están dentro de este margen.
              </p>
            </div>
          </div>
        )}

        {/* FEEDBACK DE ÉXITO CON ADVERTENCIA DE SOBRECARGA ACTUAL (US-07 / US-12) */}
        {feedback.type === 'warning' && (
          <div
            className="banner-alert banner-warning"
            role="status"
            style={{
              margin: '14px 0',
              background: '#fffbeb',
              border: '1px solid #fcd34d',
              padding: '12px',
              borderRadius: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <IconAlertTriangle
                size={18}
                style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }}
              />
              <div style={{ fontSize: '12px', color: '#92400e', lineHeight: '1.4' }}>
                <strong style={{ display: 'block', color: '#b45309', marginBottom: '4px', fontSize: '13px' }}>
                  {feedback.message}
                </strong>
                <span>
                  Con tu nuevo límite de <strong>{limit}h/día</strong>, detectamos días que ya tienen sobrecarga planificada:
                </span>
                <ul style={{ margin: '6px 0 6px 18px', padding: 0 }}>
                  {feedback.overloadedDays.map((d) => (
                    <li key={d.date}>
                      <strong>{d.label}:</strong> {d.hours}h planificadas (exceso de {d.excess}h).
                    </li>
                  ))}
                </ul>
                <span style={{ fontStyle: 'italic', display: 'block', marginTop: '4px' }}>
                  El sistema bloqueará y te asistirá para resolver conflictos cuando muevas o reprogrames tareas en esas fechas.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* FEEDBACK DE ERROR CON REINTENTO (US-12) */}
        {feedback.type === 'error' && (
          <div className="banner-alert banner-error" role="alert" style={{ margin: '14px 0' }}>
            <IconAlertTriangle size={18} className="icon-rose" />
            <div style={{ flex: 1 }}>
              <span>{feedback.message}</span>
            </div>
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

        <form onSubmit={handleSubmit} noValidate style={{ marginTop: '16px' }}>
          <div className="field-group">
            <label htmlFor="daily-hours-limit-input" className="field-label">
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
              aria-describedby={errorMsg ? 'daily-limit-error' : undefined}
            />
            {errorMsg && (
              <span id="daily-limit-error" className="field-error-text" style={{ display: 'block', marginTop: '6px' }}>
                {errorMsg}
              </span>
            )}
            <small className="field-hint" style={{ marginTop: '4px', display: 'block' }}>
              Valor por defecto: 6 horas/día si no se personaliza.
            </small>
          </div>

          <div className="confirm-dialog-actions" style={{ marginTop: '24px' }}>
            {isCompleted ? (
              <button
                type="button"
                className="btn-submit-pro"
                onClick={handleManualClose}
                style={{ width: '100%' }}
              >
                Entendido
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn-sec-pro"
                  onClick={handleManualClose}
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