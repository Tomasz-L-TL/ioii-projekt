import { useState } from 'react';
import {
  formatDate,
  hours,
  lessonRange,
  rooms,
  students,
  time,
} from '../demo/data';
import type { ShowPreview } from './Preview';

export function BookingForm({
  block = false,
  showPreview,
}: {
  block?: boolean;
  showPreview: ShowPreview;
}) {
  const [room, setRoom] = useState('A-101');
  const [student, setStudent] = useState(students[0]);
  const [date, setDate] = useState('2026-10-20');
  const [hour, setHour] = useState(9);
  const [slots, setSlots] = useState(2);
  const [reason, setReason] = useState('');
  const minutes = slots === 1 ? 45 : 90;
  const summary = (
    <>
      <p>
        <strong>
          {room} · {date ? formatDate(date) : 'Wybierz dzień'}
        </strong>
      </p>
      {!block && (
        <p>
          Zajęcia {lessonRange(hour, minutes)} ({minutes} min).
        </p>
      )}
      <p>
        Zajętość {time(hour)}–{time(hour + slots)} ({slots * 60} min,{' '}
        {slots === 1 ? '1 slot' : '2 sloty'}).
      </p>
      {block ? (
        <p>Powód: {reason || 'Nie podano (opcjonalny).'}</p>
      ) : (
        <p>
          Właściciel: <strong>{student}</strong>
          <br />
          Inicjator: Administrator demo.
        </p>
      )}
    </>
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        showPreview({
          title: block
            ? 'Projekt potwierdzenia blokady'
            : 'Projekt potwierdzenia rezerwacji',
          content: (
            <>
              {summary}
              {block && (
                <p className="warning">
                  Scenariusz poglądowy: 1 przyszła rezerwacja do anulowania. Ta
                  przykładowa liczba nie jest obliczana z wybranego terminu; API
                  wyliczy ją przed rzeczywistym potwierdzeniem.
                </p>
              )}
              <p>
                {block
                  ? 'Utworzenie blokady i anulowania będą atomowe. Usunięcie blokady nie odtworzy anulowanych.'
                  : 'API zweryfikuje przyszłość, harmonogram, aktywność sali oraz konflikty sali, studenta i blokad.'}
              </p>
            </>
          ),
          confirm: true,
        });
      }}
    >
      <div className="form-grid">
        {!block && (
          <label>
            Student — właściciel
            <select
              value={student}
              onChange={(event) => setStudent(event.target.value)}
            >
              {students.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          Sala{block ? '' : ' aktywna'}
          <select
            value={room}
            onChange={(event) => setRoom(event.target.value)}
          >
            {rooms
              .filter((item) => block || item.active)
              .map((item) => (
                <option key={item.number} value={item.number}>
                  {item.number} · {item.capacity} miejsc
                  {!item.active ? ' · nieaktywna' : ''}
                </option>
              ))}
          </select>
        </label>
        <label>
          Dzień (Europe/Warsaw)
          <input
            required
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label>
          Start — pełna godzina
          <select
            value={hour}
            onChange={(event) => setHour(Number(event.target.value))}
          >
            {hours.map((value) => (
              <option
                key={value}
                value={value}
                disabled={slots === 2 && value === 22}
              >
                {time(value)}
                {slots === 2 && value === 22
                  ? ' — niedozwolone dla 2 slotów'
                  : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          {block ? 'Długość blokady' : 'Czas zajęć'}
          <select
            value={slots}
            onChange={(event) => {
              const value = Number(event.target.value);
              setSlots(value);
              if (value === 2 && hour === 22) setHour(21);
            }}
          >
            <option value={1}>
              {block ? '1 slot · 60 min' : '45 min · zajętość 60 min'}
            </option>
            <option value={2}>
              {block ? '2 sloty · 120 min' : '90 min · zajętość 120 min'}
            </option>
          </select>
        </label>
        {block && (
          <label className="full-width">
            Powód (opcjonalny)
            <textarea
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Np. prace techniczne"
            />
          </label>
        )}
      </div>
      <div className="summary-card">
        <h3>{block ? 'Podgląd terminu blokady' : 'Podsumowanie rezerwacji'}</h3>
        {summary}
      </div>
      <p className="muted">
        Pon.–pt., starty 07:00–22:00; dwa sloty najpóźniej od 21:00. Faktyczną
        dostępność i wszystkie reguły zweryfikuje dopiero API.
      </p>
      <button className="primary" type="submit">
        {block
          ? 'Utwórz blokadę — podgląd skutków'
          : 'Podgląd potwierdzenia rezerwacji'}
      </button>
    </form>
  );
}
