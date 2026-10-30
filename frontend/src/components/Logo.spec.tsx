import { render, screen } from '@testing-library/react';
import { Logo } from './Logo';

describe('Logo', () => {
  it('is an image named after the application, for screen readers', () => {
    render(<Logo />);

    const logo = screen.getByRole('img', { name: 'CMPC Libros' });
    expect(logo).toHaveAttribute('src', expect.stringContaining('logo-cmpc'));
  });

  it('reserves the proportion of the original file and never sets a width', () => {
    render(<Logo className="h-8" />);

    const logo = screen.getByRole('img', { name: 'CMPC Libros' });
    expect(logo).toHaveAttribute('width', '192');
    expect(logo).toHaveAttribute('height', '77');
    // Height comes from the caller; the width follows from the proportion.
    expect(logo).toHaveClass('h-8', 'w-auto');
  });

  it('works without a class', () => {
    render(<Logo />);

    expect(screen.getByRole('img', { name: 'CMPC Libros' })).toHaveClass(
      'w-auto',
    );
  });
});
