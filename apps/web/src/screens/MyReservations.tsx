import { useRef, useState } from 'react';
import type { Api } from '../api';
import { ApiError, errorMessage } from '../api/client';
import type { BookingDto } from '../api/types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatDate, formatTimestamp, lessonRange, time } from '../dates';
import { useLifetime } from '../useResource';

const states = {
  UPCOMING: 'Nadchodząca',
  STARTED: 'Rozpoczęta',
  COMPLETED: 'Zakończona',
  CANCELLED: 'Anulowana',
};
const reasons = {
  STUDENT_CANCELLED: 'Anulowanie przez studenta',
  ADMIN_CANCELLED: 'Anulowanie przez administratora',
  ROOM_DEACTIVATED: 'Dezaktywacja sali',
  TIME_BLOCKED: 'Blokada terminu',
};
type Resource = {
  data?: BookingDto[];
  error?: string;
  loading: boolean;
  refresh: () => void;
};
export function MyReservations({
  api,
  resource,
  onChanged,
}: {
  api: Api;
  resource: Resource;
  onChanged: () => void;
}) {
  const [category, setCategory] = useState('UPCOMING');
  const [target, setTarget] = useState<BookingDto | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const sending = useRef(false);
  const lifetime = useLifetime();
  const list = resource.data?.filter((item) =>
    category === 'HISTORY'
      ? item.state === 'STARTED' || item.state === 'COMPLETED'
      : item.state === category,
  );
  async function cancel() {
    if (!target || sending.current) return;
    sending.current = true;
    setPending(true);
    setError('');
    const signal = lifetime.current.signal;
    try {
      const result = await api.cancel(target.id, signal);
      if (signal.aborted) return;
      setTarget(null);
      setCategory('CANCELLED');
      setNotice(
        `Anulowano rezerwację #${result.id}. Termin zwolniono, a wpis pozostał w historii.`,
      );
      onChanged();
    } catch (error) {
      if (signal.aborted) return;
      setError(
        `${errorMessage(error)}${error instanceof ApiError && (error.status === 0 || error.code === 'INVALID_RESPONSE') ? ' Wynik anulowania jest nieznany. Sprawdź odświeżoną listę przed ponowieniem.' : ''}`,
      );
      setTarget(null);
      onChanged();
    } finally {
      sending.current = false;
      if (!signal.aborted) setPending(false);
    }
  }
  return (
    <>
      <p className="intro">
        Twoje rzeczywiste rezerwacje, również utworzone w Twoim imieniu przez
        administratora. Stany i możliwość anulowania pochodzą z API; lista
        odświeża się co minutę i po powrocie do okna.
      </p>
      <p role="status">{notice}</p>
      <p role="alert">{error}</p>
      <section className="card">
        <div className="section-toolbar">
          <div className="segmented" aria-label="Kategorie rezerwacji">
            {(
              [
                ['UPCOMING', 'Nadchodzące'],
                ['HISTORY', 'Historia'],
                ['CANCELLED', 'Anulowane'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                aria-pressed={category === value}
                disabled={pending}
                onClick={() => setCategory(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <button disabled={pending} onClick={resource.refresh}>
            Odśwież listę
          </button>
        </div>
        {resource.loading && <p role="status">Wczytuję rezerwacje…</p>}
        {resource.error && (
          <div role="alert" className="notice">
            {resource.error}
            <button onClick={resource.refresh}>Ponów odczyt rezerwacji</button>
          </div>
        )}
        {list && (
          <>
            <p className="muted">
              Wyniki: {list.length}. Anulowanie jest dostępne wyłącznie, gdy
              pozwala na to aktualny stan serwera.
            </p>
            {list.length === 0 ? (
              <div className="empty-state">
                <h3>Brak rezerwacji w tej kategorii</h3>
                <p>
                  Wybierz inny filtr lub zarezerwuj przyszły termin w
                  kalendarzu.
                </p>
              </div>
            ) : (
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Lista rezerwacji"
              >
                <table>
                  <caption>Własne rezerwacje i historia</caption>
                  <thead>
                    <tr>
                      <th scope="col">Sala / data</th>
                      <th scope="col">Zajęcia / zajętość</th>
                      <th scope="col">Stan</th>
                      <th scope="col">Inicjator utworzenia</th>
                      <th scope="col">Działanie / historia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((item) => (
                      <tr key={item.id} data-booking-id={item.id}>
                        <td>
                          <strong>{item.room.roomNumber}</strong>
                          <small>
                            {item.room.name || 'Sala bez nazwy'} ·{' '}
                            {item.room.capacity} miejsc
                          </small>
                          <small>
                            {formatDate(item.date)} · #{item.id}
                          </small>
                        </td>
                        <td>
                          {lessonRange(item.startHour, item.lessonMinutes)} ·{' '}
                          {item.lessonMinutes} min
                          <small>
                            Zajętość {time(item.startHour)}–
                            {time(item.startHour + item.durationSlots)} ·{' '}
                            {item.occupiedMinutes} min
                          </small>
                        </td>
                        <td>
                          <span
                            className={`badge ${item.state === 'UPCOMING' ? 'active' : 'neutral'}`}
                          >
                            {states[item.state]}
                          </span>
                          <small>Status: {item.status}</small>
                        </td>
                        <td>
                          {item.createdBy.displayName}
                          <small>
                            {item.createdBy.role === 'ADMIN'
                              ? 'Administrator'
                              : 'Student'}{' '}
                            · {formatTimestamp(item.createdAt)} Europe/Warsaw
                          </small>
                        </td>
                        <td>
                          {item.canCancel && (
                            <button
                              disabled={pending}
                              onClick={() => {
                                setTarget(item);
                                setError('');
                                setNotice('');
                              }}
                            >
                              Anuluj
                            </button>
                          )}
                          {item.cancelledAt && (
                            <details>
                              <summary>Historia anulowania</summary>
                              <p>
                                {formatTimestamp(item.cancelledAt)}{' '}
                                Europe/Warsaw
                                <br />
                                {item.cancelReason
                                  ? reasons[item.cancelReason]
                                  : 'Brak przyczyny'}
                                <br />
                                Przyczyna: {item.cancelReason}
                                <br />
                                ID anulującego:{' '}
                                {item.cancelledByUserId ?? 'brak'}
                              </p>
                            </details>
                          )}
                          {!item.canCancel && !item.cancelledAt && (
                            <span className="muted">Brak dostępnych akcji</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
      {target && (
        <ConfirmDialog
          title={`Anulować rezerwację #${target.id}?`}
          pending={pending}
          error=""
          onClose={() => setTarget(null)}
          onConfirm={cancel}
          confirmLabel="Potwierdź anulowanie"
        >
          <p>
            <strong>
              {target.room.roomNumber} · {formatDate(target.date)}
            </strong>
          </p>
          <p>
            {lessonRange(target.startHour, target.lessonMinutes)} ·{' '}
            {target.lessonMinutes} min zajęć / {target.occupiedMinutes} min
            zajętości.
          </p>
          <p>
            Termin zostanie zwolniony. Rekord i dane anulowania pozostaną w
            historii. API ponownie sprawdzi, czy można anulować rezerwację.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
