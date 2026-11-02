import { useEffect, useRef, useState, useCallback } from 'react';
import { errorMessage } from './api/client';
export function useResource<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  revision = 0,
  paused = false,
) {
  const [attempt, setAttempt] = useState(0);
  const refresh = useCallback(() => setAttempt((n) => n + 1), []);
  const [result, setResult] = useState<{
    loader: typeof loader;
    revision: number;
    attempt: number;
    data?: T;
    error?: string;
  }>();
  useEffect(() => {
    const controller = new AbortController();
    const key = { loader, revision, attempt };
    loader(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ ...key, data });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setResult({ ...key, error: errorMessage(error) });
      });
    return () => controller.abort();
  }, [loader, revision, attempt]);
  useEffect(() => {
    if (paused) return;
    const visible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const timer = window.setInterval(visible, 60_000);
    window.addEventListener('focus', visible);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', visible);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [refresh, paused]);
  const current =
    result?.loader === loader &&
    result.revision === revision &&
    result.attempt === attempt
      ? result
      : undefined;
  return {
    data: current?.data,
    error: current?.error,
    loading: !current,
    refresh,
  };
}
export function useLifetime() {
  const controller = useRef(new AbortController());
  useEffect(() => {
    controller.current = new AbortController();
    return () => controller.current.abort();
  }, []);
  return controller;
}
