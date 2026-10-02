import { useId, useRef } from 'react'
import { IconCalendar } from './Icons'
import { formatDateFromISO } from '../utils/validators'

/**
 * Campo de fecha que muestra el valor en el formato de la app (DD/Mmm/AAAA, p. ej.
 * 11/Sep/2026) y usa el calendario nativo del navegador para elegirla.
 *
 * El <input type="date"> nativo muestra la fecha según el idioma del navegador y no se
 * puede formatear; por eso queda oculto y solo aporta el calendario, min/max y el valor ISO.
 *
 * - Clic, Enter, Espacio o flecha abajo abren el calendario.
 * - Supr o Retroceso borran la fecha.
 * - onChange/onBlur reciben { target: { name, value } } con el valor AAAA-MM-DD, igual
 *   que un input normal, así que los formularios no cambian.
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
  required,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}) {
  const nativeRef = useRef(null)
  const hintId = useId()

  const openPicker = () => {
    const input = nativeRef.current
    if (!input) return
    try {
      input.showPicker()
    } catch {
      // Navegadores sin showPicker: se enfoca el control nativo para usar su calendario
      input.focus()
      input.click()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault()
      openPicker()
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      onChange?.({ target: { name, value: '' } })
    }
  }

  return (
    <div className="date-field">
      <input
        id={id}
        type="text"
        readOnly
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
        onChange={onChange}
        className="date-field-native"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  )
}
