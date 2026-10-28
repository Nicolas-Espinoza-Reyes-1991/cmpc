import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('shows the application title', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { name: 'CMPC Libros' }),
    ).toBeInTheDocument();
  });
});
