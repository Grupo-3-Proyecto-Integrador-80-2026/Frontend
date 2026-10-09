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

  // Estados del modal:
  const [selectedAction, setSelectedAction] = useState('move')
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

  // Cálculo dinámico en vivo
  const liveCalculation = useMemo(() => {
    if (selectedAction === 'move') {
      const isSameDate = targetDate === conflictData.date
      const projected = isSameDate ? plannedHours + attemptedHours : attemptedHours
      const isOverloaded = isSameDate && projected > limitHours
      return {
        date: targetDate,
        hours: attemptedHours,
        projected,
        isOverloaded,
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
      }
    }
  }, [selectedAction, targetDate, reducedHours, conflictData, plannedHours, attemptedHours, limitHours])

  // Helper que decide si hace POST o PATCH
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

  // 1. Resolver moviendo a otra fecha
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
        `Gestión guardada para el ${formatDateFromISO(dateToUse)} con ${attemptedHours}h.`
      )
    } catch (err) {
      if (err.status === 409 && err.details) {
        setErrorMessage(err.message || 'La fecha seleccionada aún supera el límite diario.')
      } else {
        setErrorMessage(err.message || 'No pudimos aplicar la solución al conflicto.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // 2. Resolver reduciendo horas en la misma fecha
  const handleResolveByReduce = async () => {
    const numHours = Number(reducedHours)
    if (numHours <= 0) {
      setErrorMessage('Las horas estimadas deben ser mayores a 0.')
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
        `Gestión guardada con ${numHours}h para el ${formatDateFromISO(conflictData.date)}.`
      )
    } catch (err) {
      setErrorMessage(err.message || 'No pudimos aplicar el ajuste de horas.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 3. Posponer gestión
  const handlePostpone = async () => {
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const result = await saveSubtask({
        scheduled_date: conflictData.date,
        estimated_hours: attemptedHours,
        status: 'postponed',
      })
      onResolved(result, 'Gestión guardada como pospuesta (no sumará carga al día).')
    } catch (err) {
      setErrorMessage(err.message || 'No pudimos posponer la gestión.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 4. Forzar sobrecarga (confirm_overload: true)
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
        `Gestión guardada para el ${formatDateFromISO(conflictData.date)} con sobrecarga confirmada.`
      )
    } catch (err) {
      setErrorMessage(err.message || 'No pudimos confirmar la sobrecarga.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="confirm-dialog-overlay" role="dialog" aria-modal="true">
      <div className="confirm-dialog" style={{ maxWidth: '540px', textAlign: 'left' }}>
        {/* Cabecera */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div className="confirm-dialog-icon confirm-dialog-icon-danger">
            <IconAlertTriangle size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 className="confirm-dialog-title" style={{ margin: 0, fontSize: '18px' }}>
              Conflicto por sobrecarga diaria
            </h2>
            <span style={{ fontSize: '13px', color: 'var(--text-muted, #64748b)' }}>
              {subtask?.name || 'Gestión'}
            </span>
          </div>
          <button
            type="button"
            className="btn-cancel-pro btn-small"
            onClick={onCancel}
            aria-label="Cerrar modal"
            disabled={isSubmitting}
          >
            <IconX size={16} />
          </button>
        </div>

        {/* Mensaje de advertencia sin tecnicismos */}
        <div
          className="banner-alert banner-warning"
          style={{ margin: '12px 0', borderRadius: '8px', padding: '12px' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <strong style={{ fontSize: '14px', color: '#b45309' }}>
              {conflictData.message ||
                `Quedarías con ${conflictData.resulting_hours}h de gestión planificadas (límite ${limitHours}h).`}
            </strong>
            <p style={{ margin: 0, fontSize: '12px', color: '#92400e' }}>
              El día <strong>{formatDateFromISO(conflictData.date)}</strong> ya tiene{' '}
              <strong>{plannedHours}h</strong> planificadas. Al intentar asignar{' '}
              <strong>{attemptedHours}h</strong> a esta tarea, la carga acumulada sería de{' '}
              <strong>{plannedHours + attemptedHours}h</strong> (excedes tu límite de {limitHours}h).
            </p>
          </div>
        </div>

        {/* Error si falló el guardado */}
        {errorMessage && (
          <div className="banner-alert banner-error" role="alert" style={{ marginBottom: '12px' }}>
            <IconAlertTriangle size={16} className="icon-rose" />
            <span style={{ fontSize: '13px', flex: 1 }}>{errorMessage}</span>
          </div>
        )}

        {/* Pestañas de Alternativas */}
        <div style={{ margin: '16px 0 12px 0' }}>
          <span className="field-label" style={{ marginBottom: '8px', display: 'block' }}>
            ¿Cómo deseas resolver este conflicto?
          </span>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button
              type="button"
              className={selectedAction === 'move' ? 'btn-submit-pro btn-small' : 'btn-sec-pro btn-small'}
              onClick={() => setSelectedAction('move')}
              disabled={isSubmitting}
            >
              1. Mover a otro día
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

          {/* Opción 1: Mover */}
          {selectedAction === 'move' && (
            <div
              style={{
                background: 'var(--bg-subtle, #f8fafc)',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #e2e8f0)',
              }}
            >
              <label className="field-label" style={{ fontSize: '12px' }}>
                Días sugeridos donde caben tus <strong>{attemptedHours}h</strong> sin sobrecargar:
              </label>

              {conflictData.suggested_dates && conflictData.suggested_dates.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '8px 0 12px 0' }}>
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
                <p className="field-hint" style={{ margin: '6px 0 10px 0' }}>
                  No hay días sugeridos automáticos. Elige otra fecha en el calendario:
                </p>
              )}

              <div className="field-group" style={{ marginBottom: 0 }}>
                <label htmlFor="conflict-target-date" className="field-label" style={{ fontSize: '12px' }}>
                  O elige otra fecha en el calendario:
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
            </div>
          )}

          {/* Opción 2: Reducir horas */}
          {selectedAction === 'reduce' && (
            <div
              style={{
                background: 'var(--bg-subtle, #f8fafc)',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #e2e8f0)',
              }}
            >
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
                    style={{ maxWidth: '120px' }}
                    disabled={isSubmitting}
                  />
                  <span style={{ fontSize: '13px', color: 'var(--text-muted, #64748b)' }}>
                    horas estimadas
                  </span>
                </div>
                <small className="field-hint" style={{ marginTop: '6px', display: 'block' }}>
                  {maxAllowedSameDay > 0 ? (
                    <>
                      Sugerencia: con <strong>{maxAllowedSameDay}h</strong> la carga del día queda en{' '}
                      <strong>{limitHours}h</strong> exactas (sin sobrecarga).
                    </>
                  ) : (
                    <>Este día ya alcanzó o superó el límite con otras tareas.</>
                  )}
                </small>
              </div>
            </div>
          )}
        </div>

        {/* Indicador de recálculo en vivo */}
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: liveCalculation.isOverloaded ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${liveCalculation.isOverloaded ? '#fecaca' : '#bbf7d0'}`,
            color: liveCalculation.isOverloaded ? '#991b1b' : '#166534',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {liveCalculation.isOverloaded ? (
              <IconAlertTriangle size={16} />
            ) : (
              <IconCheckCircle size={16} />
            )}
            <span>
              {liveCalculation.isOverloaded
                ? `Carga resultante: ${liveCalculation.projected}h (supera el límite de ${limitHours}h)`
                : `Carga resultante viable: ${liveCalculation.projected}h de ${limitHours}h permitidas`}
            </span>
          </div>
          <strong>{liveCalculation.isOverloaded ? 'Conflicto persistente' : 'Conflicto resuelto'}</strong>
        </div>

        {/* Botones de acción */}
        <div
          className="confirm-dialog-actions"
          style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn-sec-pro btn-small"
              onClick={handlePostpone}
              disabled={isSubmitting}
              title="Mover de estado a pospuesta (no sumará carga)"
            >
              Posponer gestión
            </button>
            <button
              type="button"
              className="btn-danger-ghost btn-small"
              onClick={handleForceSave}
              disabled={isSubmitting}
              title="Guardar de todas formas a pesar de la sobrecarga"
            >
              Ignorar y forzar
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
              {isSubmitting ? 'Guardando...' : 'Confirmar solución'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}