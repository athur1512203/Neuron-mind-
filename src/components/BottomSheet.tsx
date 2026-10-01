import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./ui/Button";

type BottomSheetProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function BottomSheet({ open, title, onClose, children }: BottomSheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const buttons = dialogRef.current?.querySelectorAll<HTMLElement>("button, input");
    buttons?.[0]?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button, input, textarea, [href]") ?? []);
      if (!items.length) return;
      event.preventDefault();
      const index = items.indexOf(document.activeElement as HTMLElement);
      const next = event.shiftKey ? (index <= 0 ? items.length - 1 : index - 1) : (index + 1) % items.length;
      items[next]?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="nm-sheet" role="presentation">
      <button type="button" className="nm-sheet-backdrop" aria-label="Đóng" onClick={onClose} />
      <div
        ref={dialogRef}
        className="nm-sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="nm-sheet-handle" aria-hidden="true" />
        <div className="nm-sheet-head">
          <h2 id={titleId}>{title}</h2>
          <Button variant="secondary" size="sm" onClick={onClose}>Xong</Button>
        </div>
        <div className="nm-sheet-body">{children}</div>
      </div>
    </div>
  );
}
