import { Link } from 'react-router-dom';
import { BTN_GHOST, PAGE_WIDTH } from './styles';

/** Where the logo leads from inside the hosted app until its real page is decided. */
export default function ComingSoonPage() {
  return (
    <section className={`${PAGE_WIDTH} max-w-xl py-20 text-center flex flex-col items-center gap-4`}>
      <h1 className="text-3xl font-bold tracking-tight">Still baking</h1>
      <p className="text-lira-muted">This page is on its way. Come back soon.</p>
      <Link to="/" className={BTN_GHOST}>Back to the start</Link>
    </section>
  );
}
