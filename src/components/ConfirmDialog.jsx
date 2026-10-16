import { useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { IconAlertTriangle, IconInfo } from './Icons'
import useDialogFocus from './useDialogFocus'

/**
 * Diálogo de confirmación reutilizable y accesible.
 *
 * - `role="dialog"` + `aria-modal` + `aria-labelledby` hacia su título.
 * - Mueve el foco al botón de cancelar al abrirse y lo devuelve al elemento
 *   que lo abrió al cerrarse.
 * - Atrapa el foco con Tab/Shift+Tab mientras está abierto.
 * - Escape equivale a `onCancel`.
 * - Bloquea clics y scroll del contenido de fondo.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  children,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  isDangerous = false,
  confirmDisabled = false,
}) {
  const cancelButtonRef = useRef(null)
  const titleId = useId()
  const messageId = useId()

  // Foco inicial en cancelar (la opción más segura), trampa de foco, Escape y bloqueo de scroll
  const dialogRef = useDialogFocus({ open, onClose: onCancel, initialFocusRef: cancelButtonRef })

  if (!open) return null

  return createPortal(
    // El overlay cubre toda la pantalla: absorbe los clics y el scroll,
    // por lo que el contenido de atrás no es interactuable
    <div className="confirm-dialog-overlay">
      <div
        ref={dialogRef}
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
      >
        <div className={`confirm-dialog-icon ${isDangerous ? 'confirm-dialog-icon-danger' : ''}`}>
          {isDangerous ? <IconAlertTriangle size={22} /> : <IconInfo size={22} />}
        </div>

        <h2 id={titleId} className="confirm-dialog-title">
          {title}
        </h2>

        <div id={messageId} className="confirm-dialog-message">
          {children ?? message}
        </div>

        <div className="confirm-dialog-actions">
          <button
            type="button"
            className="btn-sec-pro"
            onClick={onCancel}
            ref={cancelButtonRef}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={isDangerous ? 'btn-danger-pro' : 'btn-submit-pro'}
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
