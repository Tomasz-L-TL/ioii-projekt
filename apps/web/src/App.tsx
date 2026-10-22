import { useEffect, useRef, useState } from 'react';
import { PreviewDialog, type Preview } from './components/Preview';
import { demoClock, demoMessage, screens, type ScreenId } from './demo/data';
import { Blocks, StudentBooking } from './screens/Administration';
import { Calendar } from './screens/Calendar';
import { Login } from './screens/Login';
import { Reservations } from './screens/Reservations';
import { Rooms } from './screens/Rooms';

function readScreen(): ScreenId {
  return (
    screens.find((screen) => screen.id === window.location.hash.slice(1))?.id ??
    'UI-01'
  );
}

function readTheme(): 'light' | 'dark' {
  try {
    return localStorage.getItem('roombook-theme') === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function App() {
  const [screen, setScreen] = useState(readScreen);
  const [theme, setTheme] = useState(readTheme);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [notice, setNotice] = useState('');
  const titleRef = useRef<HTMLHeadingElement>(null);
  const current = screens.find((item) => item.id === screen)!;
  const admin = screen >= 'UI-04';
  const nav = screens.filter(
    (item) =>
      item.id !== 'UI-01' && (admin ? item.id >= 'UI-04' : item.id < 'UI-04'),
  );

  useEffect(() => {
    const onHashChange = () => {
      setScreen(readScreen());
      setPreview(null);
      setNotice('');
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    document.title = `${current.title} · RoomBook — podgląd`;
    titleRef.current?.focus();
  }, [current]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('roombook-theme', theme);
    } catch {
      /* Motyw działa też bez dostępnego magazynu. */
    }
  }, [theme]);

  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
      >
        Przejdź do treści
      </a>
      <div className="app-shell">
        <aside className="sidebar">
          <a className="brand" href="#UI-01">
            <span className="brand-mark" aria-hidden="true">
              R
            </span>
            <h1>RoomBook</h1>
          </a>
          <p className="brand-caption">Przestrzeń na Twoje plany</p>
          <label className="role-picker">
            Tryb podglądu
            <select
              value={admin ? 'admin' : 'student'}
              onChange={(event) => {
                window.location.hash =
                  event.target.value === 'admin' ? 'UI-04' : 'UI-02';
              }}
            >
              <option value="student">Student</option>
              <option value="admin">Administrator</option>
            </select>
          </label>
          <nav aria-label="Nawigacja podglądu">
            <span className="eyebrow">
              {admin ? 'Administracja · podgląd' : 'Student · podgląd'}
            </span>
            {nav.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                aria-current={screen === item.id ? 'page' : undefined}
              >
                <span className="nav-number" aria-hidden="true">
                  {item.id.slice(-2)}
                </span>
                {item.short}
              </a>
            ))}
            <a
              className="login-link"
              href="#UI-01"
              aria-current={screen === 'UI-01' ? 'page' : undefined}
            >
              ↩ Ekran logowania
            </a>
          </nav>
          <div className="sidebar-bottom">
            <span className="eyebrow">Projekt uczelniany</span>
            <p>
              Etap 05 / 12
              <br />
              Makiety i interfejs
            </p>
            <p>
              Przełącznik roli służy prezentacji. Nie ustanawia sesji ani
              uprawnień.
            </p>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <span className="demo-badge">
              <i aria-hidden="true" /> Tryb demonstracyjny — bez logowania i
              zapisu danych
            </span>
            <button
              className="theme-toggle"
              aria-pressed={theme === 'dark'}
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            >
              {theme === 'light' ? 'Włącz ciemny motyw' : 'Włącz jasny motyw'}
            </button>
          </header>
          <main id="main-content">
            <div className="page-heading">
              <div>
                <p className="eyebrow">
                  {current.id} ·{' '}
                  {admin
                    ? 'Podgląd administratora'
                    : screen === 'UI-01'
                      ? 'Witaj w RoomBook'
                      : 'Podgląd studenta'}
                </p>
                <h2 ref={titleRef} tabIndex={-1}>
                  {current.title}
                </h2>
              </div>
              <span className="page-counter">{screen.slice(-2)} / 07</span>
            </div>
            <div className="prototype-info">
              <p>Funkcje biznesowe nie są jeszcze dostępne.</p>
              <p>Dane fikcyjne · zegar demo: {demoClock} · Europe/Warsaw</p>
            </div>
            <div className="live-notice" role="status">
              {notice && (
                <div className="notice">
                  {notice}
                  <button
                    aria-label="Zamknij komunikat"
                    onClick={() => setNotice('')}
                  >
                    Zamknij ×
                  </button>
                </div>
              )}
            </div>
            <div key={screen} className="screen-content">
              {screen === 'UI-01' && <Login showPreview={setPreview} />}
              {screen === 'UI-02' && <Calendar showPreview={setPreview} />}
              {screen === 'UI-03' && <Reservations showPreview={setPreview} />}
              {screen === 'UI-04' && <Rooms showPreview={setPreview} />}
              {screen === 'UI-05' && (
                <Reservations admin showPreview={setPreview} />
              )}
              {screen === 'UI-06' && <Blocks showPreview={setPreview} />}
              {screen === 'UI-07' && (
                <StudentBooking showPreview={setPreview} />
              )}
            </div>
            <footer>
              RoomBook · Projekt interfejsu P1 · Integracja z API w etapach
              06–10.
            </footer>
          </main>
        </div>
      </div>
      {preview && (
        <PreviewDialog
          preview={preview}
          onClose={() => setPreview(null)}
          onConfirm={() => {
            setPreview(null);
            setNotice(demoMessage);
          }}
        />
      )}
    </>
  );
}
