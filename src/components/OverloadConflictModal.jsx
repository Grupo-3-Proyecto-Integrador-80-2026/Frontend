import { useState, useMemo } from 'react'
import {
  IconAlertTriangle,
  IconCheckCircle,
  IconCalendar,
  IconX,
} from './Icons'
import DateField from './DateField'
import { formatDateFromISO, todayISO } from '../utils/validators'
import { apiFetch } from '../api/client'

export default function OverloadConflictModal({
  isOpen,
  conflictData,
  subtask,
  eventDate,
  isNew = false,
  onResolved,
  onCancel,
}) {
  if (!isOpen || !conflictData) return null

  const limitHours = conflictData.limit_hours ?? 6
  const plannedHours = conflictData.planned_hours ?? 0
  const attemptedHours = Number(conflictData.subtask_hours || subtask?.estimated_hours || 1)
  const maxAllowedSameDay = Math.max(0, limitHours - plannedHours)

  const taskExceedsLimitEntirely = attemptedHours > limitHours

  const [selectedAction, setSelectedAction] = useState(taskExceedsLimitEntirely ? 'reduce' : 'move')
  const [targetDate, setTargetDate] = useState(
    conflictData.suggested_dates?.[0] || conflictData.date || todayISO()
  )

  const defaultSuggestedHours =
    maxAllowedSameDay > 0
      ? String(maxAllowedSameDay)
      : String(Math.max(0.5, attemptedHours - 0.5))

  const [reducedHours, setReducedHours] = useState(defaultSuggestedHours)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)

  const liveCalculation = useMemo(() => {
    if (selectedAction === 'move') {
      if (taskExceedsLimitEntirely) {
        return {
          date: targetDate,
          hours: attemptedHours,
          projected: attemptedHours,
          isOverloaded: true,
          message: `Esta gestión dura ${attemptedHours}h y supera tu límite total (${limitHours}h/día).`,
        }
      }

      const isSameDate = targetDate === conflictData.date
      const projected = isSameDate ? plannedHours + attemptedHours : attemptedHours
      const isOverloaded = isSameDate ? projected > limitHours : false

      return {
        date: targetDate,
        hours: attemptedHours,
        projected,
        isOverloaded,
        message: isSameDate
          ? `Carga resultante: ${projected}h (supera las ${limitHours}h permitidas)`
          : `Carga asignada: ${attemptedHours}h para el ${formatDateFromISO(targetDate)}`,
      }
    } else {
      const numHours = Number(reducedHours) || 0
      const projected = plannedHours + numHours
      const isOverloaded = projected > limitHours || numHours <= 0 || numHours > attemptedHours

      return {
        date: conflictData.date,
        hours: numHours,
        projected,
        isOverloaded,
        message: isOverloaded
          ? `Carga resultante: ${projected}h (excede el límite de ${limitHours}h)`
          : `Carga viable: ${projected}h de ${limitHours}h permitidas`,
      }
    }
  }, [
    selectedAction,
    targetDate,
    reducedHours,
    conflictData,
    plannedHours,
    attemptedHours,
    limitHours,
    taskExceedsLimitEntirely,
  ])

  const saveSubtask = async (body) => {
    if (isNew) {
      const eventId = subtask?.event_id
      const payload = {
        name: subtask?.name,
        type: subtask?.type || 'other',
        priority: subtask?.priority || 'medium',
        note: subtask?.note || '',
        ...body,
      }
      return await apiFetch(`/api/events/${eventId}/subtasks/`, {
        method: 'POST',
        body: payload,
      })
    } else {
      return await apiFetch(`/api/subtasks/${subtask.id}/`, {
        method: 'PATCH',
        body,
      })
    }
  }

  const handleResolveByMove = async (dateToUse) => {
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const result = await saveSubtask({
        scheduled_date: dateToUse,
        estimated_hours: attemptedHours,
      })
      onResolved(
        result,
        `Gestión programada para el ${formatDateFromISO(dateToUse)} (${attemptedHours}h).`
      )
    } catch (err) {
      if (err.status === 409 && err.details) {
        setErrorMessage('La fecha elegida también excede tu disponibilidad.')
      } else {
        setErrorMessage('No se pudo mover la gestión. Inténtalo de nuevo.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResolveByReduce = async () => {
    const numHours = Number(reducedHours)
    if (numHours <= 0) {
      setErrorMessage('Las horas deben ser mayores a 0.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    const payload = {
      scheduled_date: conflictData.date,
      estimated_hours: numHours,
    }

    if (!isNew && numHours < (subtask?.original_hours || attemptedHours)) {
      payload.resolution = 'reduce_hours'
    }

    try {
      const result = await saveSubtask(payload)
      onResolved(
        result,
        `Horas ajustadas a ${numHours}h para el ${formatDateFromISO(conflictData.date)}.`
      )
    } catch {
      setErrorMessage('No se pudo ajustar las horas. Revisa los datos e intenta nuevamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePostpone = async () => {
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const result = await saveSubtask({
        scheduled_date: conflictData.date,
        estimated_hours: attemptedHours,
        status: 'postponed',
      })
      onResolved(result, 'Gestión marcada como pospuesta.')
    } catch {
      setErrorMessage('No se pudo posponer la gestión.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleForceSave = async () => {
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const result = await saveSubtask({
        scheduled_date: conflictData.date,
        estimated_hours: attemptedHours,
        confirm_overload: true,
      })
      onResolved(
        result,
        `Gestión guardada para el ${formatDateFromISO(conflictData.date)} asumiendo la sobrecarga.`
      )
    } catch {
      setErrorMessage('No se pudo guardar la gestión.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="confirm-dialog-overlay" role="dialog" aria-modal="true">
      <div className="confirm-dialog" style={{ maxWidth: '520px', textAlign: 'left', padding: '24px' }}>
        
        {/* Cabecera */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <div className="confirm-dialog-icon confirm-dialog-icon-danger" style={{ margin: 0 }}>
            <IconAlertTriangle size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 className="confirm-dialog-title" style={{ margin: 0, fontSize: '18px' }}>
              Sobrecarga de horas detectada
            </h2>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              {subtask?.name || 'Gestión en curso'}
            </span>
          </div>
          <button
            type="button"
            className="btn-cancel-pro btn-small"
            style={{ padding: '6px', borderRadius: '50%' }}
            onClick={onCancel}
            aria-label="Cerrar modal"
          >
            <IconX size={16} />
          </button>
        </div>

        {/* Explicación amigable */}
        <div
          style={{
            margin: '12px 0',
            borderRadius: '8px',
            padding: '12px 14px',
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            fontSize: '13px',
            color: '#92400e',
            lineHeight: 1.45,
          }}
        >
          El <strong>{formatDateFromISO(conflictData.date)}</strong> ya cuenta con <strong>{plannedHours}h</strong> planificadas. Si sumas las <strong>{attemptedHours}h</strong> de esta tarea, acumularás <strong>{plannedHours + attemptedHours}h</strong> (tu límite diario es de {limitHours}h).
        </div>

        {errorMessage && (
          <div className="banner-alert banner-error" role="alert" style={{ marginBottom: '12px' }}>
            <IconAlertTriangle size={16} className="icon-rose" />
            <span style={{ fontSize: '13px', flex: 1 }}>{errorMessage}</span>
          </div>
        )}

        {/* Pestañas de resolución */}
        <div style={{ margin: '14px 0' }}>
          <span className="field-label" style={{ marginBottom: '8px', display: 'block', fontWeight: 600 }}>
            ¿Qué solución prefieres aplicar?
          </span>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button
              type="button"
              className={selectedAction === 'move' ? 'btn-submit-pro btn-small' : 'btn-sec-pro btn-small'}
              onClick={() => setSelectedAction('move')}
              disabled={isSubmitting}
            >
              1. Mover a otra fecha
            </button>
            <button
              type="button"
              className={selectedAction === 'reduce' ? 'btn-submit-pro btn-small' : 'btn-sec-pro btn-small'}
              onClick={() => setSelectedAction('reduce')}
              disabled={isSubmitting}
            >
              2. Reducir horas
            </button>
          </div>

          {selectedAction === 'move' && (
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              {taskExceedsLimitEntirely ? (
                <div style={{ color: '#b45309', fontSize: '12px', lineHeight: 1.4 }}>
                  Esta gestión necesita <strong>{attemptedHours}h</strong>, superando el límite diario de <strong>{limitHours}h</strong>. Pasa a <em>"2. Reducir horas"</em> para ajustarla.
                </div>
              ) : (
                <>
                  <label className="field-label" style={{ fontSize: '12px', marginBottom: '6px', display: 'block' }}>
                    Días sugeridos con espacio para tus <strong>{attemptedHours}h</strong>:
                  </label>

                  {conflictData.suggested_dates && conflictData.suggested_dates.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                      {conflictData.suggested_dates.map((d) => (
                        <button
                          key={d}
                          type="button"
                          className={targetDate === d ? 'btn-submit-pro btn-small' : 'btn-sec-pro btn-small'}
                          style={{ fontSize: '12px', padding: '4px 10px' }}
                          onClick={() => setTargetDate(d)}
                          disabled={isSubmitting}
                        >
                          <IconCalendar size={13} style={{ marginRight: '4px' }} />
                          {formatDateFromISO(d)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="field-hint" style={{ margin: '4px 0 8px 0' }}>
                      No encontramos días inmediatos con espacio. Selecciona una fecha:
                    </p>
                  )}

                  <div className="field-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="conflict-target-date" className="field-label" style={{ fontSize: '12px' }}>
                      O selecciona otra fecha manual:
                    </label>
                    <DateField
                      id="conflict-target-date"
                      name="target_date"
                      value={targetDate}
                      min={todayISO()}
                      max={eventDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {selectedAction === 'reduce' && (
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div className="field-group" style={{ marginBottom: 0 }}>
                <label htmlFor="reduced-hours-input" className="field-label" style={{ fontSize: '12px' }}>
                  Ajustar horas estimadas para este día:
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    id="reduced-hours-input"
                    type="number"
                    step="0.5"
                    min="0.5"
                    max={String(attemptedHours)}
                    value={reducedHours}
                    onChange={(e) => setReducedHours(e.target.value)}
                    className="field-input"
                    style={{ maxWidth: '110px' }}
                    disabled={isSubmitting}
                  />
                  <span style={{ fontSize: '13px', color: '#64748b' }}>horas de trabajo</span>
                </div>
                <small className="field-hint" style={{ marginTop: '6px', display: 'block' }}>
                  {maxAllowedSameDay > 0 ? (
                    <>Recomendación: con <strong>{maxAllowedSameDay}h</strong> la jornada queda en el límite exacto ({limitHours}h).</>
                  ) : (
                    <>Este día ya está al tope con otras actividades.</>
                  )}
                </small>
              </div>
            </div>
          )}
        </div>

        {/* Barra de estado rediseñada (Soluciona el problema de texto pegado de la imagen 3) */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '12.5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            background: liveCalculation.isOverloaded ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${liveCalculation.isOverloaded ? '#fecaca' : '#bbf7d0'}`,
            color: liveCalculation.isOverloaded ? '#991b1b' : '#166534',
            marginBottom: '18px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 auto' }}>
            {liveCalculation.isOverloaded ? (
              <IconAlertTriangle size={16} style={{ flexShrink: 0 }} />
            ) : (
              <IconCheckCircle size={16} style={{ flexShrink: 0 }} />
            )}
            <span style={{ lineHeight: 1.3 }}>{liveCalculation.message}</span>
          </div>
          <span
            style={{
              fontWeight: 700,
              fontSize: '12px',
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: liveCalculation.isOverloaded ? '#fee2e2' : '#dcfce7',
              whiteSpace: 'nowrap',
            }}
          >
            {liveCalculation.isOverloaded ? 'Conflicto activo' : 'Solución viable'}
          </span>
        </div>

        {/* Botones de acción */}
        <div
          className="confirm-dialog-actions"
          style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn-sec-pro btn-small"
              onClick={handlePostpone}
              disabled={isSubmitting}
            >
              Posponer
            </button>
            <button
              type="button"
              className="btn-danger-ghost btn-small"
              onClick={handleForceSave}
              disabled={isSubmitting}
            >
              Forzar guardado
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn-cancel-pro"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn-submit-pro"
              disabled={liveCalculation.isOverloaded || isSubmitting}
              onClick={() => {
                if (selectedAction === 'move') {
                  handleResolveByMove(targetDate)
                } else {
                  handleResolveByReduce()
                }
              }}
            >
              {isSubmitting ? 'Guardando...' : 'Aplicar solución'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}