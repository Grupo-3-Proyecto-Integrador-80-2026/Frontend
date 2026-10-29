const MAX_LENGTH = 5

/**
 * Deja solo dígitos y, como mucho, un punto con un decimal.
 * Acepta coma decimal y también cubre texto pegado desde el portapapeles.
 * @param {string} rawValue
 * @returns {string}
 */
function sanitizeHours(rawValue) {
  const normalized = String(rawValue ?? '').replace(/,/g, '.')
  const digitsAndDots = normalized.replace(/[^\d.]/g, '')
  const [integerPart, ...decimalParts] = digitsAndDots.split('.')
  const decimalPart = decimalParts.join('').slice(0, 1)
  const hasDecimalPoint = digitsAndDots.includes('.')

  return `${integerPart}${hasDecimalPoint ? '.' : ''}${decimalPart}`.slice(0, MAX_LENGTH)
}

/**
 * Campo de horas estimadas: siempre texto con teclado decimal, pero el valor
 * que llega al formulario ya está saneado (solo números y máximo 1 decimal).
 */
export default function HoursInput({ className = '', onChange, ...props }) {
  const handleChange = (event) => {
    const { value } = event.target
    const sanitized = sanitizeHours(value)

    if (sanitized !== value) {
      event.target.value = sanitized
    }

    onChange?.(event)
  }

  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      maxLength={MAX_LENGTH}
      className={`field-input ${className}`.trim()}
      onChange={handleChange}
    />
  )
}
