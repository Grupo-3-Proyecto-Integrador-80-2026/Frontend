import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  IconAlertTriangle,
  IconCalendar,
  IconCheckCircle,
  IconClock,
  IconPlus,
  IconRefresh,
  IconX,
} from '../components/Icons'
import SortRuleHelp from '../components/SortRuleHelp'
import StatusMessage from '../components/StatusMessage'
import LoadingOverlay, { TodaySkeleton } from '../components/LoadingOverlay'
import { apiFetch } from '../api/client'
import { daysBetween, formatDateShort, getOptionLabel, TASK_STATUSES } from '../utils/validators'

// "Hecho" no aparece en Hoy (el backend excluye las gestiones terminadas)
const STATUS_FILTER_OPTIONS = TASK_STATUSES.filter((status) => status.value !== 'done')

// Jerarquía de urgencia: el orden de este arreglo es el orden en pantalla
const GROUPS = [
  {
    key: 'overdue',
    title: 'Vencidas',
    badge: 'Vencida',
    emptyText: 'No tienes gestiones vencidas.',
    Icon: IconAlertTriangle,
  },
  {
    key: 'due_today',
    title: 'Para hoy',
    badge: 'Para hoy',
    emptyText: 'No tienes gestiones para hoy.',
    Icon: IconClock,
  },
  {
    key: 'upcoming',
    title: 'Próximas',
    badge: null,
    emptyText: 'No tienes gestiones en los próximos días.',
    Icon: IconCalendar,
  },
]

const hoursFormatter = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 })

// Texto relativo a hoy: "hace 3 días", "mañana", "en 4 días"
function describeRelativeDate(groupKey, scheduledDate, today) {
  const diff = daysBetween(today, scheduledDate)
  if (groupKey === 'overdue') return diff === -1 ? 'ayer' : `hace ${-diff} días`
  if (groupKey === 'upcoming') return diff === 1 ? 'mañana' : `en ${diff} días`
  return null
}

