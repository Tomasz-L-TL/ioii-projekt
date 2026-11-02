import { useCallback, useRef, useState } from 'react';
import type { Api } from '../api';
import { ApiError, errorMessage } from '../api/client';
import type { AvailabilityDto, BookingInput, SlotStatus } from '../api/types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  addDays,
  formatDate,
  lessonRange,
  monday,
  time,
  warsawToday,
} from '../dates';
import { useLifetime, useResource } from '../useResource';

const labels: Record<SlotStatus, string> = {
  AVAILABLE: 'Wolny',
  RESERVED: 'Zarezerwowany',
  BLOCKED: 'Zablokowany',
  INACTIVE: 'Sala nieaktywna',
  PAST: 'Przeszły',
};
const styles: Record<SlotStatus, string> = {
  AVAILABLE: 'free',
  RESERVED: 'reserved',
  BLOCKED: 'blocked',
  INACTIVE: 'inactive',
  PAST: 'past',
};
type Selection = BookingInput & { snapshot: AvailabilityDto };

export function Calendar({
  api,
  revision,
  onChanged,
}: {
  api: Api;
  revision: number;
  onChanged: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const rooms = useResource(api.rooms, revision, confirming || pending);
  const [chosenRoom, setChosenRoom] = useState<number | null>(null);
  const room =
    rooms.data?.find((item) => item.id === chosenRoom) ?? rooms.data?.[0];
  const roomId = room?.id;
  const [week, setWeek] = useState(() => monday());
  const [duration, setDuration] = useState<1 | 2>(1);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const sending = useRef(false);
  const lifetime = useLifetime();
  const load = useCallback(
    async (signal: AbortSignal) =>
      roomId === undefined ? null : api.availability(roomId, week, signal),
    [api, roomId, week],
  );
  const availability = useResource(load, revision, confirming || pending);
  const snapshot = availability.data;
  const selected =
    selection?.snapshot === snapshot &&
    selection?.roomId === roomId &&
    selection?.durationSlots === duration
      ? selection
      : null;
  const today = warsawToday();
  const horizon = addDays(today, 14);
  const allowedDate = (date: string) => date >= today && date <= horizon;
  const noFree =
    snapshot &&
    !snapshot.days.some((day) =>
      day.slots.some((slot) =>
        duration === 1 ? slot.available45 : slot.available90 && slot.fits90,
      ),
    );
  const clear = () => {
    setSelection(null);
    setConfirming(false);
    setError('');
    setNotice('');
  };
  const summary =
    selected && room ? (
      <>
        <p>
          <strong>
            {room.roomNumber} · {room.name || 'Sala bez nazwy'} ·{' '}
            {room.capacity} miejsc
          </strong>
        </p>
        <p>
          {formatDate(selected.date, true)}, {time(selected.startHour)} ·
          Europe/Warsaw
        </p>
        <p>
          Zajęcia {lessonRange(selected.startHour, duration === 1 ? 45 : 90)} ·{' '}
          {duration === 1 ? 45 : 90} min
          <br />
          Zajętość {time(selected.startHour)}–
          {time(selected.startHour + duration)} · {duration * 60} min (
          {duration} {duration === 1 ? 'slot' : 'sloty'})
        </p>
      </>
    ) : (
      <p>Wybierz przyszły wolny termin w kalendarzu.</p>
    );
  async function book() {
    if (!selected || sending.current || !allowedDate(selected.date)) return;
    sending.current = true;
    setPending(true);
    setError('');
    const signal = lifetime.current.signal;
    try {
      // Wyłącznie cztery pola kontraktu; właściciel wynika z sesji.
      const result = await api.book(
        {
          roomId: selected.roomId,
          date: selected.date,
          startHour: selected.startHour,
          durationSlots: selected.durationSlots,
        },
        signal,
      );
      if (signal.aborted) return;
      setNotice(
        `Zapisano rezerwację #${result.id}: ${result.room.roomNumber}, ${formatDate(result.date)}, ${time(result.startHour)}, ${result.lessonMinutes} min zajęć / ${result.occupiedMinutes} min zajętości.`,
      );
      setSelection(null);
      setConfirming(false);
      onChanged();
    } catch (error) {
      if (signal.aborted) return;
      setError(
        `${errorMessage(error)}${error instanceof ApiError && (error.status === 0 || error.code === 'INVALID_RESPONSE') ? ' Wynik zapisu jest nieznany. Sprawdź „Moje rezerwacje” przed kolejną próbą.' : ''}`,
      );
      setConfirming(false);
      setSelection(null);
      onChanged();
      if (
        error instanceof ApiError &&
        ['ROOM_INACTIVE', 'ROOM_NOT_FOUND'].includes(error.code)
      )
        rooms.refresh();
    } finally {
      sending.current = false;
      if (!signal.aborted) setPending(false);
    }
  }
  return (
    <>
      <div className="card calendar-controls">
        <label>
          Aktywna sala
          <select
            value={roomId ?? ''}
            disabled={!rooms.data?.length || pending}
            onChange={(event) => {
              setChosenRoom(Number(event.target.value));
              clear();
            }}
          >
            {!rooms.data?.length && (
              <option value="">
                {rooms.loading ? 'Wczytywanie sal…' : 'Brak sal'}
              </option>
            )}
            {rooms.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.roomNumber} · {item.name || 'Sala bez nazwy'} ·{' '}
                {item.capacity} miejsc
              </option>
            ))}
          </select>
        </label>
        <label>
          Czas zajęć
          <select
            value={duration}
            disabled={pending}
            onChange={(event) => {
              setDuration(event.target.value === '2' ? 2 : 1);
              clear();
            }}
          >
            <option value={1}>45 min · 1 slot (60 min)</option>
            <option value={2}>90 min · 2 sloty (120 min)</option>
          </select>
        </label>
        <div className="week-picker">
          <span className="field-label">Tydzień</span>
          <div className="actions">
            <button
              disabled={pending}
              aria-label="Poprzedni tydzień"
              onClick={() => {
                setWeek(addDays(week, -7));
                clear();
              }}
            >
              ←
            </button>
            <span>
              {formatDate(week)} – {formatDate(addDays(week, 4))}
            </span>
            <button
              disabled={pending}
              aria-label="Następny tydzień"
              onClick={() => {
                setWeek(addDays(week, 7));
                clear();
              }}
            >
              →
            </button>
          </div>
        </div>
      </div>
      <p className="muted">
        Dostępność jest wstępna. API przy zapisie sprawdza także konflikty z
        innymi salami i limit 3 przyszłych rezerwacji. Możesz przeglądać każdy
        tydzień; zapis tylko do {formatDate(horizon)} włącznie.
      </p>
      <div role="status">
        {rooms.loading
          ? 'Wczytuję sale…'
          : rooms.data?.length === 0
            ? 'Brak aktywnych sal. Rezerwacja nie jest możliwa.'
            : room && availability.loading
              ? 'Wczytuję dostępność…'
              : noFree
                ? 'Brak wolnych terminów dla wybranej długości.'
                : ''}
      </div>
      {rooms.error && (
        <div role="alert" className="notice">
          {rooms.error}
          <button onClick={rooms.refresh}>Ponów odczyt sal</button>
        </div>
      )}
      {room && availability.error && (
        <div role="alert" className="notice">
          {availability.error}
          <button
            onClick={() => {
              rooms.refresh();
              availability.refresh();
            }}
          >
            Ponów odczyt dostępności i sal
          </button>
        </div>
      )}
      <p role="status">{notice}</p>
      <p role="alert">{error}</p>
      {snapshot && (
        <>
          {snapshot.days.some((day) => !allowedDate(day.date)) && (
            <p className="notice">
              Terminy przeszłe i poza horyzontem +14 dni można oglądać, ale nie
              można ich rezerwować.
            </p>
          )}
          <div className="legend" aria-label="Legenda kalendarza">
            {Object.entries(labels).map(([status, label]) => (
              <span
                className={`legend-item ${styles[status as SlotStatus]}`}
                key={status}
              >
                <i />
                {label}
              </span>
            ))}
            <span className="legend-item selected">
              <i />
              Wybrany
            </span>
          </div>
          <div
            className="table-scroll calendar-scroll"
            tabIndex={0}
            role="region"
            aria-label="Kalendarz tygodniowy — przewijaj poziomo na małym ekranie"
          >
            <table className="calendar-table">
              <caption>
                Pełne starty 07:00–22:00 · poniedziałek–piątek · Europe/Warsaw
              </caption>
              <thead>
                <tr>
                  <th scope="col">Start</th>
                  {snapshot.days.map((day) => (
                    <th scope="col" key={day.date}>
                      {formatDate(day.date, true)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 16 }, (_, index) => index + 7).map(
                  (hour) => (
                    <tr key={hour}>
                      <th scope="row">{time(hour)}</th>
                      {snapshot.days.map((day) => {
                        const slot = day.slots[hour - 7]!;
                        const chosen =
                          selected?.date === day.date &&
                          hour >= selected.startHour &&
                          hour < selected.startHour + duration;
                        const available =
                          duration === 1
                            ? slot.available45
                            : slot.available90 && slot.fits90;
                        const reason = !allowedDate(day.date)
                          ? day.date > horizon
                            ? 'Poza horyzontem +14 dni'
                            : 'Data przeszła'
                          : !available && slot.status === 'AVAILABLE'
                            ? hour === 22 && duration === 2
                              ? '22:00 nie jest startem 90-minutowym'
                              : 'Brak dwóch wolnych slotów'
                            : '';
                        return (
                          <td
                            key={day.date}
                            data-date={day.date}
                            data-hour={hour}
                            data-status={slot.status}
                            className={`${chosen ? 'selected' : styles[slot.status]}${chosen && duration === 2 ? ' paired' : ''}`}
                          >
                            <button
                              type="button"
                              disabled={
                                pending ||
                                !allowedDate(day.date) ||
                                (!available && !chosen)
                              }
                              aria-pressed={Boolean(chosen)}
                              aria-label={`${formatDate(day.date, true)}, ${time(hour)}: ${labels[slot.status]}${slot.past ? ', przeszły' : ''}, ${duration === 1 ? 45 : 90} min zajęć${reason ? `. ${reason}` : ''}${chosen ? ', wybrany' : ''}`}
                              onClick={() => {
                                setSelection({
                                  roomId: snapshot.roomId,
                                  date: day.date,
                                  startHour:
                                    chosen && selected
                                      ? selected.startHour
                                      : hour,
                                  durationSlots: duration,
                                  snapshot,
                                });
                                setConfirming(false);
                                setError('');
                                setNotice('');
                              }}
                            >
                              <span>
                                {chosen
                                  ? `Wybrany · slot ${hour - selected!.startHour + 1}/${duration}`
                                  : labels[slot.status]}
                              </span>
                              {slot.past && slot.status !== 'PAST' && (
                                <small>Przeszły</small>
                              )}
                              {reason && <small>{reason}</small>}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div className="calendar-bottom">
        <section className="summary-card">
          <h3>Wybrany termin</h3>
          <div aria-live="polite" aria-atomic="true">
            {summary}
          </div>
          <button
            className="primary"
            disabled={!selected || pending || !allowedDate(selected.date)}
            onClick={() => setConfirming(true)}
          >
            Zarezerwuj termin
          </button>
        </section>
        <aside className="card">
          <h3>Dwie godziny w kalendarzu</h3>
          <p>
            45 min zajęć zajmuje 60 min sali.
            <br />
            90 min zajęć zajmuje 120 min sali.
          </p>
          <p>Pozostały czas to bufor. 90 min zaznacza dwa sąsiednie sloty.</p>
          <p>
            Ostatni start 90 min to 21:00. O 22:00 możliwy jest wyłącznie start
            45 min, z zajętością do 23:00.
          </p>
          <button
            disabled={pending}
            onClick={() => {
              clear();
              rooms.refresh();
              availability.refresh();
            }}
          >
            Odśwież kalendarz
          </button>
        </aside>
      </div>
      {selected && confirming && (
        <ConfirmDialog
          title="Potwierdź rezerwację"
          pending={pending}
          error=""
          onClose={() => setConfirming(false)}
          onConfirm={book}
          confirmLabel="Potwierdź rezerwację"
        >
          {summary}
          <p>
            Dostępność jest wstępna. Zatwierdzenie wyśle rezerwację do zapisu;
            serwer ponownie sprawdzi wszystkie reguły.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
