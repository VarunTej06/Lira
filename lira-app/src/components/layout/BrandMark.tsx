import { Link } from 'react-router-dom';
import { LiraLogo } from '../common/LiraLogo';
import { isHosted, type Edition } from '../../utils/edition';

/** The logo and name at the left of the top bar. In the hosted edition they lead to For you, inside the app: never out to the public pages. */
export function BrandMark({ edition }: { edition?: Edition }) {
  const mark = (
    <>
      <span className="w-10 h-10 rounded-full bg-lira-nav border border-white/10 flex items-center justify-center flex-shrink-0">
        <LiraLogo className="w-6 h-6 text-white" />
      </span>
      <span className="hidden sm:inline text-lira-text font-bold text-lg tracking-tight">Liraspaces</span>
    </>
  );
  const box = 'flex-1 basis-0 flex items-center gap-2 select-none';
  return isHosted(edition)
    ? <Link to="/for-you" aria-label="Liraspaces" className={box}>{mark}</Link>
    : <div className={box}>{mark}</div>;
}
