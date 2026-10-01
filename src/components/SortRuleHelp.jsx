import { useEffect, useId, useRef, useState } from 'react'
import { IconHelpCircle } from './Icons'

// Retraso al pasar el cursor, para que un cruce accidental no abra la ayuda
const HOVER_DELAY_MS = 400

/**
 * Ayuda contextual "¿Cómo se ordena esto?" de la vista Hoy (US-04, Decisión 5).
 *
 * - Cursor encima: se abre tras un pequeño retraso y se cierra al salir.
 * - Clic / tap: la deja fija abierta (o la cierra si ya estaba fija).
 * - Teclado: se abre al recibir el foco; Escape la cierra.
 */
export default function SortRuleHelp({ windowDays = 7 }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPinned, setIsPinned] = useState(false)
  const hoverTimer = useRef(null)
  const panelId = useId()

  useEffect(() => () => clearTimeout(hoverTimer.current), [])

  useEffect(() => {
    if (!isOpen) return undefined
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        setIsPinned(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const handleMouseEnter = () => {
    clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => setIsOpen(true), HOVER_DELAY_MS)
  }

  const handleMouseLeave = () => {
    clearTimeout(hoverTimer.current)
    if (!isPinned) setIsOpen(false)
  }

  const handleClick = () => {
    const nextPinned = !isPinned
    setIsPinned(nextPinned)
    setIsOpen(nextPinned)
  }

  return (
    <div className="sort-help" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button
        type="button"
        className="sort-help-trigger"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={handleClick}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          if (!isPinned) setIsOpen(false)
        }}
      >
        <IconHelpCircle size={16} />
        <span>¿Cómo se ordena esto?</span>
      </button>

      <div id={panelId} className="sort-help-panel" hidden={!isOpen}>
        <p>
          Tus gestiones se agrupan según su fecha objetivo: <strong>Vencidas</strong> (antes de hoy),{' '}
          <strong>Para hoy</strong> y <strong>Próximas</strong> (en los siguientes {windowDays} días).
          Dentro de cada grupo se ordenan por fecha: en Vencidas, la más antigua primero; en Próximas,
          la más cercana primero. Si dos gestiones tienen la misma fecha, se muestra primero la de
          menor esfuerzo estimado.
        </p>
      </div>
    </div>
  )
}
