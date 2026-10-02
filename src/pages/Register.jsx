import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import PasswordField from '../components/PasswordField'
import { IconAlertTriangle } from '../components/Icons'
import { useAuth } from '../auth/AuthContext'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const INITIAL_FORM = { first_name: '', last_name: '', email: '', password: '', password_confirm: '' }

function validate(form) {
  const errors = {}
  if (!form.first_name.trim()) errors.first_name = 'El nombre es obligatorio.'
  if (!form.last_name.trim()) errors.last_name = 'El apellido es obligatorio.'
  if (!form.email.trim()) errors.email = 'El correo es obligatorio.'
  else if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = 'Ingresa un correo válido.'
  if (!form.password) errors.password = 'La contraseña es obligatoria.'
  else if (form.password.length < 8) errors.password = 'La contraseña debe tener al menos 8 caracteres.'
  if (form.password_confirm !== form.password) errors.password_confirm = 'Las contraseñas no coinciden.'
  return errors
}

export default function Register() {
  const { register } = useAuth()
  const location = useLocation()

  const [form, setForm] = useState(INITIAL_FORM)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const formErrors = validate(form)
    setErrors(formErrors)
    setFormError(null)
    if (Object.keys(formErrors).length > 0) return

    setIsSubmitting(true)
    try {
      // La cuenta queda con sesión iniciada y PublicOnlyRoute lleva a /hoy
      await register({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        password: form.password,
      })
    } catch (err) {
      // Los errores del servidor (correo ya registrado, contraseña débil) van junto a su campo
      if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
        setErrors(err.fieldErrors)
        setFormError('Revisa los campos marcados en rojo.')
      } else {
        setFormError(err.message)
      }
      setIsSubmitting(false)
    }
  }

  const textField = (name, label, props = {}) => (
    <div className="field-group">
      <label htmlFor={`register-${name}`} className="field-label">
        {label}
      </label>
      <input
        id={`register-${name}`}
        name={name}
        value={form[name]}
        onChange={handleChange}
        className={`field-input ${errors[name] ? 'field-input-error' : ''}`}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `register-${name}-error` : undefined}
        {...props}
      />
      {errors[name] && (
        <span id={`register-${name}-error`} className="field-error-text">
          {errors[name]}
        </span>
      )}
    </div>
  )

  return (
    <AuthLayout
      title="Crear cuenta"
      subtitle="Regístrate para organizar tus eventos y sus gestiones."
      footer={
        <>
          ¿Ya tienes una cuenta?{' '}
          <Link to="/login" state={location.state}>
            Iniciar sesión
          </Link>
        </>
      }
    >
      {formError && (
        <div className="banner-alert banner-error" role="alert">
          <IconAlertTriangle size={18} />
          <span>
            <strong>No pudimos crear tu cuenta.</strong> {formError}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="auth-form">
        <div className="field-row-2">
          {textField('first_name', 'Nombre', { type: 'text', autoComplete: 'given-name', maxLength: 150 })}
          {textField('last_name', 'Apellido', { type: 'text', autoComplete: 'family-name', maxLength: 150 })}
        </div>
        {textField('email', 'Correo electrónico', {
          type: 'email',
          autoComplete: 'email',
          placeholder: 'tu@correo.com',
          maxLength: 150,
        })}
        <PasswordField
          id="register-password"
          label="Contraseña"
          name="password"
          value={form.password}
          onChange={handleChange}
          autoComplete="new-password"
          hint="Mínimo 8 caracteres; evita contraseñas comunes o solo con números."
          error={errors.password}
        />
        <PasswordField
          id="register-password-confirm"
          label="Confirmar contraseña"
          name="password_confirm"
          value={form.password_confirm}
          onChange={handleChange}
          autoComplete="new-password"
          error={errors.password_confirm}
        />

        <button type="submit" className="btn-submit-pro auth-submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
      </form>
    </AuthLayout>
  )
}
