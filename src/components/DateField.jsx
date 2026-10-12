import { useId, useRef } from 'react'
import { IconCalendar } from './Icons'
import { formatDateFromISO } from '../utils/validators'

/**
 * Campo de fecha que muestra el valor en el formato de la app (DD/Mmm/AAAA)
 * y usa el calendario nativo del navegador para elegirla.
 */
export default function DateField({
  id,
  name,
  value,
  min,
  max,
  onChange,
  onBlur,
  className = '',
  required = false,
  disabled = false,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}) {
  const nativeRef = useRef(null)
  const hintId = useId()

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

  const handleKeyDown = (e) => {
    if (disabled) return
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault()
      openPicker()
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      onChange?.({ target: { name, value: '' } })
    }
  }

  return (
    <div className={`date-field ${disabled ? 'date-field-disabled' : ''}`}>
      <input
        id={id}
        type="text"
        readOnly
        disabled={disabled}
        value={value ? formatDateFromISO(value) : ''}
        placeholder="DD/Mmm/AAAA"
        className={`${className} date-field-display`}
        onClick={openPicker}
        onKeyDown={handleKeyDown}
        onBlur={() => onBlur?.({ target: { name, value: value || '' } })}
        required={required}
        aria-invalid={ariaInvalid}
        aria-describedby={[ariaDescribedBy, hintId].filter(Boolean).join(' ')}
        aria-haspopup="dialog"
        autoComplete="off"
      />
      <IconCalendar size={16} className="date-field-icon" />
      <span id={hintId} className="sr-only">
        Presiona Enter para abrir el calendario.
      </span>
      <input
        ref={nativeRef}
        type="date"
        name={name}
        value={value || ''}
        min={min}
        max={max}
        disabled={disabled}
        onChange={onChange}
        className="date-field-native"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  )
}