function formatLongDate(isodate) {
  return new Date(`${isodate}T12:00:00`).toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function TodayCard({ task, group, today }) {
  const relative = describeRelativeDate(group.key, task.scheduled_date, today)
  const hours = hoursFormatter.format(Number(task.estimated_hours))

  return (
    <li className={`today-card today-card-${group.key}`}>
      <div className="today-card-top">
        <h3 className="today-card-title">{task.name}</h3>
        {group.badge && (
          <span className={`urgency-badge urgency-badge-${group.key}`}>{group.badge}</span>
        )}
      </div>

      <Link to={`/evento/${task.event_id}`} className="today-card-event">
        {task.event_name}
      </Link>

      <div className="today-card-meta">
        <span className="today-meta-item">
          <IconCalendar size={14} />
          <span>
            {formatDateShort(task.scheduled_date)}
            {relative && <span className="today-meta-relative"> · {relative}</span>}
          </span>
        </span>
        <span className="today-meta-item">
          <IconClock size={14} />
          <span>{hours} h estimadas</span>
        </span>
        <span className="task-status-chip">{getOptionLabel(TASK_STATUSES, task.status)}</span>
      </div>
    </li>
  )
}

function TodayGroup({ group, items, today, windowDays }) {
  const titleId = `today-group-${group.key}`
  const title = group.key === 'upcoming' ? `${group.title} (${windowDays} días)` : group.title

  return (
    <section className={`today-group today-group-${group.key}`} aria-labelledby={titleId}>
      <h2 id={titleId} className="today-group-title">
        <group.Icon size={18} />
        <span>{title}</span>
        <span className="today-group-count">
          {items.length}
          <span className="sr-only"> {items.length === 1 ? 'gestión' : 'gestiones'}</span>
        </span>
      </h2>

      {items.length === 0 ? (
        <p className="today-group-empty">{group.emptyText}</p>
      ) : (
        <ul className="today-card-list plain-list">
          {items.map((task) => (
            <TodayCard key={task.id} task={task} group={group} today={today} />
          ))}
        </ul>
      )}
    </section>
  )
}

export default function Today() {
  const [searchParams, setSearchParams] = useSearchParams()
  const eventFilter = searchParams.get('event') || ''
  const statusFilter = searchParams.get('status') || ''
  const hasFilters = Boolean(eventFilter || statusFilter)

  const [events, setEvents] = useState([])

  // Cada combinación de filtros + reintento es una petición distinta.
  // "Cargando" = la respuesta de la petición actual aún no ha llegado.
  const [attempt, setAttempt] = useState(0)
  const requestKey = `${eventFilter}|${statusFilter}|${attempt}`
  const [result, setResult] = useState({ key: null, data: null, error: null })

  useEffect(() => {
    // Si el usuario cambia de filtro antes de que termine, la petición vieja se cancela
    const controller = new AbortController()
    apiFetch('/api/today/', {
      params: { event: eventFilter, status: statusFilter },
      signal: controller.signal,
    })
      .then((data) => setResult({ key: requestKey, data, error: null }))
      .catch((err) => {
        if (err.name !== 'AbortError') setResult({ key: requestKey, data: null, error: err.message })
      })
    return () => controller.abort()
  }, [requestKey, eventFilter, statusFilter])

  const isLoading = result.key !== requestKey
  const { data, error } = result
  const loadToday = () => setAttempt((n) => n + 1)

  // Opciones del filtro por evento; si fallan, el filtro queda solo con "Todos"
  useEffect(() => {
    apiFetch('/api/events/')
      .then((result) => setEvents(Array.isArray(result) ? result : []))
      .catch(() => setEvents([]))
  }, [])

  const updateFilter = (name, value) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(name, value)
    else next.delete(name)
    setSearchParams(next, { replace: true })
  }

  const clearFilters = () => setSearchParams({}, { replace: true })

  const windowDays = data?.upcoming_window_days ?? 7
  const total = data
    ? GROUPS.reduce((sum, group) => sum + (data[group.key]?.length || 0), 0)
    : 0

  const renderGroups = () => (
    <div className="today-groups">
      {GROUPS.map((group) => (
        <TodayGroup
          key={group.key}
          group={group}
          items={data[group.key] || []}
          today={data.today}
          windowDays={windowDays}
        />
      ))}
    </div>
  )

  let content
  if (isLoading) {
    // Al cambiar un filtro se difuminan las gestiones que ya estaban en pantalla;
    // en la primera carga se difumina una silueta de la vista
    content = (
      <LoadingOverlay label="Cargando tus gestiones...">
        {total > 0 ? renderGroups() : <TodaySkeleton />}
      </LoadingOverlay>
    )
  } else if (error) {
    content = (
      <StatusMessage
        variant="error"
        icon={<IconAlertTriangle size={28} />}
        title="No pudimos cargar tus gestiones"
        description={error}
      >
        <button type="button" className="btn-primary-action" onClick={loadToday}>
          <IconRefresh size={16} />
          <span>Reintentar</span>
        </button>
      </StatusMessage>
    )
  } else if (total === 0 && hasFilters) {
    content = (
      <StatusMessage
        icon={<IconCalendar size={28} />}
        title="No hay gestiones que coincidan con los filtros"
      />
    )
  } else if (total === 0) {
    content = (
      <StatusMessage
        icon={<IconCheckCircle size={28} />}
        title="Hoy no tienes gestiones pendientes"
        description={`Aquí verás tus gestiones vencidas, las de hoy y las de los próximos ${windowDays} días.`}
      >
        <Link to="/crear" className="btn-primary-action">
          <IconPlus size={16} />
          <span>Crear evento</span>
        </Link>
      </StatusMessage>
    )
  } else {
    content = renderGroups()
  }

  return (
    <div className="today-page">
      <div className="today-toolbar">
        <div className="today-filters" role="group" aria-label="Filtrar gestiones">
          <div className="today-filter">
            <label htmlFor="filter-event" className="field-label">
              Evento
            </label>
            <select
              id="filter-event"
              className="field-input field-select"
              value={eventFilter}
              onChange={(e) => updateFilter('event', e.target.value)}
            >
              <option value="">Todos</option>
              {events.map((ev) => (
                <option key={ev.id} value={String(ev.id)}>
                  {ev.name}
                </option>
              ))}
            </select>
          </div>

          <div className="today-filter">
            <label htmlFor="filter-status" className="field-label">
              Estado
            </label>
            <select
              id="filter-status"
              className="field-input field-select"
              value={statusFilter}
              onChange={(e) => updateFilter('status', e.target.value)}
            >
              <option value="">Todos</option>
              {STATUS_FILTER_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          {hasFilters && (
            <button type="button" className="btn-sec-pro btn-clear-filters" onClick={clearFilters}>
              <IconX size={14} />
              <span>Limpiar filtros</span>
            </button>
          )}
        </div>

        <SortRuleHelp windowDays={windowDays} />
      </div>

      {data?.today && (
        <p className="today-date">
          Hoy es <strong>{formatLongDate(data.today)}</strong>
        </p>
      )}

      <div aria-busy={isLoading}>{content}</div>
    </div>
  )
}
