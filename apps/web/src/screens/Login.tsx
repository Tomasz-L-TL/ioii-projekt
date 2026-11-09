import { useRef, useState } from 'react';
import { isUser } from '../api';
import { errorMessage, request } from '../api/client';
import type { UserDto } from '../api/types';
import { useLifetime } from '../useResource';

export function Login({ onLogin }: { onLogin: (user: UserDto) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const sending = useRef(false);
  const lifetime = useLifetime();
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
          Zaloguj się na przygotowane konto, sprawdź dostępność i zarezerwuj
          salę do nauki.
        </p>
        <div className="room-illustration" aria-hidden="true">
          <span>A-101</span>
          <i />
          <i />
          <i />
          <i />
          <div>Przestrzeń do wspólnej pracy</div>
        </div>
        <p>
          Student — kalendarz i własne rezerwacje
          <br />
          Administrator — sale, blokady i rezerwacje studentów
        </p>
      </section>
      <section className="card">
        <span className="eyebrow">UI-01 · Twoje konto</span>
        <h3>Logowanie do RoomBook</h3>
        <p>Użyj danych przygotowanego konta studenta lub administratora.</p>
        <form
          aria-busy={pending}
          onSubmit={async (event) => {
            event.preventDefault();
            if (sending.current) return;
            sending.current = true;
            setPending(true);
            setError('');
            const signal = lifetime.current.signal;
            try {
              const user = await request('/auth/login', isUser, {
                signal,
                body: { email, password },
              });
              if (!signal.aborted) onLogin(user);
            } catch (error) {
              if (!signal.aborted) setError(errorMessage(error));
            } finally {
              sending.current = false;
              if (!signal.aborted) {
                setPending(false);
                setPassword('');
              }
            }
          }}
        >
          <label>
            Login / e-mail
            <input
              type="email"
              required
              maxLength={254}
              autoComplete="username"
              value={email}
              disabled={pending}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Hasło
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              disabled={pending}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <p role="alert">{error}</p>
          <button type="submit" className="primary" disabled={pending}>
            {pending ? 'Logowanie…' : 'Zaloguj'}
          </button>
        </form>
      </section>
    </div>
  );
}
