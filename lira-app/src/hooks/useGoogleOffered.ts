import { useEffect, useState } from 'react';
import { fetchProviders } from '../services/authApi';

/** Whether the server offers Google sign-in, asked once and kept for the next button. */
let asked: Promise<boolean> | null = null;
export function forgetProviders(): void { asked = null; }

/** False until the server says Google is set up, and when it cannot be asked: a Google button is never on when it would do nothing. */
export function useGoogleOffered(): boolean {
  const [offered, setOffered] = useState(false);
  useEffect(() => {
    let current = true;
    asked ??= fetchProviders().then(r => r.ok && r.data.google === true);
    void asked.then(v => { if (current) setOffered(v); });
    return () => { current = false; };
  }, []);
  return offered;
}
