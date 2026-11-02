import { useCallback, useState } from 'react';
import type { Api } from '../api';
import { useResource } from '../useResource';
import { Calendar } from './Calendar';
import { MyReservations } from './MyReservations';

export function Student({ api, screen }: { api: Api; screen: string }) {
  const [revision, setRevision] = useState(0);
  const loadMine = useCallback(
    (signal: AbortSignal) => api.mine(signal),
    [api, screen],
  );
  const mine = useResource(loadMine, revision);
  const changed = () => setRevision((n) => n + 1);
  return screen === 'UI-03' ? (
    <MyReservations api={api} resource={mine} onChanged={changed} />
  ) : (
    <Calendar api={api} revision={revision} onChanged={changed} />
  );
}
