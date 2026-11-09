import { useCallback, useState } from 'react';
import type { Api } from '../api';
import type {
  AvailabilityDto,
  BlockDto,
  BlockInput,
  BookingInput,
  ImpactDto,
} from '../api/types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatDate, monday, time } from '../dates';
import { useResource } from '../useResource';
import {
  Feedback,
  ImpactSummary,
  ResourceState,
  TermSummary,
  WeekGrid,
  WeekPicker,
  useAdminAction,
} from './AdminShared';

type Target = (
  | { kind: 'block'; input: BlockInput; impact: ImpactDto; room: string }
  | {
      kind: 'booking';
      input: BookingInput & { studentId: number };
      room: string;
      student: string;
    }
  | { kind: 'remove'; block: BlockDto }
) & { trigger?: HTMLElement };
export function AdminSchedule({
  api,
  block = false,
  administrator,
}: {
  api: Api;
  block?: boolean;
  administrator: string;
}) {
  const [target, setTarget] = useState<Target | null>(null);
  const rooms = useResource(api.adminRooms, 0, Boolean(target));
  const loadStudents = useCallback(
    (signal: AbortSignal) =>
      block ? Promise.resolve([]) : api.students(signal),
    [api, block],
  );
  const students = useResource(loadStudents, 0, Boolean(target));
  const loadBlocks = useCallback(
    (signal: AbortSignal) => (block ? api.blocks(signal) : Promise.resolve([])),
    [api, block],
  );
  const blocks = useResource(loadBlocks, 0, Boolean(target));
  const [chosenRoom, setChosenRoom] = useState<number | null>(null);
  const options = rooms.data?.filter((room) => block || room.isActive);
  const room = options?.find((row) => row.id === chosenRoom) ?? options?.[0];
  const [studentId, setStudentId] = useState<number | null>(null);
  const student =
    students.data?.find((row) => row.id === studentId) ?? students.data?.[0];
  const [week, setWeek] = useState(() => monday());
  const [duration, setDuration] = useState<1 | 2>(1);
  const [reason, setReason] = useState('');
  const [selection, setSelection] = useState<{
    term: BookingInput;
    snapshot: AvailabilityDto;
  } | null>(null);
  const load = useCallback(
    (signal: AbortSignal) =>
      room ? api.availability(room.id, week, signal) : Promise.resolve(null),
    [api, room?.id, week],
  );
  const availability = useResource(load, 0, Boolean(target));
  const selected =
    selection?.snapshot === availability.data &&
    selection?.term.roomId === room?.id &&
    selection?.term.durationSlots === duration
      ? selection.term
      : null;
  const refresh = () => {
    rooms.refresh();
    availability.refresh();
    blocks.refresh();
  };
  const action = useAdminAction(refresh);
  const reset = () => {
    setSelection(null);
    action.setError('');
    action.setNotice('');
  };
  async function confirm() {
    if (!target) return;
    const captured = target;
    await action.run(
      async (signal) => {
        try {
          if (captured.kind === 'remove')
            await api.deleteBlock(captured.block.id, signal);
          else if (captured.kind === 'booking')
            await api.bookFor(captured.input, signal);
          else
            await api.createBlock(
              {
                ...captured.input,
                confirmed: true,
                expectedCancellationIds:
                  captured.impact.expectedCancellationIds,
                confirmationToken: captured.impact.confirmationToken,
              },
              signal,
            );
        } finally {
          if (!signal.aborted) {
            setTarget(null);
            setSelection(null);
          }
        }
      },
      () =>
        action.setNotice(
          captured.kind === 'remove'
            ? 'Usunięto blokadę. Anulowane rezerwacje pozostają w historii.'
            : captured.kind === 'block'
              ? 'Utworzono blokadę i zapisano jej skutki.'
              : 'Zapisano rezerwację dla studenta.',
        ),
    );
  }
  return (
    <>
      <p>
        {block
          ? 'Wybierz przyszły termin. Blokada może objąć zarezerwowane sloty i nieaktywną salę; przed zapisem zobaczysz liczbę anulowań.'
          : 'Wybierz studenta i wolny termin. Brak limitu 3 rezerwacji i horyzontu +14 dni; konflikty i harmonogram nadal obowiązują.'}
      </p>
      <Feedback action={action} />
      <ResourceState resource={rooms} label="sale" />
      {!block && <ResourceState resource={students} label="studentów" />}
      <div className="card form-grid">
        <label>
          {block ? 'Sala do blokady' : 'Aktywna sala'}
          <select
            disabled={action.pending || !options?.length}
            value={room?.id ?? ''}
            onChange={(event) => {
              setChosenRoom(Number(event.target.value));
              reset();
            }}
          >
            {!options?.length && <option value="">Brak sal</option>}
            {options?.map((row) => (
              <option key={row.id} value={row.id}>
                {row.roomNumber} · {row.isActive ? 'aktywna' : 'nieaktywna'}
              </option>
            ))}
          </select>
        </label>
        {!block && (
          <label>
            Student — właściciel
            <select
              disabled={action.pending || !students.data?.length}
              value={student?.id ?? ''}
              onChange={(event) => {
                setStudentId(Number(event.target.value));
                reset();
              }}
            >
              {!students.data?.length && (
                <option value="">Brak studentów</option>
              )}
              {students.data?.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.displayName} · {row.email}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          {block ? 'Długość blokady' : 'Czas zajęć'}
          <select
            value={duration}
            disabled={action.pending}
            onChange={(event) => {
              setDuration(event.target.value === '2' ? 2 : 1);
              reset();
            }}
          >
            <option value={1}>
              {block ? '1 slot · 60 min' : '45 min · 1 slot (60 min)'}
            </option>
            <option value={2}>
              {block ? '2 sloty · 120 min' : '90 min · 2 sloty (120 min)'}
            </option>
          </select>
        </label>
        {block && (
          <label>
            Powód blokady (opcjonalnie)
            <textarea
              disabled={action.pending}
              maxLength={2000}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                action.setError('');
              }}
            />
          </label>
        )}
      </div>
      <WeekPicker
        week={week}
        pending={action.pending}
        setWeek={(value) => {
          setWeek(monday(value));
          reset();
        }}
      />
      <ResourceState resource={availability} label="dostępność" />
      {options?.length === 0 && <p>Brak sal do wykonania operacji.</p>}
      {!block && students.data?.length === 0 && (
        <p>Brak kont studentów. Nie można tworzyć rezerwacji.</p>
      )}
      {availability.data && (
        <WeekGrid
          snapshot={availability.data}
          duration={duration}
          selection={selected}
          pending={action.pending}
          block={block}
          onSelect={(term) => {
            setSelection({ term, snapshot: availability.data! });
            action.setError('');
            action.setNotice('');
          }}
        />
      )}
      <section className="summary-card">
        <h3>Wybrany termin</h3>
        {selected ? (
          <>
            <p>Sala {room?.roomNumber}</p>
            <TermSummary term={selected} block={block} />
            {!block && (
              <p>
                Właściciel: {student?.displayName}
                <br />
                Inicjator: {administrator} (administrator)
              </p>
            )}
          </>
        ) : (
          <p>
            Wybierz termin w kalendarzu. Dwa sloty nie mogą zaczynać się o
            22:00.
          </p>
        )}
        <button
          className="primary"
          disabled={!selected || action.pending || (!block && !student)}
          onClick={(event) => {
            const trigger = event.currentTarget;
            if (!selected || !room) return;
            if (block) {
              const input = { ...selected, reason: reason.trim() || null };
              void action.run(
                (signal) => api.blockPreview(input, signal),
                (impact) =>
                  setTarget({
                    kind: 'block',
                    input,
                    impact,
                    room: room.roomNumber,
                    trigger,
                  }),
                false,
              );
            } else if (student)
              setTarget({
                kind: 'booking',
                input: { ...selected, studentId: student.id },
                room: room.roomNumber,
                student: student.displayName,
              });
          }}
        >
          {block ? 'Podgląd skutków blokady' : 'Zarezerwuj dla studenta'}
        </button>
        <button
          disabled={action.pending}
          onClick={() => {
            reset();
            refresh();
          }}
        >
          Odśwież kalendarz
        </button>
      </section>
      {block && (
        <section className="card">
          <h3>Istniejące blokady</h3>
          <ResourceState resource={blocks} label="blokady" />
          {blocks.data?.length === 0 && <p>Brak blokad.</p>}
          {Boolean(blocks.data?.length) && (
            <div
              className="table-scroll"
              role="region"
              aria-label="Lista blokad"
              tabIndex={0}
            >
              <table>
                <caption>Blokady wszystkich sal</caption>
                <thead>
                  <tr>
                    <th scope="col">Sala / data</th>
                    <th scope="col">Zajętość</th>
                    <th scope="col">Powód / autor</th>
                    <th scope="col">Działanie</th>
                  </tr>
                </thead>
                <tbody>
                  {blocks.data?.map((row) => (
                    <tr key={row.id} data-block-id={row.id}>
                      <td>
                        {row.room.roomNumber}
                        <small>{formatDate(row.date)}</small>
                      </td>
                      <td>
                        {time(row.startHour)}–
                        {time(row.startHour + row.durationSlots)}
                        <small>{row.durationSlots * 60} min</small>
                      </td>
                      <td>
                        {row.reason || 'Brak powodu'}
                        <small>{row.createdBy.displayName}</small>
                      </td>
                      <td>
                        <button
                          disabled={action.pending}
                          onClick={() =>
                            setTarget({ kind: 'remove', block: row })
                          }
                        >
                          Usuń blokadę
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      {target && (
        <ConfirmDialog
          returnFocus={target.trigger}
          title={
            target.kind === 'block'
              ? 'Potwierdź blokadę'
              : target.kind === 'booking'
                ? 'Potwierdź rezerwację dla studenta'
                : 'Usunąć blokadę?'
          }
          pending={action.pending}
          error=""
          confirmLabel={
            target.kind === 'block'
              ? 'Potwierdź utworzenie blokady'
              : target.kind === 'booking'
                ? 'Potwierdź rezerwację'
                : 'Potwierdź usunięcie'
          }
          onClose={() => setTarget(null)}
          onConfirm={() => void confirm()}
        >
          {target.kind === 'block' ? (
            <ImpactSummary impact={target.impact}>
              <p>Sala {target.room}</p>
              <TermSummary term={target.input} block />
              <p>Powód: {target.input.reason || 'Brak powodu'}</p>
            </ImpactSummary>
          ) : target.kind === 'booking' ? (
            <>
              <p>
                Sala {target.room}
                <br />
                Właściciel: {target.student}
                <br />
                Inicjator: {administrator} (administrator)
              </p>
              <TermSummary term={target.input} />
              <p>API sprawdzi dostępność i konflikty studenta przy zapisie.</p>
            </>
          ) : (
            <>
              <p>Sala {target.block.room.roomNumber}</p>
              <TermSummary term={target.block} block />
              <p>
                Usunięcie blokady zwolni termin dla nowych rezerwacji. Nie
                przywróci wcześniejszych anulowań.
              </p>
            </>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}
