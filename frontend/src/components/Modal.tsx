"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Wraps the native <dialog>, which provides focus trapping, Escape-to-close and
 * restores focus to the opener for free.
 */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    // No cleanup that calls close(): in dev, React Strict Mode runs effects twice, and close()
    // would fire the dialog's "close" event, which calls onClose and dismisses the modal instantly.
    // Unmounting the element already removes an open dialog.
  }, []);

  return (
    <dialog ref={ref} className="modal" aria-labelledby="modal-title" onClose={onClose}>
      <div className="modal-body">
        <h2 id="modal-title">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p style={{ marginBottom: 18 }}>{message}</p>
      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
          {busy ? "Deleting…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
