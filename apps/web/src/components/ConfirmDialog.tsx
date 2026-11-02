import { useEffect, useRef, type ReactNode } from 'react';
export function ConfirmDialog({
  title,
  children,
  pending,
  error,
  onClose,
  onConfirm,
  confirmLabel,
}: {
  title: string;
  children: ReactNode;
  pending: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const trigger = document.activeElement;
    const dialog = ref.current!;
    dialog.showModal();
    dialog.querySelector('button')?.focus();
    return () => {
      dialog.close();
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus();
      else document.querySelector<HTMLElement>('.page-heading h2')?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      aria-describedby="confirm-description"
      aria-busy={pending}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>(
          'button:not([disabled])',
        );
        const first = buttons[0],
          last = buttons[buttons.length - 1];
        if (!first) {
          event.preventDefault();
          return;
        }
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      <div className="dialog-top">
        <span className="eyebrow">Potwierdzenie operacji</span>
        <button type="button" disabled={pending} onClick={onClose}>
          Wróć
        </button>
      </div>
      <h2 id="confirm-title">{title}</h2>
      <div id="confirm-description" className="dialog-content">
        {children}
      </div>
      <p role="alert">{error}</p>
      <button
        type="button"
        className="primary"
        disabled={pending || Boolean(error)}
        onClick={onConfirm}
      >
        {pending ? 'Trwa operacja…' : confirmLabel}
      </button>
    </dialog>
  );
}
