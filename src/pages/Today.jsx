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
  IconEdit,
  IconPause,
} from '../components/Icons'
import SortRuleHelp from '../components/SortRuleHelp'
import StatusMessage from '../components/StatusMessage'
import DateField from '../components/DateField'
import DateWarning from '../components/DateWarning'
import OverloadConflictModal from '../components/OverloadConflictModal'
import PostponeModal from '../components/PostponeModal'
import LoadingOverlay, { TodaySkeleton } from '../components/LoadingOverlay'
import { apiFetch, CONNECTION_ERROR_MESSAGE } from '../api/client'
import {
  daysBetween,
  formatDateFromISO,
  getOptionLabel,
  isAfterEventDate,
  todayISO,
  validateSubtaskField,
  validateSubtaskForm,
  TASK_TYPES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from '../utils/validators'
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

// Las pospuestas van aparte (US-09): no son carga urgente, pero siguen a la vista
const POSTPONED_GROUP = {
  key: 'postponed',
  title: 'Pospuestas',
  badge: null,
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
  return null
}

function formatLongDate(isodate) {
  const weekday = new Date(`${isodate}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long' })
  return `${weekday}, ${formatDateFromISO(isodate)}`
}

function buildSubtaskFormValues(task) {
  const hours = task.estimated_hours
  return {
    name: task.name || '',
    type: task.type || 'other',
    scheduled_date: task.scheduled_date || '',
    estimated_hours: hours != null && hours !== '' ? String(hours) : '',
    priority: task.priority || 'medium',
    note: task.note || '',
    status: task.status || 'pending',
  }
}

function TodayCard({
  task,
  group,
  today,
  eventDate,
  editEntry,
  onStartEdit,
  onCancelEdit,
  onChangeEdit,
  onBlurEdit,
  onSubmitEdit,
  onReschedule,
  onMarkDone,
  onRequestPostpone,
}) {
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

  // --- MODO EDICIÓN (FORMULARIO IDÉNTICO AL DEL DETALLE DE EVENTO) ---
  if (editEntry) {
    return (
      <li className="today-card" style={{ padding: '16px' }}>
        {/* Cabecera del formulario de edición */}
        <div
          className="event-card-top"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}
        >
          <span className="event-status-badge">Editando gestión</span>
          {editEntry.form.scheduled_date && (
            <span
              className="event-date"
              style={{ fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <IconCalendar size={14} />
              <span>{formatDateFromISO(editEntry.form.scheduled_date)}</span>
            </span>
          )}
        </div>

        {editEntry.feedback?.type === 'error' && (
          <div className="banner-alert banner-error" role="alert" style={{ marginBottom: '14px' }}>
            <IconAlertTriangle size={16} className="icon-rose" />
            <span style={{ fontSize: '12.5px' }}>{editEntry.feedback.message}</span>
          </div>
        )}

        <form onSubmit={(e) => onSubmitEdit(task, e)} noValidate>
          {/* 1. Nombre de la gestión */}
          <div className="field-group">
            <div className="field-label-row">
              <label htmlFor={`edit-today-${task.id}-name`} className="field-label">
                Nombre de la gestión <span className="req-star">*</span>
              </label>
              <span className="char-counter">{editEntry.form.name.length}/200</span>
            </div>
            <input
              id={`edit-today-${task.id}-name`}
              type="text"
              name="name"
              value={editEntry.form.name}
              onChange={(e) => onChangeEdit(task.id, task, e)}
              onBlur={(e) => onBlurEdit(task.id, task, e)}
              className={`field-input ${editEntry.touched.name && editEntry.errors.name ? 'field-input-error' : ''}`}
              placeholder="Ej: Confirmar asistentes"
              required
              maxLength={200}
              aria-invalid={editEntry.touched.name && !!editEntry.errors.name}
              aria-describedby={editEntry.touched.name && editEntry.errors.name ? `edit-today-${task.id}-name-error` : undefined}
            />
            {editEntry.touched.name && editEntry.errors.name && (
              <span id={`edit-today-${task.id}-name-error`} className="field-error-text">{editEntry.errors.name}</span>
            )}
          </div>

          {/* 2. Tipo de gestión */}
          <div className="field-group">
            <label htmlFor={`edit-today-${task.id}-type`} className="field-label">
              Tipo de gestión <span className="req-star">*</span>
            </label>
            <select
              id={`edit-today-${task.id}-type`}
              name="type"
              value={editEntry.form.type}
              onChange={(e) => onChangeEdit(task.id, task, e)}
              onBlur={(e) => onBlurEdit(task.id, task, e)}
              className={`field-input field-select ${editEntry.touched.type && editEntry.errors.type ? 'field-input-error' : ''}`}
              required
              aria-invalid={editEntry.touched.type && !!editEntry.errors.type}
              aria-describedby={editEntry.touched.type && editEntry.errors.type ? `edit-today-${task.id}-type-error` : undefined}
            >
              <option value="" disabled>Selecciona un tipo</option>
              {TASK_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {editEntry.touched.type && editEntry.errors.type && (
              <span id={`edit-today-${task.id}-type-error`} className="field-error-text">{editEntry.errors.type}</span>
            )}
          </div>

          {/* 3. Fecha objetivo */}
          <div className="field-group">
            <label htmlFor={`edit-today-${task.id}-date`} className="field-label">
              Fecha objetivo <span className="req-star">*</span>
            </label>
            <DateField
              id={`edit-today-${task.id}-date`}
              name="scheduled_date"
              value={editEntry.form.scheduled_date}
              min={task.scheduled_date < todayISO() ? task.scheduled_date : todayISO()}
              max={eventDate}
              onChange={(e) => onChangeEdit(task.id, task, e)}
              onBlur={(e) => onBlurEdit(task.id, task, e)}
              className={`field-input ${editEntry.touched.scheduled_date && editEntry.errors.scheduled_date ? 'field-input-error' : ''}`}
              required
              aria-invalid={editEntry.touched.scheduled_date && !!editEntry.errors.scheduled_date}
              aria-describedby={editEntry.touched.scheduled_date && editEntry.errors.scheduled_date ? `edit-today-${task.id}-scheduled_date-error` : undefined}
            />
            {editEntry.touched.scheduled_date && editEntry.errors.scheduled_date && (
              <span id={`edit-today-${task.id}-scheduled_date-error`} className="field-error-text">{editEntry.errors.scheduled_date}</span>
            )}
          </div>

          {/* 4. Horas estimadas */}
          <div className="field-group">
            <label htmlFor={`edit-today-${task.id}-hours`} className="field-label">
              Horas estimadas <span className="req-star">*</span>
            </label>
            <input
              id={`edit-today-${task.id}-hours`}
              type="number"
              name="estimated_hours"
              value={editEntry.form.estimated_hours}
              onChange={(e) => onChangeEdit(task.id, task, e)}
              onBlur={(e) => onBlurEdit(task.id, task, e)}
              placeholder="Ej: 1.0"
              min="0.1"
              step="0.1"
              className={`field-input ${editEntry.touched.estimated_hours && editEntry.errors.estimated_hours ? 'field-input-error' : ''}`}
              required
              aria-invalid={editEntry.touched.estimated_hours && !!editEntry.errors.estimated_hours}
              aria-describedby={editEntry.touched.estimated_hours && editEntry.errors.estimated_hours ? `edit-today-${task.id}-estimated_hours-error` : undefined}
            />
            {editEntry.touched.estimated_hours && editEntry.errors.estimated_hours && (
              <span id={`edit-today-${task.id}-estimated_hours-error`} className="field-error-text">{editEntry.errors.estimated_hours}</span>
            )}
          </div>

          {/* 5. Prioridad */}
          <div className="field-group">
            <label htmlFor={`edit-today-${task.id}-priority`} className="field-label">
              Prioridad
            </label>
            <select
              id={`edit-today-${task.id}-priority`}
              name="priority"
              value={editEntry.form.priority}
              onChange={(e) => onChangeEdit(task.id, task, e)}
              className="field-input field-select"
            >
              {TASK_PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* 6. Estado */}
          <div className="field-group">
            <label htmlFor={`edit-today-${task.id}-status`} className="field-label">
              Estado
            </label>
            <select
              id={`edit-today-${task.id}-status`}
              name="status"
              value={editEntry.form.status}
              onChange={(e) => onChangeEdit(task.id, task, e)}
              className="field-input field-select"
            >
              {TASK_STATUSES.map((st) => (
                <option key={st.value} value={st.value}>{st.label}</option>
              ))}
            </select>
          </div>

          {/* 7. Nota */}
          <div className="field-group">
            <label htmlFor={`edit-today-${task.id}-note`} className="field-label">
              Nota
            </label>
            <textarea
              id={`edit-today-${task.id}-note`}
              name="note"
              value={editEntry.form.note}
              onChange={(e) => onChangeEdit(task.id, task, e)}
              placeholder="Indicaciones adicionales para esta gestión..."
              rows="3"
              className="field-input field-textarea"
            />
          </div>

          {/* 8. Botones de acción */}
          <div className="form-actions-row" style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              className="btn-sec-pro"
              onClick={() => onCancelEdit(task.id)}
              disabled={editEntry.isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-submit-pro"
              disabled={editEntry.isSubmitting}
            >
              {editEntry.isSubmitting ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </li>
    )
  }

  // --- MODO VISTA DE TARJETA ---
  return (
    <li className={`today-card today-card-${group.key} ${afterEvent ? 'card-date-warning' : ''}`}>
      <div className="today-card-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h3 className="today-card-title">{task.name}</h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {group.badge && (
            <span className={`urgency-badge urgency-badge-${group.key}`}>{group.badge}</span>
          )}

          <button
            type="button"
            onClick={() => onStartEdit(task)}
            title="Editar gestión"
            aria-label={`Editar gestión ${task.name}`}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '4px',
              cursor: 'pointer',
              borderRadius: '6px',
              color: '#475569',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <IconEdit size={16} />
          </button>
        </div>
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
            min={today || todayISO()}
            max={eventDate || undefined}
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

function TodayGroup({
  group,
  items,
  description,
  today,
  windowDays,
  eventDateById,
  editingSubtasks,
  onStartEdit,
  onCancelEdit,
  onChangeEdit,
  onBlurEdit,
  onSubmitEdit,
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
              editEntry={editingSubtasks[task.id]}
              onStartEdit={onStartEdit}
              onCancelEdit={onCancelEdit}
              onChangeEdit={onChangeEdit}
              onBlurEdit={onBlurEdit}
              onSubmitEdit={onSubmitEdit}
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
        <div className="today-summary-stats">
          {GROUPS.map((group) => (
            <div key={group.key} className="info-row">
              <span className="info-key">
                {group.key === 'upcoming' ? `${group.title} (${windowDays} días)` : group.title}
              </span>
              <span className="info-val">{data[group.key]?.length || 0}</span>
            </div>
          ))}
          <div className="info-row">
            <span className="info-key">{POSTPONED_GROUP.title}</span>
            <span className="info-val">{data.postponed?.length || 0}</span>
          </div>
          <div className="info-row">
            <span className="info-key">Horas por atender</span>
            <span className="info-val">{hoursFormatter.format(pendingHours)} h</span>
          </div>
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
  // Un estado que no es filtro de Hoy (p. ej. ?status=done escrito a mano) se ignora
  const rawStatus = searchParams.get('status') || ''
  const statusFilter = STATUS_FILTER_OPTIONS.some((o) => o.value === rawStatus) ? rawStatus : ''
  const hasFilters = Boolean(eventFilter || statusFilter)

  const [events, setEvents] = useState([])
  const [attempt, setAttempt] = useState(0)
  const requestKey = `${eventFilter}|${statusFilter}|${userDailyLimit}|${attempt}`
  const [result, setResult] = useState({ key: null, data: null, error: null })

  const [editingSubtasks, setEditingSubtasks] = useState({})
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
    ? [...GROUPS, POSTPONED_GROUP].reduce((sum, group) => sum + (data[group.key]?.length || 0), 0)
    : 0

  const eventDateById = new Map(events.map((ev) => [ev.id, ev.event_date]))

  /**
   * Aviso de éxito con "Deshacer". `previousTask` es la gestión antes del cambio y
   * `updatedTask` la que devolvió la API; se restaura solo lo que cambió.
   * Si el cambio movió la gestión desde una fecha que ya pasó, no se ofrece
   * Deshacer: el backend no permite volver a programar en el pasado.
   */
  const showUndoToast = (previousTask, updatedTask, message) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), UNDO_TOAST_MS)

    const undoChanges = diffSubtask(snapshotSubtask(previousTask), updatedTask)
    const today = data?.today || todayISO()
    const movedFromPast = Boolean(undoChanges.scheduled_date && undoChanges.scheduled_date < today)
    const canUndo = Object.keys(undoChanges).length > 0 && !movedFromPast

    setToast({
      type: 'success',
      message,
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

  // --- CONTROL DE EDICIÓN EN HOY ---
  const handleStartEditSubtask = (task) => {
    setEditingSubtasks((prev) => ({
      ...prev,
      [task.id]: {
        form: buildSubtaskFormValues(task),
        errors: {},
        touched: {},
        isSubmitting: false,
        feedback: { type: null, message: '' },
      },
    }))
  }

  const handleCancelEditSubtask = (subtaskId) => {
    setEditingSubtasks((prev) => {
      const next = { ...prev }
      delete next[subtaskId]
      return next
    })
  }

  const editDateRange = (task) => ({
    eventDate: eventDateById.get(task.event_id),
    originalDate: task.scheduled_date,
  })

  const handleChangeSubtaskEdit = (subtaskId, task, e) => {
    const { name, value } = e.target
    setEditingSubtasks((prev) => {
      const entry = prev[subtaskId]
      if (!entry) return prev
      const nextEntry = { ...entry, form: { ...entry.form, [name]: value } }

      if (entry.touched[name] || entry.errors[name]) {
        nextEntry.errors = {
          ...entry.errors,
          [name]: validateSubtaskField(name, value, editDateRange(task)),
        }
      }
      return { ...prev, [subtaskId]: nextEntry }
    })
  }

  const handleBlurSubtaskEdit = (subtaskId, task, e) => {
    const { name, value } = e.target
    setEditingSubtasks((prev) => {
      const entry = prev[subtaskId]
      if (!entry) return prev
      return {
        ...prev,
        [subtaskId]: {
          ...entry,
          touched: { ...entry.touched, [name]: true },
          errors: {
            ...entry.errors,
            [name]: validateSubtaskField(name, value, editDateRange(task)),
          },
        },
      }
    })
  }

  const handleSubmitSubtaskEdit = async (task, e) => {
    e.preventDefault()
    const subtaskId = task.id
    const entry = editingSubtasks[subtaskId]
    if (!entry) return

    const allTouched = Object.keys(entry.form).reduce((acc, key) => {
      acc[key] = true
      return acc
    }, {})

    const formErrors = validateSubtaskForm(entry.form, editDateRange(task))
    const hasErrors = Object.keys(formErrors).length > 0

    setEditingSubtasks((prev) => {
      const current = prev[subtaskId]
      if (!current) return prev
      return {
        ...prev,
        [subtaskId]: {
          ...current,
          touched: allTouched,
          errors: formErrors,
          feedback: hasErrors
            ? {
                type: 'error',
                message: 'Por favor, corrige los errores en los campos requeridos antes de guardar.',
              }
            : { type: null, message: '' },
        },
      }
    })

    if (hasErrors) return

    setEditingSubtasks((prev) => ({
      ...prev,
      [subtaskId]: { ...prev[subtaskId], isSubmitting: true },
    }))

    const payload = {
      name: entry.form.name.trim(),
      type: entry.form.type,
      scheduled_date: entry.form.scheduled_date,
      estimated_hours: Number(entry.form.estimated_hours),
      priority: entry.form.priority,
      note: entry.form.note.trim(),
      status: entry.form.status,
    }

    try {
      const data = await apiFetch(`/api/subtasks/${subtaskId}/`, {
        method: 'PATCH',
        body: payload,
      })
      handleCancelEditSubtask(subtaskId)
      loadToday()
      showUndoToast(task, data, `¡Gestión "${data.name}" actualizada con éxito!`)
    } catch (err) {
      if (err.status === 409 && err.details) {
        // El modal resuelve fecha y horas; el resto de lo editado viaja con la resolución
        const pendingChanges = { ...payload }
        delete pendingChanges.scheduled_date
        delete pendingChanges.estimated_hours
        setConflictState({
          subtask: { ...task, ...entry.form, id: subtaskId },
          original: task,
          pendingChanges,
          conflictData: err.details,
          eventDate: eventDateById.get(task.event_id),
        })
      } else {
        setEditingSubtasks((prev) => ({
          ...prev,
          [subtaskId]: {
            ...prev[subtaskId],
            feedback: { type: 'error', message: err.message },
          },
        }))
      }
    } finally {
      setEditingSubtasks((prev) => {
        if (!prev[subtaskId]) return prev
        return {
          ...prev,
          [subtaskId]: { ...prev[subtaskId], isSubmitting: false },
        }
      })
    }
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
      showUndoToast(task, updated, `¡Gestión "${task.name}" completada!`)
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
    editingSubtasks,
    onStartEdit: handleStartEditSubtask,
    onCancelEdit: handleCancelEditSubtask,
    onChangeEdit: handleChangeSubtaskEdit,
    onBlurEdit: handleBlurSubtaskEdit,
    onSubmitEdit: handleSubmitSubtaskEdit,
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
        group={POSTPONED_GROUP}
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
        {data?.today && !error && (
          <TodaySummary data={data} events={events} windowDays={windowDays} />
        )}
        <div className="today-main-column" aria-busy={isLoading} style={{ width: '100%' }}>
          {content}
        </div>
      </div>

      {toast && (
        <div
          className={`banner-alert ${toast.type === 'error' ? 'banner-error' : 'banner-success'}`}
          role={toast.type === 'error' ? 'alert' : 'status'}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            maxWidth: 'min(440px, calc(100vw - 48px))',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          {toast.type === 'error' ? (
            <IconAlertTriangle size={18} className="icon-rose" />
          ) : (
            <IconCheckCircle size={18} className="icon-emerald" />
          )}
          <span>{toast.message}</span>
          {toast.undoChanges ? (
            <button
              type="button"
              className="btn-sec-pro btn-small"
              onClick={handleUndo}
              style={{ marginLeft: '8px' }}
            >
              Deshacer
            </button>
          ) : (
            <button
              type="button"
              className="btn-sec-pro btn-small"
              onClick={closeToast}
              aria-label="Cerrar mensaje"
              style={{ marginLeft: '8px' }}
            >
              <IconX size={14} />
            </button>
          )}
        </div>
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
            handleCancelEditSubtask(original.id)
            loadToday()
            showUndoToast(original, updatedTask, message)
          }}
          onCancel={() => setConflictState(null)}
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

