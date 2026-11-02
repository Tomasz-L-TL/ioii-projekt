import { useEffect, useRef, useState } from 'react';
import { PreviewDialog, type Preview } from './components/Preview';
import { demoClock, demoMessage, screens, type ScreenId } from './demo/data';
import { Blocks, StudentBooking } from './screens/Administration';
import { Login } from './screens/Login';
import { Reservations as AdminReservations } from './screens/Reservations';
import { Rooms } from './screens/Rooms';
import { Student } from './screens/Student';
import { useSession } from './useSession';
import { errorMessage } from './api/client';

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
  const auth = useSession();
  const [requested, setRequested] = useState(readScreen);
  const [theme, setTheme] = useState(readTheme);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [notice, setNotice] = useState('');
  const [logoutError, setLogoutError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const logoutPending = useRef(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const session = auth.session;
  const admin = session?.user.role === 'ADMIN';
  // Ochrona zachodzi w renderze, zanim efekt znormalizuje hash.
  const screen: ScreenId = !session
    ? 'UI-01'
    : admin
      ? requested >= 'UI-04'
        ? requested
        : 'UI-04'
      : requested === 'UI-02' || requested === 'UI-03'
        ? requested
        : 'UI-02';
  const current = screens.find((item) => item.id === screen)!;
  const nav = session
    ? screens.filter((item) =>
        admin ? item.id >= 'UI-04' : item.id === 'UI-02' || item.id === 'UI-03',
      )
    : [];
  useEffect(() => {
    const change = () => {
      setRequested(readScreen());
      setPreview(null);
      setNotice('');
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    if (auth.checking || auth.error) return;
    if (window.location.hash !== `#${screen}`)
      window.history.replaceState(null, '', `#${screen}`);
    setRequested(screen);
  }, [screen, requested, auth.checking, auth.error]);
  useEffect(() => {
    document.title = `${auth.checking ? 'Sprawdzanie sesji' : current.title} · RoomBook`;
    titleRef.current?.focus();
  }, [current, auth.checking, session?.user.id]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('roombook-theme', theme);
    } catch {
      /* Motyw działa też bez magazynu. */
    }
  }, [theme]);
  useEffect(() => {
    setPreview(null);
    setNotice('');
    setLogoutError('');
    setLoggingOut(false);
    logoutPending.current = false;
  }, [session]);
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
          <a
            className="brand"
            href={admin ? '#UI-04' : session ? '#UI-02' : '#UI-01'}
          >
            <span className="brand-mark" aria-hidden="true">
              R
            </span>
            <h1>RoomBook</h1>
          </a>
          <p className="brand-caption">Przestrzeń na Twoje plany</p>
          <nav aria-label="Nawigacja RoomBook">
            <span className="eyebrow">
              {session
                ? admin
                  ? 'Administrator · prototyp'
                  : 'Student · rzeczywiste dane'
                : 'Zaloguj się'}
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
          </nav>
          {session && (
            <>
              <p className="account-name">{session.user.displayName}</p>
              <button
                type="button"
                disabled={loggingOut}
                onClick={async () => {
                  if (logoutPending.current) return;
                  logoutPending.current = true;
                  setLoggingOut(true);
                  setLogoutError('');
                  try {
                    await session.api.logout(session.controller.signal);
                    if (!session.controller.signal.aborted) auth.ended();
                  } catch (error) {
                    if (!session.controller.signal.aborted)
                      setLogoutError(errorMessage(error));
                  } finally {
                    logoutPending.current = false;
                    if (!session.controller.signal.aborted)
                      setLoggingOut(false);
                  }
                }}
              >
                {loggingOut ? 'Wylogowywanie…' : 'Wyloguj'}
              </button>
            </>
          )}
          <p role="alert">{logoutError}</p>
          <div className="sidebar-bottom">
            <span className="eyebrow">Projekt uczelniany</span>
            <p>
              Etap 09 / 12
              <br />
              Frontend studenta
            </p>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <span className="demo-badge">
              <i aria-hidden="true" />
              {admin
                ? 'Administrator — prototyp do etapu 10'
                : 'Student — rzeczywiste dane'}
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
                  {admin ? 'Prototyp administratora' : 'Witaj w RoomBook'}
                </p>
                <h2 ref={titleRef} tabIndex={-1}>
                  {auth.checking
                    ? 'Sprawdzam sesję…'
                    : auth.error
                      ? 'Nie udało się sprawdzić sesji'
                      : current.title}
                </h2>
              </div>
              <span className="page-counter">{screen.slice(-2)} / 07</span>
            </div>
            {admin && (
              <div className="prototype-info">
                <p>
                  Administrator — prototyp do etapu 10. Działania
                  demonstracyjne, bez zapisu.
                </p>
                <p>Dane fikcyjne · zegar demo: {demoClock} · Europe/Warsaw</p>
              </div>
            )}
            <div className="live-notice" role="status">
              {auth.message || notice}
            </div>
            {auth.error && (
              <div role="alert" className="notice">
                <p>{auth.error}</p>
                <button onClick={auth.retry}>Ponów sprawdzenie sesji</button>
              </div>
            )}
            {!auth.checking && !auth.error && (
              <div className="screen-content">
                {!session && <Login onLogin={auth.accept} />}
                {session && !admin && (
                  <Student
                    key={session.user.id}
                    api={session.api}
                    screen={screen}
                  />
                )}
                {session && admin && (
                  <div key={screen} className="screen-content">
                    {screen === 'UI-04' && <Rooms showPreview={setPreview} />}
                    {screen === 'UI-05' && (
                      <AdminReservations admin showPreview={setPreview} />
                    )}
                    {screen === 'UI-06' && <Blocks showPreview={setPreview} />}
                    {screen === 'UI-07' && (
                      <StudentBooking showPreview={setPreview} />
                    )}
                  </div>
                )}
              </div>
            )}
            <footer>
              RoomBook · Student — rzeczywiste dane · Administrator — prototyp
              do etapu 10
            </footer>
          </main>
        </div>
      </div>
      {session && admin && preview && (
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
