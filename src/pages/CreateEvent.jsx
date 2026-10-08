import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  IconPlus,
  IconCheckCircle,
  IconAlertTriangle,
  IconCalendar,
  IconUser,
  IconMapPin,
  IconX,
} from '../components/Icons'
import DateField from '../components/DateField'
import { apiFetch } from '../api/client'
import {
  validateEventField,
  validateEventForm,
  validateSubtaskField,
  validateSubtaskForm,
  formatDateFromISO,
  todayISO,
  EVENT_TYPES,
  EVENT_STATUSES,
  TASK_TYPES,
} from '../utils/validators'

const INITIAL_FORM_STATE = {
  name: '',
  event_type: '',
  contact: '',
  location: '',
  event_date: '',
  status: 'planning',
  description: '',
}

const EMPTY_FEEDBACK = { type: null, message: '', eventId: null }

// Una fila del plan inicial de gestiones (T1)
function createPlanRow(key) {
  return {
    key,
    values: { name: '', type: '', scheduled_date: '', estimated_hours: '' },
    errors: {},
    touched: {},
  }
}

export default function CreateEvent() {
  const navigate = useNavigate()

  // Estado controlado del formulario
  const [formData, setFormData] = useState(INITIAL_FORM_STATE)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(EMPTY_FEEDBACK)

  // Plan inicial de gestiones: filas dinámicas que el usuario agrega o quita
  const [planRows, setPlanRows] = useState([])
  const nextRowKey = useRef(1)

  const bannerRef = useRef(null)

useEffect(() => {
  if (!feedback.type) return

  // Errores de campos: llevar al primer campo en rojo; si no hay (error del servidor), al banner
  const target =
    feedback.type === 'error'
      ? document.querySelector('.field-input-error') || bannerRef.current
      : bannerRef.current

    target?.scrollIntoView({ behavior: 'smooth', block: feedback.type === 'error' ? 'center' : 'start' })
  }, [feedback])

  const plannedHours = planRows.reduce(
    (sum, row) => sum + (Number(row.values.estimated_hours) || 0),
    0
  )

  // Manejador de cambios con re-validación inmediata
  const handleChange = (e) => {
    const { name, value } = e.target

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))

    // Si el campo ya fue visitado o ya tenía error, re-validamos en tiempo real
    if (touched[name] || errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: validateEventField(name, value),
      }))
    }
  }

  // Manejador de pérdida de foco (onBlur) para validación inline
  const handleBlur = (e) => {
    const { name, value } = e.target
    setTouched((prev) => ({
      ...prev,
      [name]: true,
    }))
    setErrors((prev) => ({
      ...prev,
      [name]: validateEventField(name, value),
    }))
  }

  /* ===================== Plan inicial de gestiones ===================== */

  const handleAddPlanRow = () => {
    setPlanRows((prev) => [...prev, createPlanRow(nextRowKey.current++)])
  }

  const handleRemovePlanRow = (key) => {
    setPlanRows((prev) => prev.filter((row) => row.key !== key))
  }

  // Las gestiones del plan deben quedar entre hoy y la fecha del evento
  const planDateRange = { eventDate: formData.event_date || undefined }

  const updatePlanRow = (key, updater) => {
    setPlanRows((prev) => prev.map((row) => (row.key === key ? updater(row) : row)))
  }

  const handlePlanChange = (key, e) => {
    const { name, value } = e.target
    updatePlanRow(key, (row) => ({
      ...row,
      values: { ...row.values, [name]: value },
      errors:
        row.touched[name] || row.errors[name]
          ? { ...row.errors, [name]: validateSubtaskField(name, value, planDateRange) }
          : row.errors,
    }))
  }

  const handlePlanBlur = (key, e) => {
    const { name, value } = e.target
    updatePlanRow(key, (row) => ({
      ...row,
      touched: { ...row.touched, [name]: true },
      errors: { ...row.errors, [name]: validateSubtaskField(name, value, planDateRange) },
    }))
  }

  /* ============================ Envío ============================ */

  const resetForm = () => {
    setFormData(INITIAL_FORM_STATE)
    setErrors({})
    setTouched({})
    setPlanRows([])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(EMPTY_FEEDBACK)

    // Marcar todos los campos como tocados al intentar enviar
    setTouched(Object.fromEntries(Object.keys(formData).map((key) => [key, true])))
    const formErrors = validateEventForm(formData)
    setErrors(formErrors)

    // Validar también cada gestión del plan
    let planHasErrors = false
    const validatedRows = planRows.map((row) => {
      const rowErrors = validateSubtaskForm(row.values, planDateRange)
      if (Object.keys(rowErrors).length > 0) planHasErrors = true
      return {
        ...row,
        errors: rowErrors,
        touched: Object.fromEntries(Object.keys(row.values).map((key) => [key, true])),
      }
    })
    setPlanRows(validatedRows)

    if (Object.keys(formErrors).length > 0 || planHasErrors) {
      setFeedback({
        type: 'error',
        message: 'Revisa los campos marcados en rojo antes de guardar.',
        eventId: null,
      })
      return
    }

    setIsSubmitting(true)

    const payload = {
      name: formData.name.trim(),
      event_type: formData.event_type,
      contact: formData.contact.trim(),
      location: formData.location.trim(),
      event_date: formData.event_date,
      status: formData.status,
      description: formData.description.trim(),
    }

    let created
    try {
      created = await apiFetch('/api/events/', { method: 'POST', body: payload })
    } catch (err) {
      // Si el backend señala campos concretos, se marcan en el formulario
      if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...err.fieldErrors }))
      }
      setFeedback({ type: 'error', message: err.message, eventId: null })
      setIsSubmitting(false)
      return
    }

    // El evento ya existe: se guardan las gestiones del plan una por una
    let failedRows = 0
    for (const row of validatedRows) {
      try {
        await apiFetch(`/api/events/${created.id}/subtasks/`, {
          method: 'POST',
          body: {
            name: row.values.name.trim(),
            type: row.values.type,
            scheduled_date: row.values.scheduled_date,
            estimated_hours: Number(row.values.estimated_hours),
          },
        })
      } catch {
        failedRows += 1
      }
    }

    const savedRows = validatedRows.length - failedRows
    const plan =
      savedRows > 0 ? ` con ${savedRows} ${savedRows === 1 ? 'gestión' : 'gestiones'}` : ''

    if (failedRows > 0) {
      setFeedback({
        type: 'warning',
        message: `Creamos el evento "${created.name}"${plan}, pero ${failedRows} ${
          failedRows === 1 ? 'gestión no se pudo guardar' : 'gestiones no se pudieron guardar'
        }. Puedes agregarlas desde el detalle del evento.`,
        eventId: created.id,
      })
    } else {
      setFeedback({
        type: 'success',
        message: `Evento "${created.name}" creado${plan} para el ${formatDateFromISO(created.event_date)}.`,
        eventId: created.id,
      })
    }

    resetForm()
    setIsSubmitting(false)
  }

  // Restablecer formulario y estados de validación
  const handleReset = () => {
    resetForm()
    setFeedback(EMPTY_FEEDBACK)
  }

  return (
    <div className="create-page-container">
      {/* Alerta de Feedback (Éxito o Advertencia) */}
      {(feedback.type === 'success' || feedback.type === 'warning') && (
        <div ref={bannerRef}
          className={`banner-alert ${feedback.type === 'success' ? 'banner-success' : 'banner-warning'}`}
          role="status"
        >
          <div className="banner-icon-side">
            {feedback.type === 'success' ? (
              <IconCheckCircle size={20} className="icon-emerald" />
            ) : (
              <IconAlertTriangle size={20} />
            )}
          </div>
          <div className="banner-content">
            <strong>{feedback.message}</strong>
          </div>
          <div className="banner-actions">
            <button
              type="button"
              className="btn-alert-outline"
              onClick={() => setFeedback(EMPTY_FEEDBACK)}
            >
              Crear otro
            </button>
            <button
              type="button"
              className="btn-alert-primary"
              onClick={() => navigate(`/evento/${feedback.eventId}`)}
            >
              Ver evento
            </button>
          </div>
        </div>
      )}

      {feedback.type === 'error' && (
        <div ref={bannerRef} className="banner-alert banner-error" role="alert">
          <div className="banner-icon-side">
            <IconAlertTriangle size={20} className="icon-rose" />
          </div>
          <div className="banner-content">
            <strong>No pudimos guardar el evento.</strong> {feedback.message}
          </div>
          <button
            type="button"
            className="btn-close-alert"
            aria-label="Cerrar alerta"
            onClick={() => setFeedback(EMPTY_FEEDBACK)}
          >
            <IconX size={16} />
          </button>
        </div>
      )}

      <div className="create-layout-grid">
        <div className="form-card-pro">
          <div className="form-card-header">
            <div>
              <h2 className="form-heading">Datos del evento</h2>
              <p className="form-subheading">Los campos con * son obligatorios</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} onReset={handleReset} noValidate className="form-body-pro">
            {/* Nombre del Evento */}
            <div className="field-group">
              <div className="field-label-row">
                <label htmlFor="name" className="field-label">
                  Nombre del evento <span className="req-star">*</span>
                </label>
                <span className="char-counter">
                  {formData.name.length}/200
                </span>
              </div>
              <input
                id="name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Ej: Boda de Laura y Andrés"
                className={`field-input ${touched.name && errors.name ? 'field-input-error' : ''}`}
                required
                maxLength={200}
                aria-invalid={touched.name && !!errors.name}
                aria-describedby={errors.name ? 'name-error' : undefined}
              />
              {touched.name && errors.name && (
                <span id="name-error" className="field-error-text">
                  {errors.name}
                </span>
              )}
            </div>

            {/* Fila: Tipo y Estado */}
            <div className="field-row-2">
              <div className="field-group">
                <label htmlFor="event_type" className="field-label">
                  Tipo de evento <span className="req-star">*</span>
                </label>
                <select
                  id="event_type"
                  name="event_type"
                  value={formData.event_type}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`field-input field-select ${touched.event_type && errors.event_type ? 'field-input-error' : ''}`}
                  required
                  aria-invalid={touched.event_type && !!errors.event_type}
                  aria-describedby={errors.event_type ? 'event-type-error' : undefined}
                >
                  <option value="" disabled>
                    Selecciona un tipo
                  </option>
                  {EVENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                {touched.event_type && errors.event_type && (
                  <span id="event-type-error" className="field-error-text">{errors.event_type}</span>
                )}
              </div>

              <div className="field-group">
                <label htmlFor="status" className="field-label">
                  Estado inicial <span className="req-star">*</span>
                </label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`field-input field-select ${touched.status && errors.status ? 'field-input-error' : ''}`}
                  required
                >
                  {EVENT_STATUSES.map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label}
                    </option>
                  ))}
                </select>
                {touched.status && errors.status && (
                  <span className="field-error-text">{errors.status}</span>
                )}
              </div>
            </div>

            {/* Fila: Fecha del evento (calendario) y Contacto */}
            <div className="field-row-2">
              <div className="field-group">
                <label htmlFor="event_date" className="field-label">
                  Fecha del evento <span className="req-star">*</span>
                </label>
                <DateField
                  id="event_date"
                  name="event_date"
                  value={formData.event_date}
                  min={todayISO()}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`field-input ${touched.event_date && errors.event_date ? 'field-input-error' : ''}`}
                  required
                  aria-invalid={touched.event_date && !!errors.event_date}
                  aria-describedby={errors.event_date ? 'date-error' : undefined}
                />
                {touched.event_date && errors.event_date && (
                  <span id="date-error" className="field-error-text">
                    {errors.event_date}
                  </span>
                )}
              </div>

              <div className="field-group">
                <label htmlFor="contact" className="field-label">
                  Cliente / contacto
                </label>
                <input
                  id="contact"
                  type="text"
                  name="contact"
                  value={formData.contact}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Ej: Laura Gómez - 300 123 4567"
                  maxLength={255}
                  className={`field-input ${touched.contact && errors.contact ? 'field-input-error' : ''}`}
                />
                {touched.contact && errors.contact && (
                  <span className="field-error-text">{errors.contact}</span>
                )}
              </div>
            </div>

            {/* Lugar */}
            <div className="field-group">
              <label htmlFor="location" className="field-label">
                Lugar
              </label>
              <input
                id="location"
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Ej: Hacienda El Paraíso, salón principal"
                maxLength={255}
                className={`field-input ${touched.location && errors.location ? 'field-input-error' : ''}`}
              />
              {touched.location && errors.location && (
                <span className="field-error-text">{errors.location}</span>
              )}
            </div>

            {/* Descripción / Notas */}
            <div className="field-group">
              <div className="field-label-row">
                <label htmlFor="description" className="field-label">
                  Descripción o notas
                </label>
                <span className="char-counter">
                  {formData.description.length}/2000
                </span>
              </div>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Acuerdos con el cliente, requerimientos de montaje..."
                rows="3"
                maxLength={2000}
                className={`field-input field-textarea ${touched.description && errors.description ? 'field-input-error' : ''}`}
              />
              {touched.description && errors.description && (
                <span className="field-error-text">{errors.description}</span>
              )}
            </div>

            {/* Plan inicial de gestiones (opcional) */}
            <fieldset className="plan-section">
              <legend className="plan-legend">Plan inicial de gestiones (opcional)</legend>
              <p className="field-hint">
                Agrega las gestiones logísticas que ya conoces, como reservar el salón o confirmar
                el catering. También puedes hacerlo después desde el detalle del evento.
              </p>

              {planRows.map((row, index) => (
                <div key={row.key} className="plan-row" role="group" aria-label={`Gestión ${index + 1}`}>
                  <div className="plan-row-header">
                    <span className="plan-row-title">Gestión {index + 1}</span>
                    <button
                      type="button"
                      className="btn-cancel-pro btn-small"
                      onClick={() => handleRemovePlanRow(row.key)}
                      aria-label={`Quitar gestión ${index + 1}`}
                    >
                      <IconX size={14} />
                      <span>Quitar</span>
                    </button>
                  </div>

                  <div className="field-row-2">
                    <div className="field-group">
                      <label htmlFor={`plan-${row.key}-name`} className="field-label">
                        Nombre <span className="req-star">*</span>
                      </label>
                      <input
                        id={`plan-${row.key}-name`}
                        type="text"
                        name="name"
                        value={row.values.name}
                        onChange={(e) => handlePlanChange(row.key, e)}
                        onBlur={(e) => handlePlanBlur(row.key, e)}
                        placeholder="Ej: Reservar el salón"
                        maxLength={200}
                        autoFocus
                        className={`field-input ${row.touched.name && row.errors.name ? 'field-input-error' : ''}`}
                        aria-invalid={row.touched.name && !!row.errors.name}
                        aria-describedby={row.errors.name ? `plan-${row.key}-name-error` : undefined}
                      />
                      {row.touched.name && row.errors.name && (
                        <span id={`plan-${row.key}-name-error`} className="field-error-text">
                          {row.errors.name}
                        </span>
                      )}
                    </div>

                    <div className="field-group">
                      <label htmlFor={`plan-${row.key}-type`} className="field-label">
                        Tipo <span className="req-star">*</span>
                      </label>
                      <select
                        id={`plan-${row.key}-type`}
                        name="type"
                        value={row.values.type}
                        onChange={(e) => handlePlanChange(row.key, e)}
                        onBlur={(e) => handlePlanBlur(row.key, e)}
                        className={`field-input field-select ${row.touched.type && row.errors.type ? 'field-input-error' : ''}`}
                        aria-invalid={row.touched.type && !!row.errors.type}
                        aria-describedby={row.errors.type ? `plan-${row.key}-type-error` : undefined}
                      >
                        <option value="" disabled>
                          Selecciona un tipo
                        </option>
                        {TASK_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                      {row.touched.type && row.errors.type && (
                        <span id={`plan-${row.key}-type-error`} className="field-error-text">
                          {row.errors.type}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="field-row-2">
                    <div className="field-group">
                      <label htmlFor={`plan-${row.key}-date`} className="field-label">
                        Fecha objetivo <span className="req-star">*</span>
                      </label>
                      <DateField
                        id={`plan-${row.key}-date`}
                        name="scheduled_date"
                        value={row.values.scheduled_date}
                        min={todayISO()}
                        max={formData.event_date || undefined}
                        onChange={(e) => handlePlanChange(row.key, e)}
                        onBlur={(e) => handlePlanBlur(row.key, e)}
                        className={`field-input ${row.touched.scheduled_date && row.errors.scheduled_date ? 'field-input-error' : ''}`}
                        aria-invalid={row.touched.scheduled_date && !!row.errors.scheduled_date}
                        aria-describedby={row.errors.scheduled_date ? `plan-${row.key}-date-error` : undefined}
                      />
                      {row.touched.scheduled_date && row.errors.scheduled_date && (
                        <span id={`plan-${row.key}-date-error`} className="field-error-text">
                          {row.errors.scheduled_date}
                        </span>
                      )}
                    </div>

                    <div className="field-group">
                      <label htmlFor={`plan-${row.key}-hours`} className="field-label">
                        Horas estimadas <span className="req-star">*</span>
                      </label>
                      <input
                        id={`plan-${row.key}-hours`}
                        type="number"
                        name="estimated_hours"
                        value={row.values.estimated_hours}
                        onChange={(e) => handlePlanChange(row.key, e)}
                        onBlur={(e) => handlePlanBlur(row.key, e)}
                        placeholder="Ej: 2.5"
                        min="0"
                        step="0.1"
                        className={`field-input ${row.touched.estimated_hours && row.errors.estimated_hours ? 'field-input-error' : ''}`}
                        aria-invalid={row.touched.estimated_hours && !!row.errors.estimated_hours}
                        aria-describedby={row.errors.estimated_hours ? `plan-${row.key}-hours-error` : undefined}
                      />
                      {row.touched.estimated_hours && row.errors.estimated_hours && (
                        <span id={`plan-${row.key}-hours-error`} className="field-error-text">
                          {row.errors.estimated_hours}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              <button type="button" className="btn-sec-pro btn-add-row" onClick={handleAddPlanRow}>
                <IconPlus size={14} />
                <span>Agregar gestión</span>
              </button>
            </fieldset>

            {/* Botones de acción */}
            <div className="form-actions-row">
              <button
                type="reset"
                className="btn-sec-pro"
                disabled={isSubmitting}
              >
                Limpiar formulario
              </button>
              <Link to="/eventos" className="btn-cancel-pro">
                Cancelar
              </Link>
              <button
                type="submit"
                className="btn-submit-pro"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Guardando...' : 'Guardar evento'}
              </button>
            </div>
          </form>
        </div>

        {/* Panel lateral: Vista Previa en Vivo */}
        <aside className="preview-card-pro" aria-label="Vista previa del evento">
          <div className="preview-card-header">
            <h3>Vista previa</h3>
          </div>

          <p className="preview-intro">
            Así quedará registrado tu evento.
          </p>

          <div className="preview-details-box">
            <div className="preview-item">
              <span className="p-label">
                <IconUser size={13} />
                <span>Evento:</span>
              </span>
              <span className="p-value font-bold">
                {formData.name || <em className="muted">Sin definir</em>}
              </span>
            </div>

            <div className="preview-item">
              <span className="p-label">Tipo:</span>
              <span className="badge-preview-chip">
                {EVENT_TYPES.find((t) => t.value === formData.event_type)?.label || (
                  <em className="muted">Sin definir</em>
                )}
              </span>
            </div>

            <div className="preview-item">
              <span className="p-label">
                <IconCalendar size={13} />
                <span>Fecha:</span>
              </span>
              <span className="p-value">
                {formData.event_date ? formatDateFromISO(formData.event_date) : <em className="muted">Sin definir</em>}
              </span>
            </div>

            <div className="preview-item">
              <span className="p-label">Estado:</span>
              <span className="badge-status-chip">
                {EVENT_STATUSES.find((s) => s.value === formData.status)?.label}
              </span>
            </div>

            <div className="preview-item">
              <span className="p-label">Cliente:</span>
              <span className="p-value">
                {formData.contact || <em className="muted">Sin definir</em>}
              </span>
            </div>

            <div className="preview-item">
              <span className="p-label">
                <IconMapPin size={13} />
                <span>Lugar:</span>
              </span>
              <span className="p-value">
                {formData.location || <em className="muted">Sin definir</em>}
              </span>
            </div>

            <div className="preview-item">
              <span className="p-label">Gestiones:</span>
              <span className="p-value">
                {planRows.length === 0
                  ? <em className="muted">Ninguna por ahora</em>
                  : `${planRows.length} (${plannedHours.toLocaleString('es-CO', { maximumFractionDigits: 1 })} h estimadas)`}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
