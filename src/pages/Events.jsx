import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconCalendar, IconMapPin, IconUser, IconPlus, IconAlertTriangle, IconRefresh } from '../components/Icons'
import StatusMessage from '../components/StatusMessage'
import LoadingOverlay, { EventsSkeleton } from '../components/LoadingOverlay'
import { apiFetch } from '../api/client'
import { formatDateFromISO, getOptionLabel, EVENT_TYPES, EVENT_STATUSES } from '../utils/validators'

export default function Events() {
  // Cada intento de carga tiene un número; "cargando" = la respuesta de ese intento aún no llega
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState({ attempt: -1, events: [], error: null })

  useEffect(() => {
    const controller = new AbortController()
    apiFetch('/api/events/', { signal: controller.signal })
      .then((data) => setResult({ attempt, events: Array.isArray(data) ? data : [], error: null }))
      .catch((err) => {
        if (err.name !== 'AbortError') setResult({ attempt, events: [], error: err.message })
      })
    return () => controller.abort()
  }, [attempt])

  const isLoading = result.attempt !== attempt
  const { events, error } = result
  const loadEvents = () => setAttempt((n) => n + 1)

  if (isLoading) {
    return (
      <LoadingOverlay label="Cargando tus eventos...">
        <EventsSkeleton />
      </LoadingOverlay>
    )
  }

  if (error) {
    return (
      <StatusMessage
        variant="error"
        icon={<IconAlertTriangle size={28} />}
        title="No pudimos cargar tus eventos"
        description={error}
      >
        <button type="button" className="btn-primary-action" onClick={loadEvents}>
          <IconRefresh size={16} />
          <span>Reintentar</span>
        </button>
      </StatusMessage>
    )
  }

  if (events.length === 0) {
    return (
      <StatusMessage
        icon={<IconCalendar size={28} />}
        title="Aún no tienes eventos"
        description="Crea tu primer evento para empezar a planear su logística."
      >
        <Link to="/crear" className="btn-primary-action">
          <IconPlus size={16} />
          <span>Crear evento</span>
        </Link>
      </StatusMessage>
    )
  }

  return (
    <section className="events-section" aria-label="Lista de eventos">
      <p className="section-subtitle">
        {events.length} {events.length === 1 ? 'evento registrado' : 'eventos registrados'}
      </p>

      <ul className="events-cards-grid plain-list">
        {events.map((ev) => (
          <li key={ev.id} className="event-card-item">
            <div className="event-card-top">
              <span className="event-status-badge">{getOptionLabel(EVENT_STATUSES, ev.status)}</span>
              <span className="event-date">
                <IconCalendar size={13} />
                <span>{formatDateFromISO(ev.event_date)}</span>
              </span>
            </div>

            <h2 className="event-name">{ev.name}</h2>
            <p className="event-client">{getOptionLabel(EVENT_TYPES, ev.event_type)}</p>

            <div className="event-details-list">
              <div className="event-detail-row">
                <IconUser size={14} />
                <span className="truncate">{ev.contact || 'Sin cliente registrado'}</span>
              </div>
              <div className="event-detail-row">
                <IconMapPin size={14} />
                <span className="truncate">{ev.location || 'Lugar por definir'}</span>
              </div>
            </div>

            <div className="event-card-footer">
              <span className="event-client">
                {ev.total_subtasks} {ev.total_subtasks === 1 ? 'gestión' : 'gestiones'}
              </span>
              <Link
                to={`/evento/${ev.id}`}
                className="btn-manage-event"
                aria-label={`Ver evento ${ev.name}`}
              >
                Ver evento
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
