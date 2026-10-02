import { IconCalendar } from './Icons'

// Marco común de /login y /registro: marca de la app, título y tarjeta del formulario
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-logo-box" aria-hidden="true">
            <IconCalendar size={22} />
          </div>
          <div className="brand-text">
            <span className="brand-title">Organizador de Eventos</span>
            <p className="brand-subtitle">Gestión logística</p>
          </div>
        </div>

        <h1 className="auth-title">{title}</h1>
        {subtitle && <p className="auth-subtitle">{subtitle}</p>}

        {children}

        {footer && <p className="auth-footer">{footer}</p>}
      </div>
    </main>
  )
}
