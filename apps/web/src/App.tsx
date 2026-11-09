import { useEffect, useRef, useState } from 'react';
import { screens, type ScreenId } from './demo/data';
import { AdminSchedule } from './screens/AdminSchedule';
import { Login } from './screens/Login';
import { AdminBookings } from './screens/AdminBookings';
import { AdminRooms } from './screens/AdminRooms';
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
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    if (auth.checking || auth.error) return;
    // Nie nadpisuj nawigacji, której hashchange nie zdążył jeszcze obsłużyć.
    if (readScreen() !== requested) return;
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
                  ? 'Administrator · rzeczywiste dane'
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
              Etap 10 / 12
              <br />
              Frontend administratora
            </p>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <span className="demo-badge">
              <i aria-hidden="true" />
              {admin
                ? 'Administrator — rzeczywiste dane'
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
                  {admin ? 'Panel administratora' : 'Witaj w RoomBook'}
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
            <div className="live-notice" role="status">
              {auth.message}
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
                  <div
                    key={`${session.user.id}-${screen}`}
                    className="screen-content"
                  >
                    {screen === 'UI-04' && <AdminRooms api={session.api} />}
                    {screen === 'UI-05' && <AdminBookings api={session.api} />}
                    {screen === 'UI-06' && (
                      <AdminSchedule
                        api={session.api}
                        block
                        administrator={session.user.displayName}
                      />
                    )}
                    {screen === 'UI-07' && (
                      <AdminSchedule
                        api={session.api}
                        administrator={session.user.displayName}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
            <footer>RoomBook · Rzeczywiste dane · Europe/Warsaw</footer>
          </main>
        </div>
      </div>
    </>
  );
}
