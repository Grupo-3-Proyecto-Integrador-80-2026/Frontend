import { useState } from 'react'
import { IconEye, IconEyeOff } from './Icons'

/**
 * Campo de contraseña con botón para mostrarla u ocultarla.
 * El botón es operable por teclado y anuncia su estado con aria-pressed.
 * `invalid` marca el campo en rojo sin mensaje propio (p. ej. credenciales inválidas).
 */
export default function PasswordField({ id, label, error, hint, invalid = false, ...inputProps }) {
  const [visible, setVisible] = useState(false)
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ')

  return (
    <div className="field-group">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="password-box">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className={`field-input password-input ${error || invalid ? 'field-input-error' : ''}`}
          aria-invalid={Boolean(error || invalid)}
          aria-describedby={describedBy || undefined}
          {...inputProps}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
        >
          {visible ? <IconEyeOff size={18} /> : <IconEye size={18} />}
        </button>
      </div>
      {hint && (
        <small id={`${id}-hint`} className="field-hint">
          {hint}
        </small>
      )}
      {error && (
        <span id={`${id}-error`} className="field-error-text">
          {error}
        </span>
      )}
    </div>
  )
}
