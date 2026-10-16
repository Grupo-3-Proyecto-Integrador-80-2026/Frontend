import { useId, useRef, useState } from 'react'
import { IconClock, IconX, IconAlertTriangle } from './Icons'
import useDialogFocus from './useDialogFocus'

/**
 * Modal para posponer una gestión con una nota opcional (US-08).
 * Quien lo usa lo monta solo mientras está abierto, así cada apertura arranca
 * con la nota actual de la gestión y sin errores previos.
 */
export default function PostponeModal({ subtask, onConfirm, onCancel }) {
  const [note, setNote] = useState(subtask.note || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const titleId = useId()
  const descriptionId = useId()
  const noteRef = useRef(null)

  // Foco en la nota, atrapado en el modal, y Escape para cerrar (no mientras se guarda)
  const dialogRef = useDialogFocus({
    onClose: onCancel,
    initialFocusRef: noteRef,
    closeOnEscape: !isSubmitting,
  })

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
    <div className="confirm-dialog-overlay">
      <div
        ref={dialogRef}
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        style={{ maxWidth: '460px', textAlign: 'left' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="confirm-dialog-icon">
              <IconClock size={20} />
            </div>
            <h2 id={titleId} className="confirm-dialog-title" style={{ margin: 0 }}>
              Posponer gestión
            </h2>
          </div>
          <button
            type="button"
            className="btn-cancel-pro btn-small"
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label="Cerrar"
          >
            <IconX size={16} />
          </button>
        </div>

        <p id={descriptionId} className="field-hint" style={{ marginTop: '12px' }}>
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
              ref={noteRef}
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
              disabled={isSubmitting}
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