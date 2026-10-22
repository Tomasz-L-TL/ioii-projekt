import { useEffect, useRef, type ReactNode } from 'react';
import { demoMessage } from '../demo/data';

export type Preview = {
  title: string;
  content: ReactNode;
  confirm?: boolean;
};
export type ShowPreview = (preview: Preview) => void;

export function PreviewDialog({
  preview,
  onClose,
  onConfirm,
}: {
  preview: Preview;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const trigger = document.activeElement;
    const dialog = ref.current;
    dialog?.showModal();
    dialog?.querySelector('button')?.focus();
    return () => {
      dialog?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={() => {
        // StrictMode ponownie otwiera dialog po kontrolnym sprzątaniu efektu.
        if (!ref.current?.open) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const buttons = event.currentTarget.querySelectorAll('button');
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      aria-labelledby="dialog-title"
      aria-describedby="dialog-notice"
    >
      <div className="dialog-top">
        <span className="eyebrow">Projekt panelu · bez zapisu</span>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label="Zamknij panel"
        >
          Zamknij ×
        </button>
      </div>
      <h2 id="dialog-title">{preview.title}</h2>
      <div className="dialog-content">{preview.content}</div>
      <p className="notice" id="dialog-notice">
        {demoMessage}
      </p>
      {preview.confirm && (
        <button
          className="primary"
          type="button"
          onClick={() => {
            ref.current?.close();
            onConfirm();
          }}
        >
          Potwierdź — tylko podgląd
        </button>
      )}
    </dialog>
  );
}

export function StateExamples({
  showPreview,
  admin = false,
  cancellation = false,
}: {
  showPreview: ShowPreview;
  admin?: boolean;
  cancellation?: boolean;
}) {
  return (
    <details className="state-examples">
      <summary>Projekty stanów pustych, błędów i odmowy</summary>
      <p>
        Przykłady komunikatów przyszłej aplikacji. Nie są odpowiedziami API.
      </p>
      <div className="actions">
        <button
          onClick={() =>
            showPreview({
              title: 'Projekt: brak danych',
              content: (
                <p>
                  Brak wyników do wyświetlenia. Zmień filtry lub wróć do listy.
                  Przy braku sal albo studentów formularz nie pozwoli wybrać
                  terminu.
                </p>
              ),
            })
          }
        >
          Stan pusty
        </button>
        <button
          onClick={() =>
            showPreview({
              title: 'Projekt: błąd odczytu lub konflikt',
              content: (
                <p>
                  Nie udało się odczytać danych lub wybrany termin jest już
                  niedostępny. Sprawdź dane i ponów próbę. Dla sal: numer musi
                  być unikalny, a pojemność dodatnia. Dla blokad: terminy nie
                  mogą się nakładać.
                </p>
              ),
            })
          }
        >
          Stan błędu
        </button>
        {(admin || cancellation) && (
          <button
            onClick={() =>
              showPreview({
                title: admin
                  ? 'Projekt: brak uprawnień'
                  : 'Projekt: odmowa anulowania',
                content: (
                  <p>
                    {admin
                      ? 'Ten widok jest dostępny wyłącznie dla administratora. Docelowo rolę i sesję zweryfikuje API.'
                      : 'Nie można anulować cudzego, rozpoczętego, zakończonego lub już anulowanego wpisu. Lista wymaga ponownego odczytu.'}
                  </p>
                ),
              })
            }
          >
            {admin ? 'Brak uprawnień' : 'Odmowa anulowania'}
          </button>
        )}
      </div>
    </details>
  );
}
