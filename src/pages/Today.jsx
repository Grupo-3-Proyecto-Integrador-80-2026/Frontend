import { useEffect, useState, useRef } from 'react'
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
import DateWarning from '../components/DateWarning'
import OverloadConflictModal from '../components/OverloadConflictModal'
import PostponeModal from '../components/PostponeModal'
import LoadingOverlay, { TodaySkeleton } from '../components/LoadingOverlay'
import { apiFetch } from '../api/client'
import { daysBetween, formatDateFromISO, getOptionLabel, isAfterEventDate, TASK_STATUSES } from '../utils/validators'
import { useAuth } from '../auth/AuthContext'

const STATUS_FILTER_OPTIONS = TASK_STATUSES.filter((status) => status.value !== 'done')

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

function describeRelativeDate(groupKey, scheduledDate, today) {
  const diff = daysBetween(today, scheduledDate)
  if (groupKey === 'overdue') return diff === -1 ? 'ayer' : `hace ${-diff} días`
  if (groupKey === 'upcoming') return diff === 1 ? 'mañana' : `en ${diff} días`
  return null
}

function formatLongDate(isodate) {
  const weekday = new Date(`${isodate}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long' })
  return `${weekday}, ${formatDateFromISO(isodate)}`
}

function TodayCard({ task, group, today, eventDate, onReschedule, onMarkDone, onRequestPostpone }) {
  const relative = describeRelativeDate(group.key, task.scheduled_date, today)
  const hours = hoursFormatter.format(Number(task.estimated_hours))
  const afterEvent = isAfterEventDate(task, eventDate)
  const dateInputRef = useRef(null)

  const triggerPicker = () => {
    if (!dateInputRef.current) return
    try {
      dateInputRef.current.showPicker()
    } catch {
      dateInputRef.current.focus()
      dateInputRef.current.click()
    }
  }

  return (
    <li className={`today-card today-card-${group.key} ${afterEvent ? 'card-date-warning' : ''}`}>
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
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <button
            type="button"
            className="today-meta-item"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              font: 'inherit',
              cursor: 'pointer',
              color: 'inherit',
            }}
            onClick={triggerPicker}
            title="Haz clic para reprogramar fecha"
            aria-label={`Fecha actual: ${formatDateFromISO(task.scheduled_date)}. Haz clic para cambiarla`}
          >
            <IconCalendar size={14} />
            <span>
              {formatDateFromISO(task.scheduled_date)}
              {relative && <span className="today-meta-relative"> · {relative}</span>}
            </span>
          </button>
          <input
            ref={dateInputRef}
            type="date"
            value={task.scheduled_date}
            onChange={(e) => onReschedule(task, e.target.value)}
            style={{
              position: 'absolute',
              opacity: 0,
              pointerEvents: 'none',
              width: '1px',
              height: '1px',
              bottom: 0,
              left: 0,
            }}
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>

        <span className="today-meta-item">
          <IconClock size={14} />
          <span>{hours} h estimadas</span>
        </span>
        <span className="task-status-chip">{getOptionLabel(TASK_STATUSES, task.status)}</span>
      </div>

      {task.note && (
        <p className="field-hint" style={{ marginTop: '8px', fontStyle: 'italic', color: '#64748b' }}>
          <strong>Nota:</strong> {task.note}
        </p>
      )}

      {afterEvent && <DateWarning eventDate={eventDate} />}

      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <button
          type="button"
          className="btn-submit-pro btn-small"
          style={{ padding: '4px 10px', fontSize: '12px' }}
          onClick={() => onMarkDone(task)}
          title="Marcar como hecha"
        >
          <IconCheckCircle size={14} style={{ marginRight: '4px' }} />
          Hecha
        </button>

        {task.status !== 'postponed' && (
          <button
            type="button"
            className="btn-sec-pro btn-small"
            style={{ padding: '4px 10px', fontSize: '12px' }}
            onClick={() => onRequestPostpone(task)}
            title="Posponer gestión con nota explicativa"
          >
            Posponer
          </button>
        )}
      </div>
    </li>
  )
}

function TodayGroup({ group, items, today, windowDays, eventDateById, onReschedule, onMarkDone, onRequestPostpone }) {
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
            <TodayCard
              key={task.id}
              task={task}
              group={group}
              today={today}
              eventDate={eventDateById.get(task.event_id)}
              onReschedule={onReschedule}
              onMarkDone={onMarkDone}
              onRequestPostpone={onRequestPostpone}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function TodaySummary({ data, events, windowDays }) {
  const pendingHours = [...(data.overdue || []), ...(data.due_today || [])].reduce(
    (sum, task) => sum + Number(task.estimated_hours),
    0,
  )

  const nextEvents = events
    .filter((ev) => ev.event_date >= data.today)
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
    .slice(0, 3)

  return (
    <aside className="today-aside" aria-label="Resumen">
      <section className="card-pro">
        <div className="card-pro-header">
          <h3>Resumen</h3>
        </div>
        {GROUPS.map((group) => (
          <div key={group.key} className="info-row">
            <span className="info-key">
              {group.key === 'upcoming' ? `${group.title} (${windowDays} días)` : group.title}
            </span>
            <span className="info-val">{data[group.key]?.length || 0}</span>
          </div>
        ))}
        <div className="info-row">
          <span className="info-key">Horas por atender</span>
          <span className="info-val">{hoursFormatter.format(pendingHours)} h</span>
        </div>
      </section>

      <section className="card-pro">
        <div className="card-pro-header">
          <h3>Próximos eventos</h3>
        </div>
        {nextEvents.length === 0 ? (
          <p className="endpoint-hint">No hay eventos próximos.</p>
        ) : (
          <ul className="plain-list">
            {nextEvents.map((ev) => (
              <li key={ev.id} className="info-row">
                <Link to={`/evento/${ev.id}`} className="today-card-event truncate">
                  {ev.name}
                </Link>
                <span className="info-val">{formatDateFromISO(ev.event_date)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  )
}

export default function Today() {
  const { user } = useAuth()
  const userDailyLimit = user?.daily_hours_limit ?? 6

  const [searchParams, setSearchParams] = useSearchParams()
  const eventFilter = searchParams.get('event') || ''
  const statusFilter = searchParams.get('status') || ''
  const hasFilters = Boolean(eventFilter || statusFilter)

  const [events, setEvents] = useState([])
  const [attempt, setAttempt] = useState(0)
  const requestKey = `${eventFilter}|${statusFilter}|${userDailyLimit}|${attempt}`
  const [result, setResult] = useState({ key: null, data: null, error: null })

  const [conflictState, setConflictState] = useState(null)
  const [postponeState, setPostponeState] = useState(null)
  const [toast, setToast] = useState(null)
  const toastTimerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  useEffect(() => {
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

  useEffect(() => {
    apiFetch('/api/events/')
      .then((res) => setEvents(Array.isArray(res) ? res : []))
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

  const eventDateById = new Map(events.map((ev) => [ev.id, ev.event_date]))

  const showUndoToast = (subtask, previousState, message) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 6000)
    setToast({ message, subtask, previousState })
  }

  const handleUndo = async () => {
    if (!toast) return
    const { subtask, previousState } = toast
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(null)

    try {
      await apiFetch(`/api/subtasks/${subtask.id}/`, {
        method: 'PATCH',
        body: {
          scheduled_date: previousState.scheduled_date,
          status: previousState.status,
          note: previousState.note,
          confirm_overload: true,
        },
      })
      loadToday()
    } catch (err) {
      alert(err.message || 'No se pudo deshacer la acción.')
    }
  }

  const handleReschedule = async (task, newDate) => {
    const previousDate = task.scheduled_date
    if (newDate === previousDate) return

    const previousSnapshot = {
      scheduled_date: task.scheduled_date,
      status: task.status,
      note: task.note,
    }

    try {
      await apiFetch(`/api/subtasks/${task.id}/`, {
        method: 'PATCH',
        body: { scheduled_date: newDate },
      })
      loadToday()
      showUndoToast(task, previousSnapshot, `Gestión reprogramada al ${formatDateFromISO(newDate)}`)
    } catch (err) {
      if (err.status === 409 && err.details) {
        setConflictState({
          subtask: task,
          conflictData: err.details,
          eventDate: eventDateById.get(task.event_id),
        })
      } else {
        alert(err.message || 'No pudimos reprogramar la gestión.')
      }
    }
  }

  const handleMarkDone = async (task) => {
    const previousSnapshot = {
      scheduled_date: task.scheduled_date,
      status: task.status,
      note: task.note,
    }

    try {
      await apiFetch(`/api/subtasks/${task.id}/`, {
        method: 'PATCH',
        body: { status: 'done' },
      })
      loadToday()
      showUndoToast(task, previousSnapshot, `¡Gestión "${task.name}" completada!`)
    } catch (err) {
      alert(err.message || 'No se pudo marcar la gestión como completada.')
    }
  }

  const handleConfirmPostpone = async (task, note) => {
    const previousSnapshot = {
      scheduled_date: task.scheduled_date,
      status: task.status,
      note: task.note,
    }

    try {
      await apiFetch(`/api/subtasks/${task.id}/`, {
        method: 'PATCH',
        body: { status: 'postponed', note },
      })
      setPostponeState(null)
      loadToday()
      showUndoToast(task, previousSnapshot, `Gestión "${task.name}" pospuesta.`)
    } catch (err) {
      alert(err.message || 'No se pudo posponer la gestión.')
    }
  }

  const renderGroups = () => (
    <div className="today-groups">
      {GROUPS.map((group) => (
        <TodayGroup
          key={group.key}
          group={group}
          items={data[group.key] || []}
          eventDateById={eventDateById}
          today={data.today}
          windowDays={windowDays}
          onReschedule={handleReschedule}
          onMarkDone={handleMarkDone}
          onRequestPostpone={(task) => setPostponeState(task)}
        />
      ))}
    </div>
  )

  let content
  if (isLoading) {
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

      <div className="today-layout">
        <div className="today-main-column" aria-busy={isLoading} style={{ width: '100%' }}>
          {content}
        </div>
        {data?.today && !error && (
          <TodaySummary data={data} events={events} windowDays={windowDays} />
        )}
      </div>

      {toast && (
        <div
          className="banner-alert banner-success"
          role="status"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          <IconCheckCircle size={18} className="icon-emerald" />
          <span>{toast.message}</span>
          <button
            type="button"
            className="btn-sec-pro btn-small"
            onClick={handleUndo}
            style={{ marginLeft: '8px' }}
          >
            Deshacer
          </button>
        </div>
      )}

      <OverloadConflictModal
        isOpen={Boolean(conflictState)}
        conflictData={conflictState?.conflictData}
        subtask={conflictState?.subtask}
        eventDate={conflictState?.eventDate}
        onResolved={(updatedTask, message) => {
          const prev = conflictState?.subtask
          setConflictState(null)
          loadToday()
          showUndoToast(
            updatedTask,
            { scheduled_date: prev?.scheduled_date, status: prev?.status, note: prev?.note },
            message
          )
        }}
        onCancel={() => setConflictState(null)}
      />

      <PostponeModal
        isOpen={Boolean(postponeState)}
        subtask={postponeState}
        onConfirm={handleConfirmPostpone}
        onCancel={() => setPostponeState(null)}
      />
    </div>
  )
}