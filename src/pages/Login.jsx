import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import PasswordField from '../components/PasswordField'
import { IconAlertTriangle, IconInfo, IconRefresh } from '../components/Icons'
import { useAuth } from '../auth/AuthContext'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate({ email, password }) {
  const errors = {}
  if (!email.trim()) errors.email = 'El correo es obligatorio.'
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Ingresa un correo válido.'
  if (!password) errors.password = 'La contraseña es obligatoria.'
  return errors
}

export default function Login() {
  const { login, expired } = useAuth()
  const location = useLocation()

  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  // 'credentials' | 'connection' | null: decide qué aviso mostrar y si se ofrece reintentar
  const [failure, setFailure] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const submit = async () => {
    const formErrors = validate(form)
    setErrors(formErrors)
    setFailure(null)
    if (Object.keys(formErrors).length > 0) return

    setIsSubmitting(true)
    try {
      // Al iniciar sesión, PublicOnlyRoute redirige a /hoy (o a la página que se pidió)
      await login(form.email.trim(), form.password)
    } catch (err) {
      setFailure(err.status === 401 || err.status === 400 ? 'credentials' : 'connection')
      setIsSubmitting(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    submit()
  }

  const credentialsError = failure === 'credentials'

  return (
    <AuthLayout
      title="Iniciar sesión"
      subtitle="Ingresa con tu correo para ver tus eventos y gestiones."
      footer={
        <>
          ¿No tienes una cuenta?{' '}
          <Link to="/registro" state={location.state}>
            Crear cuenta
          </Link>
        </>
      }
    >
      {expired && !failure && (
        <div className="banner-alert banner-info" role="status">
          <IconInfo size={18} />
          <span>Tu sesión terminó. Inicia sesión de nuevo para continuar.</span>
        </div>
      )}

      {credentialsError && (
        <div className="banner-alert banner-error" role="alert">
          <IconAlertTriangle size={18} />
          <span>
            <strong>Credenciales inválidas.</strong> Revisa tu correo y tu contraseña.
          </span>
        </div>
      )}

      {failure === 'connection' && (
        <div className="banner-alert banner-error" role="alert">
          <IconAlertTriangle size={18} />
          <span>No pudimos conectar con el servidor. Revisa tu conexión.</span>
          <button type="button" className="btn-alert-retry" onClick={submit} disabled={isSubmitting}>
            <IconRefresh size={14} />
            <span>Reintentar</span>
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="auth-form">
        <div className="field-group">
          <label htmlFor="login-email" className="field-label">
            Correo electrónico
          </label>
          <input
            id="login-email"
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            autoComplete="email"
            placeholder="tu@correo.com"
            className={`field-input ${errors.email || credentialsError ? 'field-input-error' : ''}`}
            aria-invalid={Boolean(errors.email || credentialsError)}
            aria-describedby={errors.email ? 'login-email-error' : undefined}
          />
          {errors.email && (
            <span id="login-email-error" className="field-error-text">
              {errors.email}
            </span>
          )}
        </div>

        <PasswordField
          id="login-password"
          label="Contraseña"
          name="password"
          value={form.password}
          onChange={handleChange}
          autoComplete="current-password"
          placeholder="Tu contraseña"
          error={errors.password}
          invalid={credentialsError}
        />

        <button type="submit" className="btn-submit-pro auth-submit" disabled={isSubmitting}>
          {isSubmitting ? 'Iniciando sesión...' : 'Iniciar sesión'}
        </button>
      </form>
    </AuthLayout>
  )
}
