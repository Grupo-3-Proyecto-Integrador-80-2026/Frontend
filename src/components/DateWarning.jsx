import { IconAlertTriangle } from './Icons'
import { formatDateFromISO } from '../utils/validators'

/**
 * Aviso permanente en la tarjeta de una gestión cuya fecha objetivo quedó después
 * de la fecha del evento (p. ej. porque el evento se adelantó). No bloquea nada:
 * desaparece cuando el organizador cambia la fecha de la gestión.
 */
export default function DateWarning({ eventDate }) {
  return (
    <p className="task-date-warning" role="note">
      <IconAlertTriangle size={16} />
      <span>
        Esta gestión quedó después de la fecha del evento ({formatDateFromISO(eventDate)}).
        Cambia su fecha objetivo.
      </span>
    </p>
  )
}
