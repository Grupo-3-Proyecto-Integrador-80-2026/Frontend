import { useEffect, useRef } from 'react'

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
 * Comportamiento accesible compartido por todos los modales.
 *
 * - Al abrir guarda quién tenía el foco, lo lleva a `initialFocusRef` (o al
 *   primer elemento enfocable) y al cerrar lo devuelve.
 * - Atrapa el foco con Tab/Shift+Tab dentro del diálogo.
 * - Escape llama a `onClose` (salvo que `closeOnEscape` sea false, p. ej. mientras se guarda).
 * - Bloquea el scroll del contenido de fondo.
 *
 * @param {Object} options
 * @param {boolean} [options.open=true]
 * @param {Function} options.onClose
 * @param {React.RefObject} [options.initialFocusRef]
 * @param {boolean} [options.closeOnEscape=true]
 * @returns {React.RefObject} ref para el elemento con role="dialog".
 */
export default function useDialogFocus({
  open = true,
  onClose,
  initialFocusRef,
  closeOnEscape = true,
}) {
  const dialogRef = useRef(null)
  const previousFocusRef = useRef(null)
  // Refs para que los listeners no se re-registren en cada render del padre
  const onCloseRef = useRef(onClose)
  const closeOnEscapeRef = useRef(closeOnEscape)

  useEffect(() => {
    onCloseRef.current = onClose
    closeOnEscapeRef.current = closeOnEscape
  })

  useEffect(() => {
    if (!open) return undefined

    previousFocusRef.current = document.activeElement

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const dialog = dialogRef.current
    const initial = initialFocusRef?.current || (dialog && getFocusableElements(dialog)[0])
    initial?.focus()

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
  }, [open, initialFocusRef])

  useEffect(() => {
    if (!open) return undefined

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (closeOnEscapeRef.current) onCloseRef.current?.()
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
  }, [open])

  return dialogRef
}
