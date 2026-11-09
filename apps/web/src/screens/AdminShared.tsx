import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError, errorMessage } from '../api/client';
import type {
  AvailabilityDto,
  BookingInput,
  ImpactDto,
  SlotDto,
} from '../api/types';
import { addDays, formatDate, lessonRange, time } from '../dates';
import { useLifetime } from '../useResource';

export function useAdminAction(refresh: () => void) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const lock = useRef(false);
  const lifetime = useLifetime();
  async function run<T>(
    task: (signal: AbortSignal) => Promise<T>,
    done: (value: T) => void,
    mutation = true,
  ) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError('');
    setNotice('');
    const signal = lifetime.current.signal;
    try {
      const result = await task(signal);
      if (!signal.aborted) done(result);
    } catch (error) {
      if (!signal.aborted)
        setError(
          `${errorMessage(error)}${error instanceof ApiError && error.code === 'PREVIEW_STALE' ? ' Skutki mogły się zmienić. Pobierz nowy podgląd i potwierdź go ponownie.' : mutation && error instanceof ApiError && (error.status === 0 || error.code === 'INVALID_RESPONSE') ? ' Wynik zapisu jest nieznany. Sprawdź odświeżone dane przed kolejną próbą.' : ''}`,
        );
    } finally {
      lock.current = false;
      if (!signal.aborted) {
        setPending(false);
        if (mutation) refresh();
      }
    }
  }
  return { run, pending, error, notice, setNotice, setError };
}
export function Feedback({
  action,
}: {
  action: ReturnType<typeof useAdminAction>;
}) {
  return (
    <>
      <p role="status">
        {action.notice}
        {action.pending ? ' Trwa operacja…' : ''}
      </p>
      <p role="alert">{action.error}</p>
    </>
  );
}
export function ResourceState({
  resource,
  label,
}: {
  resource: { loading: boolean; error?: string; refresh: () => void };
  label: string;
}) {
  return (
    <>
      {resource.loading && <p role="status">Wczytuję {label}…</p>}
      {resource.error && (
        <div role="alert" className="notice">
          {resource.error}
          <button onClick={resource.refresh}>Ponów odczyt: {label}</button>
        </div>
      )}
    </>
  );
}
export function ImpactSummary({
  impact,
  children,
}: {
  impact: ImpactDto;
  children: ReactNode;
}) {
  return (
    <>
      {children}
      <p>
        <strong>
          Liczba rezerwacji do anulowania: {impact.cancellationCount}
        </strong>
      </p>
      <p>
        Operacja zachowa historię anulowań. Aktywacja sali ani usunięcie blokady
        ich nie przywróci. Również brak anulowań wymaga potwierdzenia.
      </p>
      <p>
        Podgląd jest ważny przez 5 minut. Zmiana danych wymaga nowego podglądu i
        ponownego zatwierdzenia.
      </p>
    </>
  );
}
export function TermSummary({
  term,
  block = false,
}: {
  term: BookingInput;
  block?: boolean;
}) {
  return (
    <p>
      {formatDate(term.date, true)} · Europe/Warsaw
      <br />
      {!block && (
        <>
          Zajęcia{' '}
          {lessonRange(term.startHour, term.durationSlots === 1 ? 45 : 90)} ·{' '}
          {term.durationSlots === 1 ? 45 : 90} min
          <br />
        </>
      )}
      Zajętość {time(term.startHour)}–
      {time(term.startHour + term.durationSlots)} · {term.durationSlots * 60}{' '}
      min ({term.durationSlots} {term.durationSlots === 1 ? 'slot' : 'sloty'})
    </p>
  );
}
export function canSelect(
  slots: SlotDto[],
  index: number,
  duration: 1 | 2,
  block: boolean,
) {
  if (index + duration > 16) return false;
  return slots
    .slice(index, index + duration)
    .every(
      (slot) =>
        !slot.past &&
        (block ? slot.status !== 'BLOCKED' : slot.status === 'AVAILABLE'),
    );
}
const slotLabels = {
  AVAILABLE: 'Wolny',
  RESERVED: 'Zarezerwowany',
  BLOCKED: 'Zablokowany',
  INACTIVE: 'Sala nieaktywna',
  PAST: 'Przeszły',
};
export function WeekGrid({
  snapshot,
  duration,
  selection,
  onSelect,
  pending,
  block = false,
}: {
  snapshot: AvailabilityDto;
  duration: 1 | 2;
  selection: BookingInput | null;
  onSelect: (term: BookingInput) => void;
  pending: boolean;
  block?: boolean;
}) {
  return (
    <div
      className="table-scroll calendar-scroll"
      tabIndex={0}
      role="region"
      aria-label="Kalendarz administratora"
    >
      <table className="calendar-table">
        <caption>Poniedziałek–piątek · 07:00–22:00 · Europe/Warsaw</caption>
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
          {Array.from({ length: 16 }, (_, i) => i + 7).map((hour) => (
            <tr key={hour}>
              <th scope="row">{time(hour)}</th>
              {snapshot.days.map((day) => {
                const slot = day.slots[hour - 7]!;
                const chosen =
                  selection?.date === day.date &&
                  hour >= selection.startHour &&
                  hour < selection.startHour + duration;
                return (
                  <td
                    key={day.date}
                    data-date={day.date}
                    data-hour={hour}
                    className={`${chosen ? 'selected' : slot.status.toLowerCase()}${chosen && duration === 2 ? ' paired' : ''}`}
                  >
                    <button
                      type="button"
                      disabled={
                        pending ||
                        !canSelect(day.slots, hour - 7, duration, block)
                      }
                      aria-pressed={Boolean(chosen)}
                      aria-label={`${formatDate(day.date)}, ${time(hour)}: ${slotLabels[slot.status]}${slot.past ? ', przeszły' : ''}`}
                      onClick={() =>
                        onSelect({
                          roomId: snapshot.roomId,
                          date: day.date,
                          startHour: hour,
                          durationSlots: duration,
                        })
                      }
                    >
                      {chosen
                        ? `Wybrany · slot ${hour - selection!.startHour + 1}/${duration}`
                        : slotLabels[slot.status]}
                      {slot.past && <small>Przeszły</small>}
                      {hour === 22 && duration === 2 && (
                        <small>Wymagane dwa sloty; ostatni start 21:00</small>
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function WeekPicker({
  week,
  setWeek,
  pending,
}: {
  week: string;
  setWeek: (value: string) => void;
  pending: boolean;
}) {
  return (
    <div className="card calendar-controls">
      <button
        disabled={pending}
        aria-label="Poprzedni tydzień"
        onClick={() => setWeek(addDays(week, -7))}
      >
        ←
      </button>
      <label>
        Tydzień zawierający datę
        <input
          type="date"
          required
          value={week}
          disabled={pending}
          onChange={(event) => {
            if (event.target.value) setWeek(event.target.value);
          }}
        />
      </label>
      <button
        disabled={pending}
        aria-label="Następny tydzień"
        onClick={() => setWeek(addDays(week, 7))}
      >
        →
      </button>
    </div>
  );
}
