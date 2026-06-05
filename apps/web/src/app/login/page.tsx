import { LoginForm } from './login-form';

export const metadata = { title: 'Sign in — Digital Twin FM' };

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-8">
      <header className="text-center">
        <h1 className="text-3xl font-bold">Digital Twin FM</h1>
        <p className="text-neutral-400 mt-1">Sign in to continue</p>
      </header>
      <LoginForm error={null} />
    </main>
  );
}
