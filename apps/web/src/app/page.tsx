import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

// Per Finding 4: instead of just checking for cookie presence (which the
// audit flagged as a regression risk — anyone with a malformed cookie would
// be treated as "logged in"), we use getSession() which actually verifies
// the JWT signature/audience/issuer. Only a real, valid token grants access
// to /dashboard.
export default async function RootPage() {
  const session = await getSession();
  if (session) {
    redirect('/dashboard');
  }
  redirect('/login');
}
