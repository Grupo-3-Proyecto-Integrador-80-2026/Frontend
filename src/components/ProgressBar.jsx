import { formatStatusBreakdown } from '../utils/workload'

/**
 * Barra de progreso accesible para la preparación del evento (US-10, PI-147).
 * Utiliza las clases globales definidas en App.css.
 *
 * Si se reciben `pending` y `postponed`, muestra además un desglose visible
 * por estado: completadas · pendientes · pospuestas.
 */
export default function ProgressBar({
  executed = 0,
  total = 0,
  percentage = 0,
  pending,
  postponed,
}) {
  const safePercentage = Math.min(100, Math.max(0, percentage))
  const hasBreakdown = Number.isFinite(pending) && Number.isFinite(postponed)
  const breakdown = hasBreakdown ? formatStatusBreakdown({ done: executed, pending, postponed }) : null
  const label = `Progreso de preparación: ${safePercentage}% (${executed} de ${total} gestiones ejecutadas)${
    breakdown ? `. ${breakdown}` : ''
  }`

  return (
    <div className="progress-bar-container">
      <div className="progress-bar-header">
        <span className="progress-bar-count">
          <strong>{executed}</strong> de <strong>{total}</strong> {total === 1 ? 'gestión completada' : 'gestiones completadas'}
        </span>
        <span className="progress-bar-percentage">{safePercentage}%</span>
      </div>

      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={safePercentage}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label={label}
      >
        <div
          className={`progress-fill ${safePercentage === 100 ? 'progress-fill-complete' : ''}`}
          style={{ width: `${safePercentage}%` }}
        />
      </div>

      {breakdown && <p className="progress-bar-breakdown">{breakdown}</p>}
    </div>
  )
}
