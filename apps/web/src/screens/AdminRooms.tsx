import { useEffect, useRef, useState } from 'react';
import type { Api } from '../api';
import type { AdminRoomDto, ImpactDto, RoomInput } from '../api/types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useResource } from '../useResource';
import {
  Feedback,
  ImpactSummary,
  ResourceState,
  useAdminAction,
} from './AdminShared';

type Target = { room: AdminRoomDto; impact?: ImpactDto; trigger?: HTMLElement };
export function AdminRooms({ api }: { api: Api }) {
  const [target, setTarget] = useState<Target | null>(null);
  const [editor, setEditor] = useState<{
    id: number | null;
    values: RoomInput;
  } | null>(null);
  const editorTitle = useRef<HTMLHeadingElement>(null);
  const editorKey = editor ? (editor.id ?? 'new') : null;
  useEffect(() => {
    if (editorKey !== null) editorTitle.current?.focus();
  }, [editorKey]);
  const rooms = useResource(api.adminRooms, 0, Boolean(target || editor));
  const action = useAdminAction(rooms.refresh);
  const [query, setQuery] = useState('');
  const list = rooms.data?.filter((room) =>
    `${room.roomNumber} ${room.name ?? ''}`
      .toLocaleLowerCase('pl')
      .includes(query.toLocaleLowerCase('pl')),
  );
  function edit(room?: AdminRoomDto) {
    action.setError('');
    setEditor({
      id: room?.id ?? null,
      values: {
        roomNumber: room?.roomNumber ?? '',
        name: room?.name ?? '',
        description: room?.description ?? '',
        capacity: room?.capacity ?? 1,
      },
    });
  }
  return (
    <>
      <p>
        Dodawaj i edytuj sale. Dezaktywacja wymaga podglądu skutków. Aktywacja
        nie przywraca rezerwacji.
      </p>
      <Feedback action={action} />
      <section className="card">
        <div className="section-toolbar">
          <label>
            Szukaj sali
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button disabled={action.pending} onClick={() => edit()}>
            Dodaj salę
          </button>
          <button disabled={action.pending} onClick={rooms.refresh}>
            Odśwież sale
          </button>
        </div>
        <ResourceState resource={rooms} label="sale" />
        {list &&
          (list.length === 0 ? (
            <p>Brak pasujących sal.</p>
          ) : (
            <div
              className="table-scroll"
              role="region"
              aria-label="Lista sal"
              tabIndex={0}
            >
              <table>
                <caption>Sale aktywne i nieaktywne</caption>
                <thead>
                  <tr>
                    <th scope="col">Numer / nazwa</th>
                    <th scope="col">Miejsca / opis</th>
                    <th scope="col">Status</th>
                    <th scope="col">Działania</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((room) => (
                    <tr key={room.id} data-room-id={room.id}>
                      <td>
                        {room.roomNumber}
                        <small>{room.name || 'Sala bez nazwy'}</small>
                      </td>
                      <td>
                        {room.capacity}
                        <small>{room.description || 'Brak opisu'}</small>
                      </td>
                      <td>{room.isActive ? 'Aktywna' : 'Nieaktywna'}</td>
                      <td>
                        <div className="actions">
                          <button
                            disabled={action.pending}
                            onClick={() => edit(room)}
                          >
                            Edytuj
                          </button>
                          <button
                            disabled={action.pending}
                            onClick={(event) => {
                              const trigger = event.currentTarget;
                              if (!room.isActive) {
                                setTarget({ room, trigger });
                                return;
                              }
                              void action.run(
                                (signal) =>
                                  api.deactivationPreview(room.id, signal),
                                (impact) =>
                                  setTarget({ room, impact, trigger }),
                                false,
                              );
                            }}
                          >
                            {room.isActive ? 'Podgląd dezaktywacji' : 'Aktywuj'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </section>
      {editor && (
        <section className="card">
          <h3 ref={editorTitle} tabIndex={-1}>
            {editor.id === null ? 'Nowa sala' : 'Edycja sali'}
          </h3>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const captured = editor;
              void action.run(
                (signal) => api.saveRoom(captured.id, captured.values, signal),
                () => {
                  setEditor(null);
                  action.setNotice('Zapisano salę.');
                  document
                    .querySelector<HTMLElement>('.page-heading h2')
                    ?.focus();
                },
              );
            }}
          >
            <fieldset disabled={action.pending} className="form-grid">
              <label>
                Numer sali
                <input
                  required
                  maxLength={100}
                  value={editor.values.roomNumber}
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      values: {
                        ...editor.values,
                        roomNumber: event.target.value,
                      },
                    })
                  }
                />
              </label>
              <label>
                Nazwa sali
                <input
                  maxLength={200}
                  value={editor.values.name ?? ''}
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      values: { ...editor.values, name: event.target.value },
                    })
                  }
                />
              </label>
              <label>
                Liczba miejsc
                <input
                  type="number"
                  required
                  min={1}
                  max={2147483647}
                  step={1}
                  value={editor.values.capacity}
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      values: {
                        ...editor.values,
                        capacity: Number(event.target.value),
                      },
                    })
                  }
                />
              </label>
              <label>
                Opis sali
                <textarea
                  maxLength={2000}
                  value={editor.values.description ?? ''}
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      values: {
                        ...editor.values,
                        description: event.target.value,
                      },
                    })
                  }
                />
              </label>
              <button type="submit" className="primary">
                Zapisz salę
              </button>
              <button type="button" onClick={() => setEditor(null)}>
                Zamknij formularz
              </button>
            </fieldset>
          </form>
        </section>
      )}
      {target && (
        <ConfirmDialog
          returnFocus={target.trigger}
          title={target.impact ? 'Dezaktywować salę?' : 'Aktywować salę?'}
          pending={action.pending}
          error=""
          confirmLabel={
            target.impact ? 'Potwierdź dezaktywację' : 'Potwierdź aktywację'
          }
          onClose={() => setTarget(null)}
          onConfirm={() => {
            const captured = target;
            void action.run(
              async (signal) => {
                try {
                  return await api.saveRoom(
                    captured.room.id,
                    captured.impact
                      ? {
                          isActive: false,
                          confirmed: true,
                          expectedCancellationIds:
                            captured.impact.expectedCancellationIds,
                          confirmationToken: captured.impact.confirmationToken,
                        }
                      : { isActive: true },
                    signal,
                  );
                } finally {
                  if (!signal.aborted) setTarget(null);
                }
              },
              (result) =>
                action.setNotice(
                  `Sala ${result.roomNumber}: ${result.isActive ? 'aktywna' : 'nieaktywna'}.`,
                ),
            );
          }}
        >
          <p>Sala {target.room.roomNumber}</p>
          {target.impact ? (
            <ImpactSummary impact={target.impact}>
              <p>
                Wszystkie przyszłe aktywne rezerwacje tej sali zostaną
                anulowane.
              </p>
            </ImpactSummary>
          ) : (
            <p>
              Aktywacja umożliwi nowe rezerwacje. Anulowane rezerwacje pozostaną
              w historii.
            </p>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}
