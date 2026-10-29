import { useEffect, useState, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  IconAlertTriangle,
  IconCalendar,
  IconCheckCircle,
  IconClock,
  IconFilter,
  IconPlus,
  IconRefresh,
  IconX,
  IconEdit,
  IconPause,
} from '../components/Icons'
import SortRuleHelp from '../components/SortRuleHelp'
import StatusMessage from '../components/StatusMessage'
import DateWarning from '../components/DateWarning'
import OverloadConflictModal from '../components/OverloadConflictModal'
import PostponeModal from '../components/PostponeModal'
import ProgressBar from '../components/ProgressBar'
import RescheduleButton from '../components/RescheduleButton'
import SubtaskEditModal from '../components/SubtaskEditModal'
import LoadingOverlay, { TodaySkeleton } from '../components/LoadingOverlay'
import { apiFetch, CONNECTION_ERROR_MESSAGE } from '../api/client'
import {
  daysBetween,
  formatDateFromISO,
  getOptionLabel,
  isAfterEventDate,
  todayISO,
  TASK_STATUSES,
} from '../utils/validators'
import { countByStatus, getDayOverload, overloadedDays } from '../utils/workload'
import { useAuth } from '../auth/AuthContext'

// Las hechas no aparecen en Hoy y las pospuestas ya tienen su propia columna:
// el filtro de estado solo distingue Pendiente y En progreso
const STATUS_FILTER_OPTIONS = TASK_STATUSES.filter(
  (status) => status.value !== 'done' && status.value !== 'postponed'
)

const GROUPS = [
  {
    key: 'overdue',
    title: 'Vencidas',
    emptyText: 'No tienes gestiones vencidas.',
    Icon: IconAlertTriangle,
  },
  {
    key: 'due_today',
    title: 'Para hoy',
    emptyText: 'No tienes gestiones para hoy.',
    Icon: IconClock,
  },
  {
    key: 'upcoming',
    title: 'Próximas',
    emptyText: 'No tienes gestiones en los próximos días.',
    Icon: IconCalendar,
  },
]

// Las pospuestas van aparte (US-09): no son carga urgente, pero siguen a la vista
const POSTPONED_GROUP = {
  key: 'postponed',
  title: 'Pospuestas',
  emptyText: 'No tienes gestiones pospuestas.',
  Icon: IconPause,
}

// Campos que "Deshacer" puede restaurar tras una acción en Hoy
const UNDO_FIELDS = ['name', 'type', 'scheduled_date', 'estimated_hours', 'priority', 'note', 'status']

// Tiempo que se muestra el aviso con "Deshacer" (suficiente para llegar con teclado)
const UNDO_TOAST_MS = 10000

/** Copia de los campos editables de una gestión, para poder restaurarla. */
function snapshotSubtask(task) {
  return UNDO_FIELDS.reduce((acc, field) => {
    acc[field] = task?.[field]
    return acc
  }, {})
}

/** Campos de `previous` que cambiaron respecto a `current` (las horas se comparan como número). */
function diffSubtask(previous, current) {
  return UNDO_FIELDS.reduce((acc, field) => {
    const before = previous[field]
    const after = current?.[field]
    const changed =
      field === 'estimated_hours' ? Number(before) !== Number(after) : (before ?? '') !== (after ?? '')
    if (changed && before !== undefined) acc[field] = before
    return acc
  }, {})
}

const hoursFormatter = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 })

function describeRelativeDate(groupKey, scheduledDate, today) {
  const diff = daysBetween(today, scheduledDate)
  if (groupKey === 'overdue') return diff === -1 ? 'ayer' : `hace ${-diff} días`
  if (groupKey === 'upcoming') return diff === 1 ? 'mañana' : `en ${diff} días`
  if (groupKey === 'due_today') return 'hoy'
  return null
}

