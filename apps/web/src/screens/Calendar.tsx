import { useState } from 'react';
import { StateExamples, type ShowPreview } from '../components/Preview';
import {
  dateAt,
  formatDate,
  hours,
  lessonRange,
  rooms,
  time,
  weekdays,
} from '../demo/data';

type SlotState = 'free' | 'reserved' | 'blocked' | 'forbidden' | 'selected';
const labels: Record<SlotState, string> = {
  free: 'Wolny',
  reserved: 'Zarezerwowany',
  blocked: 'Zablokowany',
  forbidden: 'Niedozwolony',
  selected: 'Wybrany',
};

export function Calendar({ showPreview }: { showPreview: ShowPreview }) {
  const [room, setRoom] = useState('A-101');
  const [week, setWeek] = useState(0);
  const [minutes, setMinutes] = useState(90);
  const [selection, setSelection] = useState<{
    day: number;
    hour: number;
  } | null>(null);
  const slots = minutes === 90 ? 2 : 1;
  function baseState(day: number, hour: number): SlotState {
    // Wyłącznie schemat prezentacyjny; nie sprawdza rzeczywistych konfliktów.
    const offset = week * 7 + day;
    if (offset < 0 || offset > 14 || (offset === 0 && hour <= 8))
      return 'forbidden';
    if (day === 1 && (hour === 9 || hour === 10)) return 'reserved';
    if (day === 2 && (hour === 12 || hour === 13)) return 'blocked';
    return 'free';
  }
  function stateAt(day: number, hour: number): SlotState {
    const base = baseState(day, hour);
    if (base !== 'free') return base;
    if (
      selection?.day === day &&
      hour >= selection.hour &&
      hour < selection.hour + slots
    )
      return 'selected';
    if (minutes === 90 && (hour === 22 || baseState(day, hour + 1) !== 'free'))
      return 'forbidden';
    return 'free';
  }
  const summary = selection ? (
    <>
      <p>
        <strong>
          {room} · {weekdays[selection.day]},{' '}
          {formatDate(dateAt(week * 7 + selection.day))}
        </strong>
      </p>
      <p>
        Zajęcia {lessonRange(selection.hour, minutes)} · {minutes} min
        <br />
        Zajętość {time(selection.hour)}–{time(selection.hour + slots)} ·{' '}
        {slots * 60} min ({slots === 1 ? '1 slot' : '2 sloty'})
      </p>
      <p>Właściciel i inicjator: Student 01 (fikcyjny).</p>
    </>
  ) : (
    <p>
      Wybierz wolny termin w kalendarzu, aby zobaczyć czas zajęć i zajętość
      sali.
    </p>
  );

  return (
    <>
      <div className="card calendar-controls">
        <label>
          Aktywna sala
          <select
            value={room}
            onChange={(event) => {
              setRoom(event.target.value);
              setSelection(null);
            }}
          >
            {rooms
              .filter((item) => item.active)
              .map((item) => (
                <option key={item.number} value={item.number}>
                  {item.number} · {item.name || 'Sala bez nazwy'} ·{' '}
                  {item.capacity} miejsc
                </option>
              ))}
          </select>
        </label>
        <label>
          Czas zajęć
          <select
            value={minutes}
            onChange={(event) => {
              setMinutes(Number(event.target.value));
              setSelection(null);
            }}
          >
            <option value={45}>45 min · 1 slot (60 min)</option>
            <option value={90}>90 min · 2 sloty (120 min)</option>
          </select>
        </label>
        <div className="week-picker">
          <span className="field-label">Tydzień</span>
          <div className="actions">
            <button
              onClick={() => {
                setWeek(week - 1);
                setSelection(null);
              }}
              aria-label="Poprzedni tydzień"
            >
              ←
            </button>
            <span>
              {formatDate(dateAt(week * 7))} –{' '}
              {formatDate(dateAt(week * 7 + 4))}
            </span>
            <button
              onClick={() => {
                setWeek(week + 1);
                setSelection(null);
              }}
              aria-label="Następny tydzień"
            >
              →
            </button>
          </div>
        </div>
      </div>
      <p className="muted">
        Schemat fikcyjnych rezerwacji i blokad powtarza się dla każdej sali i
        tygodnia. Niedozwolone terminy zilustrowano względem zegara demo. API
        dopiero zweryfikuje dostępność, limit 3 oraz +14 dni.
      </p>
      <div className="legend" aria-label="Legenda kalendarza">
        {Object.entries(labels).map(([state, label]) => (
          <span className={`legend-item ${state}`} key={state}>
            <i />
            {label}
          </span>
        ))}
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
              {weekdays.map((day, index) => (
                <th scope="col" key={day}>
                  {day}
                  <small>{formatDate(dateAt(week * 7 + index))}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hours.map((hour) => (
              <tr key={hour}>
                <th scope="row">{time(hour)}</th>
                {weekdays.map((day, index) => {
                  const state = stateAt(index, hour);
                  const isPair = state === 'reserved' || state === 'selected';
                  const part =
                    state === 'reserved'
                      ? hour - 8
                      : selection
                        ? hour - selection.hour + 1
                        : 1;
                  const paired =
                    isPair && (state === 'reserved' || slots === 2);
                  const detail = paired
                    ? `${state === 'reserved' ? '90 min' : 'Wybór'} · slot ${part}/2`
                    : labels[state];
                  const forbiddenReason =
                    hour === 22 && minutes === 90
                      ? '22:00 nie jest startem 90-minutowym'
                      : 'Przykład ograniczenia terminu lub braku dwóch wolnych slotów';
                  return (
                    <td
                      key={day}
                      className={`${state}${paired ? ' paired' : ''}`}
                    >
                      <button
                        type="button"
                        disabled={state !== 'free' && state !== 'selected'}
                        aria-pressed={state === 'selected'}
                        aria-label={`${day}, ${formatDate(dateAt(week * 7 + index))}, ${time(hour)}: ${detail}${state === 'forbidden' ? `. ${forbiddenReason}` : ''}`}
                        onClick={() =>
                          setSelection({
                            day: index,
                            hour:
                              state === 'selected' && selection
                                ? selection.hour
                                : hour,
                          })
                        }
                      >
                        <span>{detail}</span>
                        {paired && (
                          <small>
                            {state === 'reserved' ? 'Zarezerwowany' : 'Wybrany'}
                          </small>
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
      <div className="calendar-bottom">
        <section className="summary-card">
          <h3>Wybrany termin</h3>
          <div aria-live="polite" aria-atomic="true">
            {summary}
          </div>
          <button
            className="primary"
            disabled={!selection}
            onClick={() =>
              showPreview({
                title: 'Projekt potwierdzenia rezerwacji',
                content: (
                  <>
                    {summary}
                    <p>
                      Podgląd nie gwarantuje dostępności. Zapis i pełna
                      weryfikacja reguł będą realizowane przez API.
                    </p>
                  </>
                ),
                confirm: true,
              })
            }
          >
            Podgląd potwierdzenia
          </button>
        </section>
        <aside className="card">
          <h3>Dwie godziny w kalendarzu</h3>
          <p>
            45 min zajęć zajmuje 60 min sali.
            <br />
            90 min zajęć zajmuje 120 min sali.
          </p>
          <p>
            Pozostały czas to bufor. Rezerwacja 90 min jest pokazana w dwóch
            sąsiednich komórkach.
          </p>
          <p>
            <strong>22:00 nie jest startem 90-minutowym.</strong> Ostatni start
            to 21:00. Dla 45 min można wybrać 22:00, z zajętością do 23:00.
          </p>
        </aside>
      </div>
      <StateExamples showPreview={showPreview} />
    </>
  );
}
