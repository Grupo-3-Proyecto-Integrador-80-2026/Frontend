/**
 * Bloque estándar para los estados vacío, error y cargando de cualquier vista:
 * ícono + título + descripción opcional + acción opcional, siempre en ese orden.
 *
 * - `variant="error"` usa role="alert" para que el lector de pantalla lo anuncie.
 * - `variant="loading"` usa role="status" (anuncio no intrusivo).
 */
export default function StatusMessage({ variant = 'empty', icon, title, description, children }) {
  const role = variant === 'error' ? 'alert' : variant === 'loading' ? 'status' : undefined

  return (
    <div className={`status-message-box status-message-${variant}`} role={role}>
      {icon && (
        <div className="status-message-icon" aria-hidden="true">
          {icon}
        </div>
      )}
      <p className="status-message-title">{title}</p>
      {description && <p className="status-message-desc">{description}</p>}
      {children && <div className="status-message-actions">{children}</div>}
    </div>
  )
}
