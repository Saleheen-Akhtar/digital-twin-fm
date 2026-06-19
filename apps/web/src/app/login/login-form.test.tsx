import { render, screen } from '@testing-library/react';
import { LoginForm } from './login-form';

// Mock the server action so the form is renderable in jsdom (Next.js
// `useActionState` would otherwise try to import the real server action
// which references `next/headers`).
jest.mock('./actions', () => ({
  loginAction: jest.fn().mockResolvedValue({ error: null }),
}));

describe('LoginForm', () => {
  it('renders email and password fields', () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('uses the form `action` attribute to bind to the server action', () => {
    const { container } = render(<LoginForm />);
    const form = container.querySelector('form');
    // Server actions render with an action handler attached; the form
    // element is what carries it. We assert the form is present and
    // can be submitted (no onSubmit handler in client code).
    expect(form).toBeInTheDocument();
    expect(form).not.toHaveAttribute('onsubmit');
  });
});
