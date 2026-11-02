import { useCallback, useEffect, useRef, useState } from 'react';
import { createApi, isUser, type Api } from './api';
import { ApiError, errorMessage, request } from './api/client';
import type { UserDto } from './api/types';
type Session = { user: UserDto; api: Api; controller: AbortController };
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  const scope = useRef<AbortController | null>(null);
  const accept = useCallback((user: UserDto) => {
    scope.current?.abort();
    const controller = new AbortController();
    scope.current = controller;
    const api = createApi(controller.signal, () => {
      if (scope.current !== controller || controller.signal.aborted) return;
      controller.abort();
      setSession(null);
      setMessage('Sesja wygasła. Zaloguj się ponownie.');
    });
    setSession({ user, api, controller });
    setMessage('');
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setChecking(true);
    setError('');
    request('/auth/me', isUser, { signal: controller.signal })
      .then((user) => {
        if (!controller.signal.aborted) accept(user);
      })
      .catch((error: unknown) => {
        if (
          !controller.signal.aborted &&
          !(error instanceof ApiError && error.status === 401)
        )
          setError(errorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setChecking(false);
      });
    return () => {
      controller.abort();
      scope.current?.abort();
    };
  }, [attempt, accept]);
  const ended = () => {
    scope.current?.abort();
    setSession(null);
    setMessage('Wylogowano.');
  };
  return {
    session,
    checking,
    error,
    message,
    accept,
    ended,
    retry: () => setAttempt((n) => n + 1),
  };
}
