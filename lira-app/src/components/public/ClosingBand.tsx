import { Link } from 'react-router-dom';
import { PAGE_WIDTH } from './styles';

/** The black closing band: one line, one promise, one button. */
export function ClosingBand() {
  return (
    <section aria-labelledby="closing-title" className="bg-black text-white">
      <div className={`${PAGE_WIDTH} py-20 text-center flex flex-col items-center gap-5`}>
        <h2 id="closing-title" className="text-4xl sm:text-6xl font-bold tracking-tight text-balance">
          <span className="text-logo-gold">Plan</span>, learn and <span className="text-logo-gold">deliver</span> in Liraspaces
        </h2>
        <p className="text-lg text-white/80">Get started for free. No credit card required.</p>
        <Link to="/signup" className="mt-3 inline-flex items-center justify-center rounded-xl bg-lira-blue text-lira-on-blue px-8 py-4 text-lg font-bold hover:bg-lira-blue-hover transition-colors duration-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
          Get Liraspaces free
        </Link>
      </div>
    </section>
  );
}
