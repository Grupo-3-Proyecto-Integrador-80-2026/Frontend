import { useId, useRef, useState } from 'react'
import { IconAlertTriangle, IconEdit, IconX } from './Icons'
import DateField from './DateField'
import HoursInput from './HoursInput'
import useDialogFocus from './useDialogFocus'
import { apiFetch } from '../api/client'
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
  todayISO,
  validateSubtaskField,
  validateSubtaskForm,
} from '../utils/validators'

const EMPTY_FEEDBACK = { type: null, message: '' }

function buildFormValues(task) {
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

/**
 * Formulario de edición de una gestión, en ventana modal.
 * Se monta solo mientras está abierto, así cada apertura arranca con los
 * valores actuales de la gestión (o con `initialForm` al reabrir tras un conflicto).
 */
export default function SubtaskEditModal({
  task,
  eventDate,
  initialForm,
  onSaved,
  onConflict,
  onCancel,
}) {
  const [form, setForm] = useState(() =>
    initialForm ? { ...buildFormValues(task), ...initialForm } : buildFormValues(task)
  )
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(EMPTY_FEEDBACK)

  const nameRef = useRef(null)
  // Al reabrir con lo escrito, el estado ya refleja la decisión previa del usuario
  const statusEditedRef = useRef(Boolean(initialForm))
  const titleId = useId()
  const subtitleId = useId()
  const formId = useId()

  const dialogRef = useDialogFocus({
    onClose: onCancel,
    initialFocusRef: nameRef,
    closeOnEscape: !isSubmitting,
  })

  const dateRange = { eventDate, originalDate: task.scheduled_date }
  const minDate = task.scheduled_date < todayISO() ? task.scheduled_date : todayISO()

  const fieldId = (name) => `${formId}-${name}`

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name === 'status') statusEditedRef.current = true

    setForm((prev) => {
      const next = { ...prev, [name]: value }

      // Una gestión pospuesta que cambia de fecha debe volver a "Pendiente":
      // el backend respeta el estado explícito y, si no, no la reactivaría.
      if (name === 'scheduled_date' && task.status === 'postponed' && !statusEditedRef.current) {
        next.status = value && value !== task.scheduled_date ? 'pending' : 'postponed'
      }

      return next
    })

    if (touched[name] || errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: validateSubtaskField(name, value, dateRange),
      }))
    }
  }

  const handleBlur = (e) => {
    const { name, value } = e.target
    setTouched((prev) => ({ ...prev, [name]: true }))
    setErrors((prev) => ({
      ...prev,
      [name]: validateSubtaskField(name, value, dateRange),
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(EMPTY_FEEDBACK)

    const allTouched = Object.keys(form).reduce((acc, key) => {
      acc[key] = true
      return acc
    }, {})
    setTouched(allTouched)

    const formErrors = validateSubtaskForm(form, dateRange)
    setErrors(formErrors)

    if (Object.keys(formErrors).length > 0) {
      setFeedback({
        type: 'error',
        message: 'Por favor, corrige los errores en los campos requeridos antes de guardar.',
      })
      return
    }

    setIsSubmitting(true)

    const payload = {
      name: form.name.trim(),
      type: form.type,
      scheduled_date: form.scheduled_date,
      estimated_hours: Number(form.estimated_hours),
      priority: form.priority,
      note: form.note.trim(),
      status: form.status,
    }

    try {
      const data = await apiFetch(`/api/subtasks/${task.id}/`, {
        method: 'PATCH',
        body: payload,
      })
      onSaved(data)
    } catch (err) {
      if (err.status === 409 && err.details) {
        // El modal de conflicto resuelve fecha y horas; el resto viaja con la resolución
        const pendingChanges = { ...payload }
        delete pendingChanges.scheduled_date
        delete pendingChanges.estimated_hours
        onConflict({ task, form, pendingChanges, conflictData: err.details })
      } else {
        setErrors((prev) => ({ ...prev, ...(err.fieldErrors || {}) }))
        setFeedback({ type: 'error', message: err.message })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="confirm-dialog-overlay">
      <div
        ref={dialogRef}
        className="confirm-dialog subtask-edit-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitleId}
      >
        <div className="subtask-edit-header">
          <div className="confirm-dialog-icon">
            <IconEdit size={20} />
          </div>
          <div className="subtask-edit-heading">
            <h2 id={titleId} className="confirm-dialog-title">
              Editar gestión
            </h2>
            <p id={subtitleId} className="subtask-edit-subtitle">
              {task.name}
            </p>
          </div>
          <button
            type="button"
            className="btn-cancel-pro btn-small subtask-edit-close"
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label="Cerrar"
          >
            <IconX size={16} />
          </button>
        </div>

        {feedback.type === 'error' && (
          <div className="banner-alert banner-error subtask-edit-feedback" role="alert">
            <IconAlertTriangle size={16} className="icon-rose" />
            <span>{feedback.message}</span>
          </div>
        )}

        <form className="subtask-edit-form" onSubmit={handleSubmit} noValidate>
          <div className="field-group">
            <div className="field-label-row">
              <label htmlFor={fieldId('name')} className="field-label">
                Nombre de la gestión <span className="req-star">*</span>
              </label>
              <span className="char-counter">{form.name.length}/200</span>
            </div>
            <input
              id={fieldId('name')}
              ref={nameRef}
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              onBlur={handleBlur}
              className={`field-input ${touched.name && errors.name ? 'field-input-error' : ''}`}
              placeholder="Ej: Confirmar asistentes"
              required
              maxLength={200}
              aria-invalid={Boolean(touched.name && errors.name)}
              aria-describedby={touched.name && errors.name ? fieldId('name-error') : undefined}
            />
            {touched.name && errors.name && (
              <span id={fieldId('name-error')} className="field-error-text">
                {errors.name}
              </span>
            )}
          </div>

          <div className="field-row-2">
            <div className="field-group">
              <label htmlFor={fieldId('type')} className="field-label">
                Tipo de gestión <span className="req-star">*</span>
              </label>
              <select
                id={fieldId('type')}
                name="type"
                value={form.type}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`field-input field-select ${touched.type && errors.type ? 'field-input-error' : ''}`}
                required
                aria-invalid={Boolean(touched.type && errors.type)}
                aria-describedby={touched.type && errors.type ? fieldId('type-error') : undefined}
              >
                <option value="" disabled>Selecciona un tipo</option>
                {TASK_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              {touched.type && errors.type && (
                <span id={fieldId('type-error')} className="field-error-text">
                  {errors.type}
                </span>
              )}
            </div>

            <div className="field-group">
              <label htmlFor={fieldId('priority')} className="field-label">
                Prioridad
              </label>
              <select
                id={fieldId('priority')}
                name="priority"
                value={form.priority}
                onChange={handleChange}
                className="field-input field-select"
              >
                {TASK_PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field-row-2">
            <div className="field-group">
              <label htmlFor={fieldId('scheduled_date')} className="field-label">
                Fecha objetivo <span className="req-star">*</span>
              </label>
              <DateField
                id={fieldId('scheduled_date')}
                name="scheduled_date"
                value={form.scheduled_date}
                min={minDate}
                max={eventDate}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`field-input ${touched.scheduled_date && errors.scheduled_date ? 'field-input-error' : ''}`}
                required
                aria-invalid={Boolean(touched.scheduled_date && errors.scheduled_date)}
                aria-describedby={
                  touched.scheduled_date && errors.scheduled_date
                    ? fieldId('scheduled_date-error')
                    : undefined
                }
              />
              {touched.scheduled_date && errors.scheduled_date && (
                <span id={fieldId('scheduled_date-error')} className="field-error-text">
                  {errors.scheduled_date}
                </span>
              )}
            </div>

            <div className="field-group">
              <label htmlFor={fieldId('estimated_hours')} className="field-label">
                Horas estimadas <span className="req-star">*</span>
              </label>
              <HoursInput
                id={fieldId('estimated_hours')}
                name="estimated_hours"
                value={form.estimated_hours}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Ej: 1.0"
                className={touched.estimated_hours && errors.estimated_hours ? 'field-input-error' : ''}
                required
                aria-invalid={Boolean(touched.estimated_hours && errors.estimated_hours)}
                aria-describedby={
                  touched.estimated_hours && errors.estimated_hours
                    ? fieldId('estimated_hours-error')
                    : undefined
                }
              />
              {touched.estimated_hours && errors.estimated_hours && (
                <span id={fieldId('estimated_hours-error')} className="field-error-text">
                  {errors.estimated_hours}
                </span>
              )}
            </div>
          </div>

          <div className="field-group">
            <label htmlFor={fieldId('status')} className="field-label">
              Estado
            </label>
            <select
              id={fieldId('status')}
              name="status"
              value={form.status}
              onChange={handleChange}
              className="field-input field-select"
            >
              {TASK_STATUSES.map((st) => (
                <option key={st.value} value={st.value}>{st.label}</option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label htmlFor={fieldId('note')} className="field-label">
              Nota
            </label>
            <textarea
              id={fieldId('note')}
              name="note"
              value={form.note}
              onChange={handleChange}
              placeholder="Indicaciones adicionales para esta gestión..."
              rows="3"
              className="field-input field-textarea"
            />
          </div>

          <div className="form-actions-row subtask-edit-actions">
            <button
              type="button"
              className="btn-sec-pro"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-submit-pro"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
