import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { MockInstance } from 'vitest';
import {
  IMAGE_EMPTY_MESSAGE,
  IMAGE_SIZE_MESSAGE,
  IMAGE_TYPE_MESSAGE,
  MAX_IMAGE_BYTES,
} from '../lib/image-file';
import type { ImageChoice } from '../types/book';
import { ImageField } from './ImageField';

const png = (size = 10, name = 'portada.png') =>
  new File([new Uint8Array(size).fill(1)], name, { type: 'image/png' });

/** The parent that owns the choice, as `BookForm` does. */
function Harness({
  currentUrl = null,
  onChange,
}: {
  currentUrl?: string | null;
  onChange?: (choice: ImageChoice) => void;
}) {
  const [choice, setChoice] = useState<ImageChoice>({
    image: null,
    removeImage: false,
  });
  return (
    <ImageField
      currentUrl={currentUrl}
      choice={choice}
      onChange={(next) => {
        setChoice(next);
        onChange?.(next);
      }}
    />
  );
}

const fileInput = () => screen.getByLabelText('Portada (opcional)');
/** `applyAccept` off: the real dialog filters by `accept`, but a drag and drop does not. */
const user = () => userEvent.setup({ applyAccept: false });

describe('ImageField', () => {
  let revoke: MockInstance<(url: string) => void>;

  beforeEach(() => {
    revoke = vi.spyOn(URL, 'revokeObjectURL');
  });

  afterEach(() => {
    revoke.mockRestore();
  });

  it('is labelled and offers only the accepted formats', () => {
    render(<Harness />);

    expect(fileInput()).toHaveAttribute('type', 'file');
    expect(fileInput()).toHaveAttribute(
      'accept',
      'image/jpeg,image/png,image/webp',
    );
    expect(
      screen.getByText('JPG, PNG o WebP, hasta 2 MB.'),
    ).toBeInTheDocument();
  });

  describe('without a cover', () => {
    it('shows a placeholder', () => {
      render(<Harness />);

      expect(
        screen.getByRole('img', { name: 'Este libro no tiene portada' }),
      ).toHaveTextContent('Sin portada');
    });

    it('offers no way to remove a cover that does not exist', () => {
      render(<Harness />);

      expect(
        screen.queryByLabelText('Quitar la imagen actual'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Quitar el archivo elegido' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('choosing a file', () => {
    it('reports the file and shows a preview of it', async () => {
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);
      const file = png();

      await user().upload(fileInput(), file);

      expect(onChange).toHaveBeenLastCalledWith({
        image: file,
        removeImage: false,
      });
      const preview = screen.getByRole('img', {
        name: 'Vista previa de la portada elegida',
      });
      expect(preview.getAttribute('src')).toMatch(/^blob:/);
    });

    it.each([
      [
        'a GIF',
        new File(['x'], 'a.gif', { type: 'image/gif' }),
        IMAGE_TYPE_MESSAGE,
      ],
      [
        'a PDF',
        new File(['x'], 'a.pdf', { type: 'application/pdf' }),
        IMAGE_TYPE_MESSAGE,
      ],
      [
        'an empty file',
        new File([], 'a.png', { type: 'image/png' }),
        IMAGE_EMPTY_MESSAGE,
      ],
      [
        'a file over 2 MB',
        new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], 'big.png', {
          type: 'image/png',
        }),
        IMAGE_SIZE_MESSAGE,
      ],
    ])(
      'rejects %s with a message and keeps no file',
      async (_label, file, message) => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);

        await user().upload(fileInput(), file);

        expect(screen.getByText(message)).toBeInTheDocument();
        expect(onChange).toHaveBeenLastCalledWith({
          image: null,
          removeImage: false,
        });
        expect(
          screen.queryByRole('img', {
            name: 'Vista previa de la portada elegida',
          }),
        ).not.toBeInTheDocument();
      },
    );

    it('ties the error to the input for screen readers', async () => {
      render(<Harness />);

      await user().upload(
        fileInput(),
        new File(['x'], 'a.gif', { type: 'image/gif' }),
      );

      expect(fileInput()).toHaveAttribute('aria-invalid', 'true');
      expect(fileInput()).toHaveAccessibleDescription(
        expect.stringContaining(IMAGE_TYPE_MESSAGE),
      );
    });

    it('accepts exactly 2 MB', async () => {
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);
      const file = new File([new Uint8Array(MAX_IMAGE_BYTES)], 'ok.png', {
        type: 'image/png',
      });

      await user().upload(fileInput(), file);

      expect(onChange).toHaveBeenLastCalledWith({
        image: file,
        removeImage: false,
      });
    });

    it('clears the error when a valid file is chosen next', async () => {
      render(<Harness />);
      const session = user();
      await session.upload(
        fileInput(),
        new File(['x'], 'a.gif', { type: 'image/gif' }),
      );
      expect(screen.getByText(IMAGE_TYPE_MESSAGE)).toBeInTheDocument();

      await session.upload(fileInput(), png());

      expect(screen.queryByText(IMAGE_TYPE_MESSAGE)).not.toBeInTheDocument();
      expect(fileInput()).toHaveAttribute('aria-invalid', 'false');
    });

    it('replaces the preview when another file is chosen and revokes the old URL', async () => {
      render(<Harness />);
      const session = user();
      await session.upload(fileInput(), png(10, 'uno.png'));
      const first = screen
        .getByRole('img', { name: 'Vista previa de la portada elegida' })
        .getAttribute('src');

      await session.upload(fileInput(), png(20, 'dos.png'));

      const second = screen
        .getByRole('img', { name: 'Vista previa de la portada elegida' })
        .getAttribute('src');
      expect(second).not.toBe(first);
      expect(revoke).toHaveBeenCalledWith(first);
    });

    it('revokes the preview URL when the field goes away', async () => {
      const { unmount } = render(<Harness />);
      await user().upload(fileInput(), png());
      const url = screen
        .getByRole('img', { name: 'Vista previa de la portada elegida' })
        .getAttribute('src');

      unmount();

      expect(revoke).toHaveBeenCalledWith(url);
    });

    it('does nothing when the browser reports a change with no file (dialog cancelled)', () => {
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);

      fireEvent.change(fileInput(), { target: { files: [] } });

      expect(onChange).not.toHaveBeenCalled();
      expect(screen.queryByText(IMAGE_TYPE_MESSAGE)).not.toBeInTheDocument();
    });
  });

  describe('removing the chosen file', () => {
    it('offers it only while a file is chosen, and clears it', async () => {
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);
      await user().upload(fileInput(), png());

      await userEvent.click(
        screen.getByRole('button', { name: 'Quitar el archivo elegido' }),
      );

      expect(onChange).toHaveBeenLastCalledWith({
        image: null,
        removeImage: false,
      });
      expect(
        screen.queryByRole('img', {
          name: 'Vista previa de la portada elegida',
        }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Quitar el archivo elegido' }),
      ).not.toBeInTheDocument();
    });

    it('lets the same file be chosen again afterwards', async () => {
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);
      const file = png();
      const session = user();
      await session.upload(fileInput(), file);
      await userEvent.click(
        screen.getByRole('button', { name: 'Quitar el archivo elegido' }),
      );

      await session.upload(fileInput(), file);

      expect(onChange).toHaveBeenLastCalledWith({
        image: file,
        removeImage: false,
      });
    });
  });

  describe('editing a book that has a cover', () => {
    const current = '/api/uploads/3f6c2a52-7f0e-4c3e-9d57-1d8f0f6a9b11.png';

    it('shows the current cover', () => {
      render(<Harness currentUrl={current} />);

      expect(
        screen.getByRole('img', { name: 'Portada actual del libro' }),
      ).toHaveAttribute('src', current);
    });

    it('shows the new file instead of the current cover once one is chosen', async () => {
      render(<Harness currentUrl={current} />);

      await user().upload(fileInput(), png());

      expect(
        screen.queryByRole('img', { name: 'Portada actual del libro' }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('img', { name: 'Vista previa de la portada elegida' }),
      ).toBeInTheDocument();
    });

    it('returns to the current cover when the chosen file is cleared', async () => {
      render(<Harness currentUrl={current} />);
      await user().upload(fileInput(), png());

      await userEvent.click(
        screen.getByRole('button', { name: 'Quitar el archivo elegido' }),
      );

      expect(
        screen.getByRole('img', { name: 'Portada actual del libro' }),
      ).toBeInTheDocument();
    });

    it('offers to remove the current cover and then shows the placeholder', async () => {
      const onChange = vi.fn();
      render(<Harness currentUrl={current} onChange={onChange} />);

      await userEvent.click(screen.getByLabelText('Quitar la imagen actual'));

      expect(onChange).toHaveBeenLastCalledWith({
        image: null,
        removeImage: true,
      });
      expect(
        screen.queryByRole('img', { name: 'Portada actual del libro' }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('img', { name: 'Este libro no tiene portada' }),
      ).toBeInTheDocument();
    });

    it('brings the current cover back when the removal is undone', async () => {
      render(<Harness currentUrl={current} />);
      await userEvent.click(screen.getByLabelText('Quitar la imagen actual'));

      await userEvent.click(screen.getByLabelText('Quitar la imagen actual'));

      expect(
        screen.getByRole('img', { name: 'Portada actual del libro' }),
      ).toBeInTheDocument();
    });

    it('choosing a file cancels the removal of the current cover', async () => {
      const onChange = vi.fn();
      render(<Harness currentUrl={current} onChange={onChange} />);
      await userEvent.click(screen.getByLabelText('Quitar la imagen actual'));
      const file = png();

      await user().upload(fileInput(), file);

      expect(onChange).toHaveBeenLastCalledWith({
        image: file,
        removeImage: false,
      });
      expect(
        screen.queryByLabelText('Quitar la imagen actual'),
      ).not.toBeInTheDocument();
    });
  });
});
