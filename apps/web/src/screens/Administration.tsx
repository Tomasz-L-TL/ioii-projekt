import { BookingForm } from '../components/BookingForm';
import { StateExamples, type ShowPreview } from '../components/Preview';

export function Blocks({ showPreview }: { showPreview: ShowPreview }) {
  return (
    <>
      <p className="intro">
        Czasowe wyłączenie sali z rezerwacji. Blokada dotyczy 1 lub 2 pełnych
        slotów systemowych.
      </p>
      <section className="card">
        <h3>Przykładowa blokada</h3>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Lista blokad"
        >
          <table>
            <caption>Fikcyjny scenariusz blokady, bez zapisu</caption>
            <thead>
              <tr>
                <th scope="col">Sala / dzień</th>
                <th scope="col">Zajętość</th>
                <th scope="col">Powód</th>
                <th scope="col">Działanie</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>A-102</strong>
                  <small>21.10.2026</small>
                </td>
                <td>
                  12:00–14:00<small>2 sloty · 120 min</small>
                </td>
                <td>Prace techniczne</td>
                <td>
                  <button
                    onClick={() =>
                      showPreview({
                        title: 'Projekt usunięcia blokady',
                        content: (
                          <>
                            <p>A-102 · 21.10.2026 · 12:00–14:00.</p>
                            <p>
                              Usunięcie blokady zwolni termin do nowych
                              rezerwacji, ale nie przywróci wcześniej
                              anulowanych. Pozostałe ograniczenia dostępności
                              nadal obowiązują.
                            </p>
                          </>
                        ),
                        confirm: true,
                      })
                    }
                  >
                    Usuń — podgląd
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <span className="eyebrow">Projekt formularza</span>
        <h3>Nowa blokada</h3>
        <BookingForm block showPreview={showPreview} />
      </section>
      <StateExamples showPreview={showPreview} admin />
    </>
  );
}

export function StudentBooking({ showPreview }: { showPreview: ShowPreview }) {
  return (
    <>
      <p className="intro">
        Administrator wskazuje studenta jako właściciela. Konto administracyjne
        jest wyłącznie inicjatorem rezerwacji.
      </p>
      <p className="notice">
        <strong>Wyjątek dla działania administratora:</strong> brak limitu +14
        dni i 3 przyszłych aktywnych rezerwacji. Nadal obowiązują przyszłość
        terminu, dni i godziny harmonogramu, aktywna sala oraz brak konfliktów
        sali, studenta i blokad.
      </p>
      <section className="card">
        <span className="eyebrow">Dane fikcyjne · bez zapisu</span>
        <h3>Student i termin</h3>
        <BookingForm showPreview={showPreview} />
      </section>
      <StateExamples showPreview={showPreview} admin />
    </>
  );
}
