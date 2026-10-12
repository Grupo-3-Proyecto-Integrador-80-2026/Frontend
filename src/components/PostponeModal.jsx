import { useState, useEffect } from 'react'
import { IconClock, IconX, IconAlertTriangle } from './Icons'

export default function PostponeModal({ isOpen, subtask, onConfirm, onCancel }) {
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  // Resetea el formulario al abrir
  useEffect(() => {
    if (isOpen && subtask) {
      setNote(subtask.note || '')
      setIsSubmitting(false)
      setErrorMsg(null)
    }
  }, [isOpen, subtask])

  if (!isOpen || !subtask) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrorMsg(null)

    try {
      await onConfirm(subtask, note.trim())
    } catch (err) {
      setErrorMsg(err.message || 'No se pudo posponer la gestión.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="confirm-dialog-overlay" role="dialog" aria-modal="true">
      <div className="confirm-dialog" style={{ maxWidth: '460px', textAlign: 'left' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="confirm-dialog-icon">
              <IconClock size={20} />
            </div>
            <h2 className="confirm-dialog-title" style={{ margin: 0 }}>
              Posponer gestión
            </h2>
          </div>
          <button
            type="button"
            className="btn-cancel-pro btn-small"
            onClick={onCancel}
            aria-label="Cerrar modal"
          >
            <IconX size={16} />
          </button>
        </div>

        <p className="field-hint" style={{ marginTop: '12px' }}>
          Estás posponiendo la gestión <strong>"{subtask.name}"</strong>. Esta tarea no sumará
          horas de carga a tu día mientras esté pospuesta.
        </p>

        {errorMsg && (
          <div className="banner-alert banner-error" role="alert" style={{ margin: '12px 0' }}>
            <IconAlertTriangle size={16} className="icon-rose" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate style={{ marginTop: '12px' }}>
          <div className="field-group">
            <label htmlFor="postpone-note" className="field-label">
              Nota o motivo de postergación (opcional)
            </label>
            <textarea
              id="postpone-note"
              rows="3"
              className="field-input field-textarea"
              placeholder="Ej: Esperando confirmación de la cotización del salón..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={isSubmitting}
              autoFocus
            />
            <small className="field-hint">
              Esta nota quedará visible para recordar qué falta para reanudar la gestión.
            </small>
          </div>

          <div className="confirm-dialog-actions" style={{ marginTop: '20px' }}>
            <button
              type="button"
              className="btn-sec-pro"
              onClick={onCancel}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-submit-pro"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Guardando...' : 'Confirmar y posponer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}