import { Link, useSearchParams } from 'react-router-dom';
import { useEmailVerification } from '../../hooks/useEmailVerification';
import { goTo } from '../../utils/navigate';
import { AuthCard } from './AuthCard';
import { BTN, LINK } from './styles';

/** The page the "confirm your email" link opens. */
export default function VerifyEmailPage() {
  const state = useEmailVerification(useSearchParams()[0].get('token') ?? '');
  if (state.phase === 'checking') return <AuthCard title="Confirming your email"><p role="status" className="text-ui text-lira-muted">One moment.</p></AuthCard>;
  if (state.phase === 'ok') {
    return (
      <AuthCard title="Your email is confirmed">
        <p role="status" className="text-ui">Thank you. Your address is confirmed.</p>
        <button type="button" onClick={() => goTo('/app')} className={`${BTN} w-full`}>Open Liraspaces</button>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="This link did not work">
      <p role="alert" className="text-ui">{state.message}</p>
      <p className="text-ui text-center"><Link to="/login" className={LINK}>Log in</Link> and ask for a new link from the reminder in the app.</p>
    </AuthCard>
  );
}
