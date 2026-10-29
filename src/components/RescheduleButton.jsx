import { useRef } from 'react'
import { IconCalendar } from './Icons'

/**
 * Botón secundario "Reprogramar": abre el calendario nativo y devuelve la
 * fecha elegida. Solo envía la nueva fecha; el estado lo decide la vista.
 */
export default function RescheduleButton({ task, min, max, onChange, disabled = false }) {
  const nativeRef = useRef(null)

  const openPicker = () => {
    if (disabled) return
    const input = nativeRef.current
    if (!input) return
    try {
      input.showPicker()
    } catch {
      input.focus()
      input.click()
    }
  }

  const handleChange = (e) => {
    const value = e.target.value
    if (value && value !== task.scheduled_date) onChange?.(value)
  }

  return (
    <span className="reschedule-control">
      <button
        type="button"
        className="btn-sec-pro btn-small reschedule-button"
        onClick={openPicker}
        disabled={disabled}
        title={`Reprogramar gestión ${task.name}`}
        aria-label={`Reprogramar gestión ${task.name}`}
        aria-haspopup="dialog"
      >
        <IconCalendar size={14} />
        <span>Reprogramar</span>
      </button>
      <input
        ref={nativeRef}
        type="date"
        className="reschedule-native"
        value={task.scheduled_date || ''}
        min={min}
        max={max || undefined}
        disabled={disabled}
        onChange={handleChange}
        tabIndex={-1}
        aria-hidden="true"
      />
    </span>
  )
}
