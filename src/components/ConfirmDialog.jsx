import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { IconAlertTriangle, IconInfo } from './Icons'

// Elementos que pueden recibir foco dentro del diálogo
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function getFocusableElements(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('aria-hidden') && el.getClientRects().length > 0
  )
}

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
  const dialogRef = useRef(null)
  const cancelButtonRef = useRef(null)
  const previousFocusRef = useRef(null)
  const titleId = useId()
  const messageId = useId()

  // Al abrir: guarda quién abrió el diálogo, bloquea el scroll del body y
  // lleva el foco al botón de cancelar (la opción más segura por defecto).
  useEffect(() => {
    if (!open) return undefined

    previousFocusRef.current = document.activeElement

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    cancelButtonRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow

      const previous = previousFocusRef.current
      if (
        previous &&
        previous !== document.body &&
        typeof previous.focus === 'function' &&
        document.contains(previous)
      ) {
        previous.focus()
      }
    }
  }, [open])

  // Escape para cerrar, Tab/Shift+Tab para atrapar el foco dentro del
  // diálogo y bloqueo del scroll del contenido de fondo.
  useEffect(() => {
    if (!open) return undefined

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel?.()
        return
      }

      if (e.key !== 'Tab') return

      const dialog = dialogRef.current
      if (!dialog) return

      const focusables = getFocusableElements(dialog)
      if (focusables.length === 0) {
        e.preventDefault()
        return
      }

      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement
      const isInside = active instanceof Node && dialog.contains(active)

      if (e.shiftKey) {
        if (!isInside || active === first) {
          e.preventDefault()
          last.focus()
        }
      } else if (!isInside || active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    // El diálogo puede escrolear si desborda; lo que está fuera, no
    const handleOutsideScroll = (e) => {
      const dialog = dialogRef.current
      if (dialog && dialog.contains(e.target)) return
      e.preventDefault()
    }

    document.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('wheel', handleOutsideScroll, { passive: false, capture: true })
    document.addEventListener('touchmove', handleOutsideScroll, { passive: false, capture: true })

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('wheel', handleOutsideScroll, { capture: true })
      document.removeEventListener('touchmove', handleOutsideScroll, { capture: true })
    }
  }, [open, onCancel])

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
