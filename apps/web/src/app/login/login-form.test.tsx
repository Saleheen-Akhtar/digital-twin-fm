import { render, screen } from '@testing-library/react';
import { LoginForm } from './login-form';

describe('LoginForm', () => {
  it('renders email and password fields', () => {
    render(<LoginForm error={null} />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows an error message when error prop is set', () => {
    render(<LoginForm error="Bad credentials" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Bad credentials');
  });
});
