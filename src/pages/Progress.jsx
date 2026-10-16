import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  IconBarChart,
  IconAlertTriangle,
  IconRefresh,
  IconCalendar,
  IconPlus,
} from '../components/Icons'
import ProgressBar from '../components/ProgressBar'
import StatusMessage from '../components/StatusMessage'
import LoadingOverlay from '../components/LoadingOverlay'
import { apiFetch } from '../api/client'

export default function Progress() {
  // Igual que en Hoy: cada intento tiene su clave y el estado se deriva de la
  // respuesta, así no hay setState síncrono dentro del efecto
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState({ attempt: null, data: [], error: null })

  useEffect(() => {
    const controller = new AbortController()
    apiFetch('/api/progress/', { signal: controller.signal })
      .then((data) => setResult({ attempt, data: Array.isArray(data) ? data : [], error: null }))
      .catch((err) => {
        if (err.name === 'AbortError') return
        setResult({
          attempt,
          data: [],
          error: err.message || 'No pudimos consultar el progreso de tus eventos.',
        })
      })
    return () => controller.abort()
  }, [attempt])

  const loading = result.attempt !== attempt
  const { data: eventsProgress, error } = result
  const loadProgress = () => setAttempt((n) => n + 1)

  if (loading) {
    return (
      <LoadingOverlay label="Calculando el progreso de tus eventos...">
        <div style={{ height: '240px' }} />
      </LoadingOverlay>
    )
  }

  if (error) {
    return (
      <StatusMessage
        variant="error"
        icon={<IconAlertTriangle size={28} />}
        title="No pudimos cargar el progreso"
        description={error}
      >
        <button type="button" className="btn-primary-action" onClick={loadProgress}>
          <IconRefresh size={16} />
          <span>Reintentar</span>
        </button>
      </StatusMessage>
    )
  }

  if (eventsProgress.length === 0) {
    return (
      <StatusMessage
        icon={<IconCalendar size={28} />}
        title="No tienes eventos registrados"
        description="Crea tu primer evento para supervisar el avance de tus gestiones logísticas."
      >
        <Link to="/crear" className="btn-primary-action">
          <IconPlus size={16} />
          <span>Crear evento</span>
        </Link>
      </StatusMessage>
    )
  }

  return (
    <section className="events-section" aria-label="Progreso de eventos">
      <p className="section-subtitle">
        Supervisión de {eventsProgress.length}{' '}
        {eventsProgress.length === 1 ? 'evento en preparación' : 'eventos en preparación'}
      </p>

      <div className="events-cards-grid">
        {eventsProgress.map((item) => (
          <div key={item.event_id} className="event-card-item">
            <div className="event-card-top">
              <span className="badge-preview-chip">
                <IconBarChart size={13} style={{ marginRight: '4px' }} />
                Avance logístico
              </span>
            </div>

            <h2 className="event-name" style={{ fontSize: '18px', marginTop: '6px' }}>
              {item.event_name}
            </h2>

            <ProgressBar
              executed={item.executed}
              total={item.total}
              percentage={item.percentage}
            />

            <div className="event-card-footer" style={{ marginTop: '16px' }}>
              <span className="event-client" style={{ fontSize: '12px' }}>
                {item.total === 0
                  ? 'Sin gestiones registradas'
                  : item.percentage === 100
                  ? '¡Todas las gestiones listas!'
                  : `${item.total - item.executed} pendientes`}
              </span>
              <Link
                to={`/evento/${item.event_id}`}
                className="btn-manage-event"
                aria-label={`Ver detalle del evento ${item.event_name}`}
              >
                Ver evento
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}