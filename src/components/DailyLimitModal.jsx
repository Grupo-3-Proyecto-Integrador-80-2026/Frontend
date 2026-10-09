import { useState } from 'react'
import { IconClock, IconX, IconAlertTriangle, IconCheckCircle, IconRefresh } from './Icons'
import { apiFetch } from '../api/client'
import { useAuth } from '../auth/AuthContext'

const MIN_LIMIT = 1
const MAX_LIMIT = 16
const DEFAULT_LIMIT = 6

export default function DailyLimitModal({ isOpen, onClose }) {
  const { user, updateUser } = useAuth()
  const initialValue = user?.daily_hours_limit ?? DEFAULT_LIMIT

  const [limit, setLimit] = useState(String(initialValue))
  const [errorMsg, setErrorMsg] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState({ type: null, message: '' })

  if (!isOpen) return null

  const handleInputChange = (e) => {
    const val = e.target.value
    setLimit(val)
    setFeedback({ type: null, message: '' })

    const num = Number(val)
    if (!val.trim() || isNaN(num) || num < MIN_LIMIT || num > MAX_LIMIT || !Number.isInteger(num)) {
      setErrorMsg(`El límite diario debe ser entre ${MIN_LIMIT} y ${MAX_LIMIT} horas.`)
    } else {
      setErrorMsg(null)
    }
  }

  const isInvalid = Boolean(errorMsg || !limit.trim())

  const handleSubmit = async (e) => {
    e.preventDefault()
    const num = Number(limit)
    if (isInvalid || isNaN(num) || num < MIN_LIMIT || num > MAX_LIMIT) {
      setErrorMsg(`El límite diario debe ser entre ${MIN_LIMIT} y ${MAX_LIMIT} horas.`)
      return
    }

    setIsSubmitting(true)
    setFeedback({ type: null, message: '' })

    try {
      const data = await apiFetch('/api/settings/daily-limit/', {
        method: 'PATCH',
        body: { daily_hours_limit: num },
      })

      if (typeof updateUser === 'function') {
        updateUser({ daily_hours_limit: data.daily_hours_limit })
      } else if (user) {
        user.daily_hours_limit = data.daily_hours_limit
      }

      const wasReduced = num < initialValue

      if (wasReduced) {
        setFeedback({
          type: 'warning',
          message: `Redujiste tu límite a ${num}h/día. Si ya tienes días con más de ${num}h planificadas, el sistema te advertirá sobrecarga cuando reprogrames o muevas tareas en esas fechas.`,
        })
        setTimeout(() => {
          onClose()
        }, 10000)
      } else {
        setFeedback({
          type: 'success',
          message: `Límite diario actualizado a ${num}h correctamente.`,
        })
        setTimeout(() => {
          onClose()
        }, 12000)
      }

    } catch (err) {
      const serverMsg =
        err.details?.daily_hours_limit?.[0] ||
        err.message ||
        'No pudimos guardar tu configuración.'
      setFeedback({
        type: 'error',
        message: serverMsg,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="confirm-dialog-overlay" role="dialog" aria-modal="true">
      <div className="confirm-dialog" style={{ maxWidth: '440px', textAlign: 'left' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="confirm-dialog-icon">
              <IconClock size={20} />
            </div>
            <h2 className="confirm-dialog-title" style={{ margin: 0 }}>
              Límite diario de gestión
            </h2>
          </div>
          <button
            type="button"
            className="btn-cancel-pro btn-small"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <IconX size={16} />
          </button>
        </div>

        <p className="field-hint" style={{ marginTop: '12px' }}>
          Configura cuántas horas máximas al día puedes dedicar a la organización de eventos. Si
          reprogramas gestiones y superas este límite, el sistema te advertirá sobre la sobrecarga.
        </p>

        {/* Banner de Éxito (Verde) */}
        {feedback.type === 'success' && (
          <div className="banner-alert banner-success" role="status" style={{ margin: '12px 0' }}>
            <IconCheckCircle size={18} className="icon-emerald" />
            <span>{feedback.message}</span>
          </div>
        )}

        {feedback.type === 'warning' && (
          <div
            className="banner-alert banner-warning"
            role="status"
            style={{
              margin: '12px 0',
              background: '#fffbeb',
              border: '1px solid #fcd34d',
              padding: '10px 12px',
              borderRadius: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <IconAlertTriangle
                size={18}
                style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }}
              />
              <div style={{ fontSize: '12px', color: '#92400e', lineHeight: '1.4' }}>
                <strong style={{ display: 'block', color: '#b45309', marginBottom: '2px' }}>
                  Atención: disponibilidad reducida
                </strong>
                <span>{feedback.message}</span>
              </div>
            </div>
          </div>
        )}

        {/* Banner de Error (Rojo) */}
        {feedback.type === 'error' && (
          <div className="banner-alert banner-error" role="alert" style={{ margin: '12px 0' }}>
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
              disabled={isSubmitting}
            />
            {errorMsg && (
              <span className="field-error-text" style={{ display: 'block', marginTop: '6px' }}>
                {errorMsg}
              </span>
            )}
            <small className="field-hint" style={{ marginTop: '4px', display: 'block' }}>
              Valor por defecto: 6 horas/día si no se personaliza.
            </small>
          </div>

          <div className="confirm-dialog-actions" style={{ marginTop: '24px' }}>
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
          </div>
        </form>
      </div>
    </div>
  )
}