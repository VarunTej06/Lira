import { useEffect, useState } from 'react';
import { verifyEmail, type AuthResult } from '../services/authApi';

/** One request per link, even when React runs the effect twice: a link works only once. */
const attempts = new Map<string, Promise<AuthResult<void>>>();
export function forgetVerifications(): void { attempts.clear(); }

export type Verification = { phase: 'checking' } | { phase: 'ok' } | { phase: 'failed'; message: string };
const NO_TOKEN: Verification = { phase: 'failed', message: 'This link is not valid. Open the link from the email exactly as it came.' };

/** Confirms the address with the link's token and says how it went. No token is a failure without asking the server. */
export function useEmailVerification(token: string): Verification {
  const [state, setState] = useState<Verification>(token ? { phase: 'checking' } : NO_TOKEN);
  useEffect(() => {
    if (!token) return;
    let current = true;
    if (!attempts.has(token)) attempts.set(token, verifyEmail(token));
    void attempts.get(token)!.then(result => { if (current) setState(result.ok ? { phase: 'ok' } : { phase: 'failed', message: result.message }); });
    return () => { current = false; };
  }, [token]);
  return state;
}
