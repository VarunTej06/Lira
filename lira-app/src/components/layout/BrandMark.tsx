import { LiraLogo } from '../common/LiraLogo';
import { isHosted, type Edition } from '../../utils/edition';

/** The logo and name at the left of the top bar. In the hosted edition the logo leads to the coming-soon page. */
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
  // A plain link, not the router's: /coming-soon is outside the /app base path the router works under
  return isHosted(edition)
    ? <a href="/coming-soon" aria-label="Liraspaces" className={box}>{mark}</a>
    : <div className={box}>{mark}</div>;
}
