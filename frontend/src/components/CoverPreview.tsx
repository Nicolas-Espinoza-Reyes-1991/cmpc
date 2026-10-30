import { useEffect, useId, useRef, useState } from 'react';

interface CoverPreviewProps {
  /** The cover file (`imageUrl` of the book). */
  src: string;
  /** Title of the book: names the thumbnail button and the enlarged view. */
  title: string;
  /** Called when the file fails to load, so the page can show its placeholder. */
  onError: () => void;
}

/**
 * The cover as a thumbnail that opens it at full size in a native `<dialog>`.
 * The browser traps the focus and closes it with Escape; `open` drives it, as
 * in `ConfirmDialog`. The enlarged image is rendered only while open, so the
 * page does not download it until the user asks for it.
 */
export function CoverPreview({ src, title, onError }: CoverPreviewProps) {
  const [open, setOpen] = useState(false);
  // A state, not a ref object: the effect runs again once the element exists.
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null);
  const thumbnail = useRef<HTMLButtonElement>(null);
  // A title can hold spaces, which an id cannot; `useId` gives a safe one.
  const titleId = useId();

  useEffect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [dialog, open]);

  return (
    <>
      <button
        ref={thumbnail}
        type="button"
        aria-label={`Ampliar portada de ${title}`}
        onClick={() => setOpen(true)}
        className="mx-auto block w-40 cursor-zoom-in rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:w-full"
      >
        <img
          src={src}
          alt={`Portada de ${title}`}
          loading="lazy"
          decoding="async"
          onError={onError}
          className="aspect-[2/3] w-full rounded-md border border-slate-200 object-cover"
        />
      </button>

      <dialog
        ref={setDialog}
        aria-labelledby={titleId}
        // Escape fires `cancel`; closing here keeps `open` and the dialog in step.
        onCancel={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
        // A click on the dialog itself lands on the backdrop, not on the image.
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
        // Back to the thumbnail, whichever way the dialog was closed.
        onClose={() => {
          setOpen(false);
          thumbnail.current?.focus();
        }}
        className="max-h-[90vh] max-w-[90vw] rounded-lg bg-white p-4 shadow-xl backdrop:bg-slate-900/80"
      >
        <div className="flex items-center justify-between gap-4">
          <h2
            id={titleId}
            className="truncate text-base font-semibold text-slate-900"
          >
            {title}
          </h2>
          <button
            type="button"
            // The close button has the focus when the dialog opens.
            autoFocus
            onClick={() => setOpen(false)}
            className="shrink-0 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Cerrar
          </button>
        </div>
        {open && (
          <img
            src={src}
            alt={`Portada de ${title}`}
            className="mx-auto mt-4 max-h-[75vh] max-w-full object-contain"
          />
        )}
      </dialog>
    </>
  );
}
