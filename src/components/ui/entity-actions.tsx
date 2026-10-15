"use client";

import { useEffect, useRef, useState } from "react";

export function EntityActions({
  label,
  impact = [],
  onEdit,
  onArchive,
  onDelete,
}: {
  label: string;
  impact?: string[];
  onEdit?: () => void;
  onArchive?: () => Promise<void> | void;
  onDelete: (confirmation: string) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!confirming) return;
    dialog.current?.querySelector<HTMLElement>("input")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setConfirming(false);
        return;
      }
      if (event.key !== "Tab" || !dialog.current) return;
      const focusable = [
        ...dialog.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ];
      if (!focusable.length) return;
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [confirming]);

  async function remove() {
    setDeleting(true);
    setError("");
    try {
      await onDelete(confirmation);
      setConfirming(false);
      setConfirmation("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Deletion failed.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <details className="action-menu">
        <summary aria-label={`Actions for ${label}`}>•••</summary>
        <div role="menu">
          {onEdit && (
            <button role="menuitem" onClick={onEdit}>
              Edit
            </button>
          )}
          {onArchive && (
            <button role="menuitem" onClick={() => void onArchive()}>
              Archive
            </button>
          )}
          <button
            role="menuitem"
            className="danger-text"
            onClick={() => {
              setError("");
              setConfirmation("");
              setConfirming(true);
            }}
          >
            Delete permanently
          </button>
        </div>
      </details>
      {confirming && (
        <div
          className="dialog-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setConfirming(false)
          }
        >
          <div
            ref={dialog}
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            aria-describedby="delete-description"
          >
            <span className="danger-icon" aria-hidden="true">
              !
            </span>
            <h2 id="delete-title">Permanently delete “{label}”?</h2>
            <p id="delete-description">This cannot be undone.</p>
            {impact.length > 0 && (
              <div className="delete-impact">
                <strong>Relationship impact</strong>
                <ul>
                  {impact.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            <label>
              Type <strong>DELETE</strong> to confirm
              <input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <button
                className="button-secondary"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </button>
              <button
                className="button-danger"
                disabled={confirmation !== "DELETE" || deleting}
                onClick={() => void remove()}
              >
                {deleting ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
