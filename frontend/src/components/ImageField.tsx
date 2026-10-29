import { useEffect, useId, useState, type ChangeEvent } from 'react';
import { IMAGE_ACCEPT, validateImageFile } from '../lib/image-file';
import { errorAttributes } from '../lib/form-attributes';
import type { ImageChoice } from '../types/book';

interface ImageFieldProps {
  /** The cover the book has now (editing), or `null`. */
  currentUrl: string | null;
  choice: ImageChoice;
  onChange: (choice: ImageChoice) => void;
}

const frameClasses =
  'aspect-[2/3] w-24 shrink-0 rounded-md border border-slate-200 object-cover';

/**
 * The optional cover of the book: pick a file (checked here before anything is
 * sent; the server checks again, by content), see what will be saved, and, when
 * editing, keep, replace or remove the current one. The file is not a value of
 * the React Hook Form form, so the parent keeps the choice.
 */
export function ImageField({ currentUrl, choice, onChange }: ImageFieldProps) {
  const id = useId();
  const [error, setError] = useState<string | undefined>(undefined);
  // Changing the key gives the browser a fresh file input (its value cannot be set).
  const [inputKey, setInputKey] = useState(0);
  // The preview URL is made when the file is picked (an event, not an effect) and
  // revoked when it changes or the field goes away, so the browser does not keep
  // the file in memory. The pair is kept together: it is shown only for its file.
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(
    null,
  );
  useEffect(() => {
    const url = preview?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [preview]);
  const previewUrl =
    preview && preview.file === choice.image ? preview.url : null;

  function pick(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (!file) return;
    const problem = validateImageFile(file);
    if (problem) {
      setError(problem);
      setInputKey((key) => key + 1);
      setPreview(null);
      onChange({ ...choice, image: null });
      return;
    }
    setError(undefined);
    setPreview({ file, url: URL.createObjectURL(file) });
    onChange({ image: file, removeImage: false });
  }

  function clearChosen(): void {
    setError(undefined);
    setInputKey((key) => key + 1);
    setPreview(null);
    onChange({ ...choice, image: null });
  }

  const showsCurrent = currentUrl !== null && !choice.removeImage;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        Portada (opcional)
      </label>
      <div className="mt-2 flex items-start gap-4">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Vista previa de la portada elegida"
            className={frameClasses}
          />
        ) : showsCurrent ? (
          <img
            src={currentUrl}
            alt="Portada actual del libro"
            className={frameClasses}
          />
        ) : (
          <div
            role="img"
            aria-label="Este libro no tiene portada"
            className={`${frameClasses} flex items-center justify-center border-dashed bg-slate-100 text-center text-xs text-slate-500`}
          >
            Sin portada
          </div>
        )}

        <div className="space-y-2">
          <input
            key={inputKey}
            id={id}
            type="file"
            accept={IMAGE_ACCEPT}
            onChange={pick}
            className="block text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-100"
            {...errorAttributes(id, error)}
          />
          <p className="text-xs text-slate-500">JPG, PNG o WebP, hasta 2 MB.</p>
          {error && (
            <p id={`${id}-error`} className="text-sm text-red-700">
              {error}
            </p>
          )}
          {choice.image && (
            <button
              type="button"
              onClick={clearChosen}
              className="text-sm font-medium text-blue-700 underline"
            >
              Quitar el archivo elegido
            </button>
          )}
          {currentUrl && !choice.image && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={choice.removeImage}
                onChange={(event) =>
                  onChange({ image: null, removeImage: event.target.checked })
                }
                className="size-4 rounded border-slate-300"
              />
              Quitar la imagen actual
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
