import { useEffect, useState } from 'react';
import { beginTwoStep, confirmTwoStep, disableTwoStep, twoStepStatus, type TwoStepSetup, type TwoStepStatus } from '../../services/twoStepApi';
import { BUTTON, FIELD } from '../teams/teamsUi';

type Step = { kind: 'idle' } | { kind: 'setup'; setup: TwoStepSetup } | { kind: 'codes'; codes: string[] } | { kind: 'turning-off' };

/** Account security: two-step sign-in with an authenticator app. Turned on with a first code, and off again only with a current code. */
export function SecurityPanel() {
  const [status, setStatus] = useState<TwoStepStatus | null>(null);
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const [code, setCode] = useState('');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    void twoStepStatus().then(r => { if (current && r.ok) setStatus(r.data); });
    return () => { current = false; };
  }, []);

  async function run(work: () => Promise<{ ok: true } | { ok: false; message: string }>) {
    setBusy(true); setProblem('');
    const r = await work();
    setBusy(false);
    if (!r.ok) setProblem(r.message);
  }
  const start = () => run(async () => {
    const r = await beginTwoStep();
    if (r.ok) { setStep({ kind: 'setup', setup: r.data }); setCode(''); }
    return r;
  });
  const confirmCode = () => run(async () => {
    const r = await confirmTwoStep(code.trim());
    if (r.ok) { setStep({ kind: 'codes', codes: r.data.recoveryCodes }); setStatus({ available: true, enabled: true }); setCode(''); }
    return r;
  });
  const turnOff = () => run(async () => {
    const r = await disableTwoStep(code.trim());
    if (r.ok) { setStep({ kind: 'idle' }); setStatus({ available: true, enabled: false }); setCode(''); }
    return r;
  });

  return (
    <div className="space-y-4 text-ui">
        {!status && <p role="status" className="text-lira-muted">Loading</p>}
        {status && !status.available && <p className="text-lira-muted">Two-step sign-in is not set up on this server.</p>}
        {status?.available && step.kind === 'idle' && (
          <section aria-label="Two-step sign-in" className="space-y-2">
            <h3 className="font-bold">Two-step sign-in</h3>
            <p className="text-lira-muted">{status.enabled ? 'On. After your password you also type a code from your authenticator app.' : 'Off. Add an authenticator app so a stolen password alone is not enough to get in.'}</p>
            {status.enabled
              ? <button type="button" onClick={() => { setStep({ kind: 'turning-off' }); setCode(''); setProblem(''); }} className="rounded px-3 py-1.5 border border-lira-border">Turn off</button>
              : <button type="button" disabled={busy} onClick={() => { void start(); }} className={BUTTON}>Turn on</button>}
          </section>
        )}
        {step.kind === 'setup' && (
          <section aria-label="Set up two-step sign-in" className="space-y-2">
            <p>In your authenticator app (Google Authenticator, Microsoft Authenticator, 1Password and others) add an account and type this key:</p>
            <p><code aria-label="Setup key" className="select-all font-mono text-sm break-all">{step.setup.secret}</code></p>
            <p className="text-lira-muted">Or open <a href={step.setup.uri} className="underline">this link</a> on the phone that has the app. Then type the six digits it shows.</p>
            <input aria-label="Code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value)} className={`${FIELD} w-40`} />
            <div className="flex gap-2">
              <button type="button" disabled={busy || !code.trim()} onClick={() => { void confirmCode(); }} className={BUTTON}>Turn on</button>
              <button type="button" onClick={() => { setStep({ kind: 'idle' }); setProblem(''); }} className="rounded px-3 py-1.5 border border-lira-border">Cancel</button>
            </div>
          </section>
        )}
        {step.kind === 'codes' && (
          <section aria-label="Recovery codes" className="space-y-2">
            <p className="font-bold">Two-step sign-in is on.</p>
            <p>Keep these ten recovery codes somewhere safe. Each works once if you lose your phone. They are shown only now.</p>
            <ul className="grid grid-cols-2 gap-1 font-mono text-sm">{step.codes.map(c => <li key={c}>{c}</li>)}</ul>
            <button type="button" onClick={() => { setStep({ kind: 'idle' }); }} className={BUTTON}>I have saved them</button>
          </section>
        )}
        {step.kind === 'turning-off' && (
          <section aria-label="Turn off two-step sign-in" className="space-y-2">
            <p>Type a current code from your app, or a recovery code, to turn it off.</p>
            <input aria-label="Code" autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value)} className={`${FIELD} w-40`} />
            <div className="flex gap-2">
              <button type="button" disabled={busy || !code.trim()} onClick={() => { void turnOff(); }} className={BUTTON}>Turn off</button>
              <button type="button" onClick={() => { setStep({ kind: 'idle' }); setProblem(''); }} className="rounded px-3 py-1.5 border border-lira-border">Cancel</button>
            </div>
          </section>
        )}
        {problem && <p role="alert" className="text-red-600">{problem}</p>}
    </div>
  );
}