function formatLongDate(isodate) {
  const weekday = new Date(`${isodate}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long' })
  return `${weekday}, ${formatDateFromISO(isodate)}`
}

function TodayCard({
  task,
  group,
  today,
  eventDate,
  overloadHours,
  dailyLimit,
  onStartEdit,
  onReschedule,
  onMarkDone,
  onRequestPostpone,
}) {
  const relative = describeRelativeDate(group.key, task.scheduled_date, today)
  const hours = hoursFormatter.format(Number(task.estimated_hours))
  const afterEvent = isAfterEventDate(task, eventDate)

  return (
    <li className={`today-card today-card-${group.key} ${afterEvent ? 'card-date-warning' : ''}`}>
      {/* La urgencia la indican la columna y su color: la tarjeta no repite la etiqueta */}
      <div className="today-card-top">
        <h3 className="today-card-title">{task.name}</h3>

        <button
          type="button"
          className="today-card-edit"
          onClick={() => onStartEdit(task)}
          title="Editar gestión"
          aria-label={`Editar gestión ${task.name}`}
        >
          <IconEdit size={16} />
        </button>
      </div>

      <Link to={`/evento/${task.event_id}`} className="today-card-event">
        {task.event_name}
      </Link>

      <div className="today-card-meta">
        <span className="today-meta-item">
          <IconCalendar size={14} />
          <span>
            {formatDateFromISO(task.scheduled_date)}
            {relative && <span className="today-meta-relative"> · {relative}</span>}
          </span>
        </span>

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

      {overloadHours !== null && (
        <p className="task-overload-warning" role="note">
          <IconAlertTriangle size={16} />
          <span>
            Jornada sobrecargada: {hoursFormatter.format(overloadHours)} h de{' '}
            {hoursFormatter.format(dailyLimit)} h
          </span>
        </p>
      )}

      <div className="task-card-actions">
        <button
          type="button"
          className="btn-submit-pro btn-small"
          onClick={() => onMarkDone(task)}
          title="Marcar gestión como hecha"
          aria-label={`Marcar gestión ${task.name} como hecha`}
        >
          <IconCheckCircle size={14} />
          Hecha
        </button>

        <RescheduleButton
          task={task}
          min={today || todayISO()}
          max={eventDate}
          onChange={(newDate) => onReschedule(task, newDate)}
        />

        {task.status !== 'postponed' && (
          <button
            type="button"
            className="btn-sec-pro btn-small"
            onClick={() => onRequestPostpone(task)}
            title="Posponer gestión con nota explicativa"
            aria-label={`Posponer gestión ${task.name}`}
          >
            Posponer
          </button>
        )}
      </div>
    </li>
  )
}

function TodayGroup({
  group,
  items,
  description,
  today,
  windowDays,
  eventDateById,
  overloadByDate,
  dailyLimit,
  onStartEdit,
  onReschedule,
  onMarkDone,
  onRequestPostpone,
}) {
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

      {description && <p className="today-group-desc">{description}</p>}

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
              overloadHours={getDayOverload(overloadByDate, task)}
              dailyLimit={dailyLimit}
              onStartEdit={onStartEdit}
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

// Cuántos días faltan para un evento, en palabras cortas
function describeDaysUntil(today, eventDate) {
  const days = daysBetween(today, eventDate)
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Mañana'
  return `En ${days} días`
}

function TodaySummary({ data, events, dailyLimit, filteredEvent }) {
  const pendingHours = [...(data.overdue || []), ...(data.due_today || [])].reduce(
    (sum, task) => sum + Number(task.estimated_hours),
    0,
  )
  const overLimit = pendingHours > dailyLimit
  const loadPercent = dailyLimit > 0 ? Math.min(100, (pendingHours / dailyLimit) * 100) : 0

  const nextEvents = events
    .filter((ev) => ev.event_date >= data.today)
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
    .slice(0, 3)

  const filteredBreakdown = filteredEvent ? countByStatus(filteredEvent.subtasks) : null
  const filteredProgress = filteredEvent?.progress || { total: 0, executed: 0, percentage: 0 }

  return (
    <aside className="today-aside" aria-label="Resumen">
      <section className="card-pro today-summary-card">
        <div className="card-pro-header">
          <h3>Resumen</h3>
        </div>

        {/* El contenido se centra en vertical cuando la tarjeta vecina es más alta */}
        <div className="today-summary-body">
          {/* Un indicador por columna, con el mismo color e ícono que su grupo */}
          <ul className="today-stats plain-list">
            {[...GROUPS, POSTPONED_GROUP].map((group) => (
              <li key={group.key} className={`today-stat today-stat-${group.key}`}>
                <span className="today-stat-top">
                  <span className="today-stat-value">{data[group.key]?.length || 0}</span>
                  <group.Icon size={18} className="today-stat-icon" />
                </span>
                <span className="today-stat-label">{group.title}</span>
              </li>
            ))}
          </ul>

          {/* Carga de vencidas + hoy frente al límite diario */}
          <div className={`today-load ${overLimit ? 'today-load-over' : ''}`}>
            <div className="today-load-text">
              <span>Horas por atender</span>
              <strong>
                {hoursFormatter.format(pendingHours)} h
                <span className="today-load-limit"> de {dailyLimit} h/día</span>
              </strong>
            </div>
            <div className="today-load-bar" aria-hidden="true">
              <span style={{ width: `${loadPercent}%` }} />
            </div>
            {overLimit && (
              <p className="today-load-warning">
                Superas tu límite diario: reprograma o pospone algunas gestiones.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="card-pro today-events-card">
        <div className="card-pro-header">
          <h3>Próximos eventos</h3>
        </div>
        {nextEvents.length === 0 ? (
          <p className="endpoint-hint">No hay eventos próximos.</p>
        ) : (
          <ul className="today-next-events plain-list">
            {nextEvents.map((ev) => (
              <li key={ev.id} className="today-next-event">
                <span className="today-next-event-date" aria-hidden="true">
                  <IconCalendar size={16} />
                </span>
                <span className="today-next-event-info">
                  <Link to={`/evento/${ev.id}`} className="today-card-event truncate">
                    {ev.name}
                  </Link>
                  <span className="today-next-event-meta">{formatDateFromISO(ev.event_date)}</span>
                </span>
                <span className="today-next-event-days">{describeDaysUntil(data.today, ev.event_date)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {filteredEvent && (
        <section className="card-pro today-progress-card">
          <div className="card-pro-header">
            <h3>Progreso de preparación</h3>
          </div>
          <p className="today-progress-event">{filteredEvent.name}</p>
          <ProgressBar
            executed={filteredProgress.executed}
            total={filteredProgress.total}
            percentage={filteredProgress.percentage}
            pending={filteredBreakdown.pending}
            postponed={filteredBreakdown.postponed}
          />
        </section>
      )}
    </aside>
  )
}

export default function Today() {
  const { user } = useAuth()
  const userDailyLimit = user?.daily_hours_limit ?? 6

  const [searchParams, setSearchParams] = useSearchParams()
  const eventFilter = searchParams.get('event') || ''
  // Un estado que no es filtro de Hoy (p. ej. ?status=done escrito a mano) se ignora
  const rawStatus = searchParams.get('status') || ''
  const statusFilter = STATUS_FILTER_OPTIONS.some((o) => o.value === rawStatus) ? rawStatus : ''
  const hasFilters = Boolean(eventFilter || statusFilter)

  const [events, setEvents] = useState([])
  const [attempt, setAttempt] = useState(0)
  const requestKey = `${eventFilter}|${statusFilter}|${userDailyLimit}|${attempt}`
  const [result, setResult] = useState({ key: null, data: null, error: null })

  const [editingTask, setEditingTask] = useState(null)
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
    const controller = new AbortController()
    apiFetch('/api/events/', { signal: controller.signal })
      .then((res) => setEvents(Array.isArray(res) ? res : []))
      .catch((err) => {
        if (err.name === 'AbortError') return
        // Se conserva la lista anterior: la vista sigue mostrando el último
        // progreso y las advertencias conocidas si el refresco falla.
      })
    return () => controller.abort()
  }, [attempt])

  const updateFilter = (name, value) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(name, value)
    else next.delete(name)
    setSearchParams(next, { replace: true })
  }

  const clearFilters = () => setSearchParams({}, { replace: true })

  const windowDays = data?.upcoming_window_days ?? 7
  const total = data
    ? [...GROUPS, POSTPONED_GROUP].reduce((sum, group) => sum + (data[group.key]?.length || 0), 0)
    : 0

  const eventDateById = new Map(events.map((ev) => [ev.id, ev.event_date]))
  const overloadByDate = overloadedDays(events, userDailyLimit, data?.today || todayISO())
  const filteredEvent = eventFilter
    ? events.find((ev) => String(ev.id) === eventFilter) || null
    : null

  /**
   * Aviso de éxito con "Deshacer". `previousTask` es la gestión antes del cambio y
   * `updatedTask` la que devolvió la API; se restaura solo lo que cambió.
   * Si el cambio movió la gestión desde una fecha que ya pasó, no se ofrece
   * Deshacer: el backend no permite volver a programar en el pasado.
   */
  const showUndoToast = (previousTask, updatedTask, message, extra = {}) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), UNDO_TOAST_MS)

    const undoChanges = diffSubtask(snapshotSubtask(previousTask), updatedTask)
    const today = data?.today || todayISO()
    const movedFromPast = Boolean(undoChanges.scheduled_date && undoChanges.scheduled_date < today)
    const canUndo = Object.keys(undoChanges).length > 0 && !movedFromPast

    setToast({
      type: 'success',
      message,
      link: extra.link || null,
      subtaskId: previousTask.id,
      undoChanges: canUndo ? undoChanges : null,
    })
  }

  // Errores de las acciones rápidas: en la página, nunca en un alert() del navegador
  const showErrorToast = (action, err) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 8000)
    setToast({ type: 'error', message: `${action}. ${err.message || CONNECTION_ERROR_MESSAGE}` })
  }

  const closeToast = () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(null)
  }

  const handleUndo = async () => {
    if (!toast?.undoChanges) return
    const { subtaskId, undoChanges } = toast
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(null)

    // Sin confirm_overload: si restaurar deja un día sobre el límite, el backend
    // responde 409 y se avisa en lugar de sobrecargar el día en silencio
    try {
      await apiFetch(`/api/subtasks/${subtaskId}/`, { method: 'PATCH', body: undoChanges })
      loadToday()
    } catch (err) {
      showErrorToast('No pudimos deshacer el cambio', err)
    }
  }

  // --- EDICIÓN EN MODAL ---
  const handleStartEditSubtask = (task) => setEditingTask({ task })

  const handleSavedSubtask = (task, updatedTask) => {
    setEditingTask(null)
    loadToday()
    showUndoToast(task, updatedTask, `¡Gestión "${updatedTask.name}" actualizada con éxito!`)
  }

  const handleEditConflict = ({ task, form, pendingChanges, conflictData }) => {
    setEditingTask(null)
    setConflictState({
      subtask: { ...task, ...form, id: task.id },
      original: task,
      pendingChanges,
      conflictData,
      eventDate: eventDateById.get(task.event_id),
      initialForm: form,
    })
  }

  const handleReschedule = async (task, newDate) => {
    if (!newDate || newDate === task.scheduled_date) return

    try {
      const updated = await apiFetch(`/api/subtasks/${task.id}/`, {
        method: 'PATCH',
        body: { scheduled_date: newDate },
      })
      loadToday()
      showUndoToast(task, updated, `Gestión reprogramada al ${formatDateFromISO(newDate)}`)
    } catch (err) {
      if (err.status === 409 && err.details) {
        setConflictState({
          subtask: task,
          original: task,
          conflictData: err.details,
          eventDate: eventDateById.get(task.event_id),
        })
      } else {
        showErrorToast(`No pudimos reprogramar "${task.name}"`, err)
      }
    }
  }

  const handleMarkDone = async (task) => {
    try {
      const updated = await apiFetch(`/api/subtasks/${task.id}/`, {
        method: 'PATCH',
        body: { status: 'done' },
      })
      loadToday()
      showUndoToast(task, updated, `¡Gestión "${task.name}" completada!`, {
        link: { to: '/progreso', label: 'Ver progreso' },
      })
    } catch (err) {
      showErrorToast(`No pudimos marcar "${task.name}" como hecha`, err)
    }
  }

  const handleConfirmPostpone = async (task, note) => {
    // Si falla, el error sube al modal de posponer, que lo muestra junto al formulario
    const updated = await apiFetch(`/api/subtasks/${task.id}/`, {
      method: 'PATCH',
      body: { status: 'postponed', note },
    })
    setPostponeState(null)
    loadToday()
    showUndoToast(task, updated, `Gestión "${task.name}" pospuesta.`)
  }

  const groupProps = {
    eventDateById,
    today: data?.today,
    windowDays,
    overloadByDate,
    dailyLimit: userDailyLimit,
    onStartEdit: handleStartEditSubtask,
    onReschedule: handleReschedule,
    onMarkDone: handleMarkDone,
    onRequestPostpone: (task) => setPostponeState(task),
  }

  const postponedItems = data?.postponed || []

  // Pospuestas es la cuarta columna: siempre visible, así la cuadrícula no cambia de forma
  const renderGroups = () => (
    <div className="today-groups">
      {GROUPS.map((group) => (
        <TodayGroup key={group.key} group={group} items={data[group.key] || []} {...groupProps} />
      ))}
      <TodayGroup
        group={
          // Con un filtro de estado activo la lista llega vacía: se explica en vez de decir "no tienes"
          statusFilter
            ? { ...POSTPONED_GROUP, emptyText: 'El filtro de estado no incluye las pospuestas.' }
            : POSTPONED_GROUP
        }
        items={postponedItems}
        description="No suman horas a tu día. Edítalas para retomarlas."
        {...groupProps}
      />
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
        <div className="today-filters-block">
          <h2 id="today-filters-title" className="today-filters-title">
            <IconFilter size={16} />
            <span>Filtrar gestiones</span>
          </h2>
          <div className="today-filters" role="group" aria-labelledby="today-filters-title">
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
        </div>

        <SortRuleHelp windowDays={windowDays} />
      </div>

      {data?.today && (
        <p className="today-date">
          Hoy es <strong>{formatLongDate(data.today)}</strong>
        </p>
      )}

      <div className="today-layout">
        {data?.today && !error && (
          <TodaySummary
            data={data}
            events={events}
            dailyLimit={userDailyLimit}
            filteredEvent={filteredEvent}
          />
        )}
        <div className="today-main-column" aria-busy={isLoading} style={{ width: '100%' }}>
          {content}
        </div>
      </div>

      {toast && (
        <div
          className={`banner-alert today-toast ${toast.type === 'error' ? 'banner-error' : 'banner-success'}`}
          role={toast.type === 'error' ? 'alert' : 'status'}
        >
          {toast.type === 'error' ? (
            <IconAlertTriangle size={18} className="icon-rose" />
          ) : (
            <IconCheckCircle size={18} className="icon-emerald" />
          )}
          <span className="today-toast-message">{toast.message}</span>
          <div className="today-toast-actions">
            {toast.link && (
              <Link to={toast.link.to} className="btn-sec-pro btn-small" onClick={closeToast}>
                {toast.link.label}
              </Link>
            )}
            {toast.undoChanges ? (
              <button type="button" className="btn-sec-pro btn-small" onClick={handleUndo}>
                Deshacer
              </button>
            ) : (
              <button
                type="button"
                className="btn-sec-pro btn-small"
                onClick={closeToast}
                aria-label="Cerrar mensaje"
              >
                <IconX size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {editingTask && (
        <SubtaskEditModal
          key={editingTask.task.id}
          task={editingTask.task}
          eventDate={eventDateById.get(editingTask.task.event_id)}
          initialForm={editingTask.initialForm}
          onSaved={(updatedTask) => handleSavedSubtask(editingTask.task, updatedTask)}
          onConflict={handleEditConflict}
          onCancel={() => setEditingTask(null)}
        />
      )}

      {conflictState && (
        <OverloadConflictModal
          conflictData={conflictState?.conflictData}
          subtask={conflictState?.subtask}
          eventDate={conflictState?.eventDate}
          pendingChanges={conflictState.pendingChanges}
          savedHours={conflictState.original.estimated_hours}
          onResolved={(updatedTask, message) => {
            // La "foto previa" es la gestión guardada, no el formulario con la fecha nueva
            const original = conflictState.original
            setConflictState(null)
            setEditingTask(null)
            loadToday()
            showUndoToast(original, updatedTask, message)
          }}
          onCancel={() => {
            const pendingEdit = conflictState.initialForm
              ? { task: conflictState.original, initialForm: conflictState.initialForm }
              : null
            setConflictState(null)
            if (pendingEdit) setEditingTask(pendingEdit)
          }}
        />
      )}

      {postponeState && (
        <PostponeModal
          subtask={postponeState}
          onConfirm={handleConfirmPostpone}
          onCancel={() => setPostponeState(null)}
        />
      )}
    </div>
  )
}

