import { useEffect, useRef, useState } from 'react';
import { StateExamples, type ShowPreview } from '../components/Preview';
import { bookings, rooms } from '../demo/data';

export function Rooms({ showPreview }: { showPreview: ShowPreview }) {
  const [editing, setEditing] = useState<(typeof rooms)[number] | 'new' | null>(
    null,
  );
  const [filter, setFilter] = useState('all');
  const editorTitleRef = useRef<HTMLHeadingElement>(null);
  const editorTriggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (editing) editorTitleRef.current?.focus();
  }, [editing]);
  function openEditor(value: typeof editing, trigger: HTMLButtonElement) {
    editorTriggerRef.current = trigger;
    setEditing(value);
  }
  const list = rooms.filter(
    (room) => filter === 'all' || room.active === (filter === 'active'),
  );
  const selected = editing && editing !== 'new' ? editing : null;
  return (
    <>
      <p className="intro">
        Dane sal i ich aktywność. Wyłączenie sali docelowo anuluje wszystkie jej
        przyszłe aktywne rezerwacje, z zachowaniem historii.
      </p>
      <section className="card">
        <div className="section-toolbar">
          <label>
            Pokaż sale
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="all">Wszystkie</option>
              <option value="active">Aktywne</option>
              <option value="inactive">Nieaktywne</option>
            </select>
          </label>
          <button
            className="primary"
            onClick={(event) => openEditor('new', event.currentTarget)}
          >
            Dodaj salę — podgląd
          </button>
        </div>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Lista sal"
        >
          <table>
            <caption>
              Fikcyjne dane UI; nieaktywna C-302 ilustruje stan po dezaktywacji,
              nie początkowy seed.
            </caption>
            <thead>
              <tr>
                <th scope="col">Numer / nazwa</th>
                <th scope="col">Pojemność</th>
                <th scope="col">Status</th>
                <th scope="col">Działania</th>
              </tr>
            </thead>
            <tbody>
              {list.map((room) => (
                <tr key={room.number}>
                  <td>
                    <strong>{room.number}</strong>
                    <small>{room.name || 'Bez nazwy'}</small>
                  </td>
                  <td>{room.capacity} miejsc</td>
                  <td>
                    <span
                      className={`badge ${room.active ? 'active' : 'neutral'}`}
                    >
                      {room.active ? 'Aktywna' : 'Nieaktywna'}
                    </span>
                  </td>
                  <td>
                    <div className="actions">
                      <button
                        onClick={(event) =>
                          openEditor(room, event.currentTarget)
                        }
                        aria-label={`Edytuj salę ${room.number}`}
                      >
                        Edytuj
                      </button>
                      <button
                        onClick={() =>
                          showPreview({
                            title: `Projekt: ${room.active ? 'dezaktywacja' : 'aktywacja'} sali ${room.number}`,
                            content: (
                              <>
                                {room.active ? (
                                  <p className="warning">
                                    Przyszłe aktywne rezerwacje do anulowania:{' '}
                                    <strong>
                                      {
                                        bookings.filter(
                                          (item) =>
                                            item.room === room.number &&
                                            item.state === 'Nadchodząca',
                                        ).length
                                      }
                                    </strong>{' '}
                                    (liczba w stałym zestawie demo). API
                                    ponownie wyliczy skutki przed rzeczywistym
                                    zatwierdzeniem. Dezaktywacja i anulowania
                                    muszą być atomowe.
                                  </p>
                                ) : (
                                  <p>
                                    Aktywacja pozwoli na nowe rezerwacje. Nie
                                    przywróci wcześniej anulowanych.
                                  </p>
                                )}
                                <p>
                                  Historia pozostaje zachowana. W podglądzie
                                  status sali się nie zmieni.
                                </p>
                              </>
                            ),
                            confirm: true,
                          })
                        }
                        aria-label={`${room.active ? 'Dezaktywuj' : 'Aktywuj'} salę ${room.number}`}
                      >
                        {room.active ? 'Dezaktywuj' : 'Aktywuj'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {editing && (
        <section
          className="card room-editor"
          aria-labelledby="room-editor-title"
        >
          <div className="section-toolbar">
            <h3 id="room-editor-title" ref={editorTitleRef} tabIndex={-1}>
              {selected ? `Edycja sali ${selected.number}` : 'Dodanie sali'} —
              projekt
            </h3>
            <button
              onClick={() => {
                setEditing(null);
                editorTriggerRef.current?.focus();
              }}
            >
              Zamknij formularz
            </button>
          </div>
          <form
            key={selected?.number || 'new'}
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              showPreview({
                title: selected
                  ? 'Projekt potwierdzenia edycji'
                  : 'Projekt potwierdzenia dodania sali',
                content: (
                  <>
                    <p>
                      Sala: <strong>{String(form.get('number'))}</strong> ·{' '}
                      {String(form.get('capacity'))} miejsc.
                    </p>
                    <p>
                      Nazwa: {String(form.get('name')) || 'Nie podano'}. Opis:{' '}
                      {String(form.get('description')) || 'Nie podano'}.
                    </p>
                    <p>
                      Docelowo API zweryfikuje numer unikalny po normalizacji i
                      dodatnią całkowitą pojemność. Edycja zachowa tożsamość
                      sali i powiązania rezerwacji.
                    </p>
                  </>
                ),
                confirm: true,
              });
            }}
          >
            <div className="form-grid">
              <label>
                Numer sali
                <input
                  name="number"
                  required
                  defaultValue={selected?.number || ''}
                  placeholder="Np. A-103"
                />
              </label>
              <label>
                Nazwa (opcjonalna)
                <input name="name" defaultValue={selected?.name || ''} />
              </label>
              <label>
                Pojemność — liczba miejsc
                <input
                  name="capacity"
                  type="number"
                  required
                  min={1}
                  step={1}
                  defaultValue={selected?.capacity || 6}
                />
              </label>
              <label>
                Opis (opcjonalny)
                <textarea name="description" rows={2} />
              </label>
            </div>
            <button type="submit" className="primary">
              Podgląd potwierdzenia danych
            </button>
          </form>
        </section>
      )}
      <StateExamples showPreview={showPreview} admin />
    </>
  );
}
