import { useState } from 'react';
import { StateExamples, type ShowPreview } from '../components/Preview';
import {
  bookings,
  formatDate,
  lessonRange,
  time,
  type Booking,
} from '../demo/data';

export function Reservations({
  admin = false,
  showPreview,
}: {
  admin?: boolean;
  showPreview: ShowPreview;
}) {
  const [category, setCategory] = useState(admin ? 'Wszystkie' : 'Nadchodząca');
  const [query, setQuery] = useState('');
  const list = bookings.filter(
    (item) =>
      (admin || item.owner === 'Student 01') &&
      (category === 'Wszystkie' || item.state === category) &&
      `${item.owner} ${item.room} ${item.initiator}`
        .toLocaleLowerCase('pl')
        .includes(query.toLocaleLowerCase('pl')),
  );
  const cancel = (item: Booking) =>
    showPreview({
      title: 'Projekt potwierdzenia anulowania',
      content: (
        <>
          <p>
            <strong>
              {item.owner} · {item.room} · {formatDate(item.date)}
            </strong>
          </p>
          <p>
            Zajęcia {lessonRange(item.hour, item.minutes)} ({item.minutes} min).
            Zajętość:{' '}
            {item.minutes === 90 ? '120 min, 2 sloty' : '60 min, 1 slot'}.
          </p>
          <p>
            Docelowo termin zostanie zwolniony, a wpis pozostanie w historii
            wraz z czasem, przyczyną i inicjatorem anulowania:{' '}
            {admin ? 'Administrator demo' : 'Student 01'}.
          </p>
          <p>
            API ponownie sprawdzi własność, rolę, aktywność i przyszłość
            początku. Ta demonstracja nie zmieni listy.
          </p>
        </>
      ),
      confirm: true,
    });

  return (
    <>
      <p className="intro">
        {admin
          ? 'Wspólny podgląd rezerwacji studentów, ich inicjatorów i historii.'
          : 'Fikcyjne rezerwacje Studenta 01, także utworzone przez administratora.'}{' '}
        Stany czasowe odnoszą się do stałego zegara demonstracji.
      </p>
      <section className="card">
        {admin ? (
          <div className="form-grid">
            <label>
              Szukaj właściciela, sali lub inicjatora
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Np. Student 01 lub A-101"
              />
            </label>
            <label>
              Stan rezerwacji
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option>Wszystkie</option>
                <option value="Nadchodząca">Nadchodzące</option>
                <option value="Zakończona">Historia zakończonych</option>
                <option value="Anulowana">Anulowane</option>
              </select>
            </label>
          </div>
        ) : (
          <div className="segmented" aria-label="Kategorie rezerwacji">
            {(
              [
                ['Nadchodząca', 'Nadchodzące'],
                ['Zakończona', 'Historia'],
                ['Anulowana', 'Anulowane'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                aria-pressed={category === value}
                onClick={() => setCategory(value)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <p className="muted">
          Wyniki demonstracyjne: {list.length}.{' '}
          {admin
            ? 'Przeszłych i już anulowanych wpisów nie można anulować.'
            : 'Anulowanie jest dostępne tylko dla własnej przyszłej aktywnej rezerwacji.'}
        </p>
        {list.length === 0 ? (
          <div className="empty-state">
            <h3>Brak pasujących rezerwacji</h3>
            <p>Zmień filtr lub wyszukiwane hasło.</p>
            <button
              onClick={() => {
                setQuery('');
                setCategory(admin ? 'Wszystkie' : 'Nadchodząca');
              }}
            >
              Wyczyść filtry
            </button>
          </div>
        ) : (
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Lista rezerwacji"
          >
            <table>
              <caption>
                {admin
                  ? 'Rezerwacje wszystkich studentów — dane fikcyjne'
                  : 'Własne rezerwacje Studenta 01 — dane fikcyjne'}
              </caption>
              <thead>
                <tr>
                  {admin && <th scope="col">Właściciel</th>}
                  <th scope="col">Sala / data</th>
                  <th scope="col">Zajęcia / zajętość</th>
                  <th scope="col">Stan</th>
                  <th scope="col">Inicjator utworzenia</th>
                  <th scope="col">Działanie / historia</th>
                </tr>
              </thead>
              <tbody>
                {list.map((item) => (
                  <tr key={item.id}>
                    {admin && (
                      <td>
                        <strong>{item.owner}</strong>
                        <small>{item.id}</small>
                      </td>
                    )}
                    <td>
                      <strong>{item.room}</strong>
                      <small>{formatDate(item.date)}</small>
                    </td>
                    <td>
                      {lessonRange(item.hour, item.minutes)} · {item.minutes}{' '}
                      min
                      <small>
                        Zajętość {time(item.hour)}–
                        {time(item.hour + (item.minutes === 90 ? 2 : 1))}
                        <br />
                        {item.minutes === 90
                          ? '120 min · 2 sloty'
                          : '60 min · 1 slot'}
                      </small>
                    </td>
                    <td>
                      <span
                        className={`badge ${item.state === 'Nadchodząca' ? 'active' : 'neutral'}`}
                      >
                        {item.state}
                      </span>
                      <small>
                        {item.state === 'Anulowana'
                          ? 'Status: anulowana'
                          : 'Status: aktywna'}
                        {item.state === 'Zakończona' &&
                          ' · zakończenie wynika z czasu'}
                      </small>
                    </td>
                    <td>{item.initiator}</td>
                    <td>
                      {item.state === 'Nadchodząca' && (
                        <button onClick={() => cancel(item)}>
                          Anuluj — podgląd
                        </button>
                      )}
                      {item.cancellation && (
                        <details>
                          <summary>Historia anulowania</summary>
                          <p>
                            {item.cancellation.date}
                            <br />
                            Europe/Warsaw
                            <br />
                            {item.cancellation.initiator}
                            <br />
                            {item.cancellation.reason}
                          </p>
                        </details>
                      )}
                      {item.state === 'Zakończona' && (
                        <span className="muted">Brak dostępnych akcji</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {admin && (
        <p className="notice">
          Anulowanie zachowa czas, inicjatora i przyczynę w historii.
          Rozpoczętych, zakończonych i anulowanych wpisów nie będzie można
          zmieniać tą akcją.
        </p>
      )}
      <StateExamples showPreview={showPreview} admin={admin} cancellation />
    </>
  );
}
