import { useState } from 'react';
import type { Api } from '../api';
import type { AdminBookingDto } from '../api/types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatDate, formatTimestamp } from '../dates';
import { useResource } from '../useResource';
import {
  Feedback,
  ResourceState,
  TermSummary,
  useAdminAction,
} from './AdminShared';

const states = {
  UPCOMING: 'Nadchodząca',
  STARTED: 'Rozpoczęta',
  COMPLETED: 'Zakończona',
  CANCELLED: 'Anulowana',
};
export function AdminBookings({ api }: { api: Api }) {
  const [target, setTarget] = useState<AdminBookingDto | null>(null);
  const resource = useResource(api.bookings, 0, Boolean(target));
  const action = useAdminAction(resource.refresh);
  const [query, setQuery] = useState('');
  const [state, setState] = useState('ALL');
  const list = resource.data?.filter(
    (row) =>
      (state === 'ALL' || row.state === state) &&
      `${row.id} ${row.student.displayName} ${row.room.roomNumber} ${row.date}`
        .toLocaleLowerCase('pl')
        .includes(query.toLocaleLowerCase('pl')),
  );
  return (
    <>
      <p>
        Rezerwacje wszystkich studentów. Możliwość anulowania i stan czasowy
        pochodzą z serwera.
      </p>
      <Feedback action={action} />
      <section className="card">
        <div className="section-toolbar">
          <label>
            Szukaj rezerwacji
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Student, sala, data lub ID"
            />
          </label>
          <label>
            Stan rezerwacji
            <select
              value={state}
              onChange={(event) => setState(event.target.value)}
            >
              <option value="ALL">Wszystkie</option>
              {Object.entries(states).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button disabled={action.pending} onClick={resource.refresh}>
            Odśwież rezerwacje
          </button>
        </div>
        <ResourceState resource={resource} label="rezerwacje" />
        {list?.length === 0 && <p>Brak pasujących rezerwacji.</p>}
        {Boolean(list?.length) && (
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Wszystkie rezerwacje"
          >
            <table>
              <caption>Właściciel, inicjator i historia rezerwacji</caption>
              <thead>
                <tr>
                  <th scope="col">Student / sala</th>
                  <th scope="col">Termin</th>
                  <th scope="col">Stan</th>
                  <th scope="col">Inicjator</th>
                  <th scope="col">Działanie / historia</th>
                </tr>
              </thead>
              <tbody>
                {list?.map((row) => (
                  <tr key={row.id} data-booking-id={row.id}>
                    <td>
                      {row.student.displayName}
                      <small>
                        {row.room.roomNumber} · #{row.id}
                      </small>
                    </td>
                    <td>
                      <TermSummary term={{ ...row, roomId: row.room.id }} />
                    </td>
                    <td>{states[row.state]}</td>
                    <td>
                      {row.createdBy.displayName}
                      <small>
                        {row.createdBy.role === 'ADMIN'
                          ? 'Administrator'
                          : 'Student'}{' '}
                        · {formatTimestamp(row.createdAt)}
                      </small>
                    </td>
                    <td>
                      {row.canCancel && (
                        <button
                          disabled={action.pending}
                          onClick={() => {
                            setTarget(row);
                            action.setError('');
                          }}
                        >
                          Anuluj rezerwację
                        </button>
                      )}
                      {row.cancelledAt && (
                        <details>
                          <summary>Historia anulowania</summary>
                          <p>
                            {row.cancelReason}
                            <br />
                            {row.cancelledBy?.displayName ??
                              `ID ${row.cancelledByUserId}`}
                            <br />
                            {formatTimestamp(row.cancelledAt)} · Europe/Warsaw
                          </p>
                        </details>
                      )}
                      {!row.canCancel && !row.cancelledAt && (
                        <span>Brak dostępnych akcji</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {target && (
        <ConfirmDialog
          title={`Anulować rezerwację #${target.id}?`}
          pending={action.pending}
          error=""
          confirmLabel="Potwierdź anulowanie"
          onClose={() => setTarget(null)}
          onConfirm={() => {
            const captured = target;
            void action.run(
              async (signal) => {
                try {
                  return await api.cancel(captured.id, signal);
                } finally {
                  if (!signal.aborted) setTarget(null);
                }
              },
              () =>
                action.setNotice(
                  `Anulowano rezerwację #${captured.id}. Historia zachowana.`,
                ),
            );
          }}
        >
          <p>
            Student: {target.student.displayName}
            <br />
            Sala {target.room.roomNumber} · {formatDate(target.date)}
          </p>
          <TermSummary term={{ ...target, roomId: target.room.id }} />
          <p>
            Anulowanie administracyjne zwolni termin i zapisze administratora
            jako inicjatora anulowania.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
