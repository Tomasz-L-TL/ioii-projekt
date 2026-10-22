import type { ShowPreview } from '../components/Preview';

export function Login({ showPreview }: { showPreview: ShowPreview }) {
  return (
    <div className="login-grid">
      <section className="welcome-panel">
        <span className="eyebrow">Miejsce na dobry pomysł</span>
        <h3>
          Wybierz salę.
          <br />
          Zaplanuj naukę.
        </h3>
        <p>
          Projekt lokalnej aplikacji do rezerwowania sal uczelnianych. Sprawdź
          planowane ścieżki studenta i administratora.
        </p>
        <div className="room-illustration" aria-hidden="true">
          <span>A-101</span>
          <i />
          <i />
          <i />
          <i />
          <div>Przestrzeń do wspólnej pracy</div>
        </div>
        <p>Etap 05 / 12 · Projekt interfejsu</p>
      </section>
      <section className="card">
        <span className="eyebrow">UI-01 · Projekt formularza</span>
        <h3>Logowanie do RoomBook</h3>
        <p>
          Nie wpisuj prawdziwych poświadczeń. Pola są tylko do odczytu; podgląd
          ich nie zbiera ani nie wysyła.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            showPreview({
              title: 'Podgląd logowania',
              content: (
                <p>
                  Logowanie będzie dostępne po integracji z API. Do oglądania
                  makiet użyj poniższych odnośników podglądu.
                </p>
              ),
            });
          }}
        >
          <label>
            Login / e-mail
            <input
              type="text"
              readOnly
              value=""
              placeholder="Pole demonstracyjne"
              autoComplete="off"
            />
          </label>
          <label>
            Hasło
            <input
              type="password"
              readOnly
              value=""
              placeholder="Pole demonstracyjne"
              autoComplete="off"
            />
          </label>
          <button type="submit" className="primary">
            Zaloguj — podgląd
          </button>
        </form>
        <p className="error-example">
          <strong>Projekt stanu błędu</strong>
          <br />
          Niepoprawny login lub hasło.
        </p>
        <div className="preview-entry">
          <h3>Przejdź do makiet</h3>
          <p>Wybór prezentacji, bez konta i sesji.</p>
          <div className="actions">
            <a className="button primary" href="#UI-02">
              Podgląd studenta →
            </a>
            <a className="button" href="#UI-04">
              Podgląd administratora →
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
