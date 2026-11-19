import { useNavigate } from 'react-router-dom';
import { AiBand } from './AiBand';
import { BoardPreview } from './BoardPreview';
import { ClosingBand } from './ClosingBand';
import { DiscoverCards } from './DiscoverCards';
import { FilesSection } from './FilesSection';
import { MoreSection } from './MoreSection';
import { EmailBar } from './EmailBar';
import { DATA_POINTS, FEATURES } from './landingContent';
import { PAGE_WIDTH } from './styles';

/** The first public page: what Liraspaces is, what is inside it, and how the data is treated. */
export default function LandingPage() {
  const navigate = useNavigate();
  return (
    <>
      <section className="px-4 sm:px-10 pt-14 pb-8 text-center flex flex-col items-center">
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-tight max-w-4xl text-balance">Everything you are working on and learning, in one place.</h1>
        <p className="mt-5 text-lira-muted text-lg max-w-2xl">
          Tickets, boards, sprints, roadmaps and dashboards for people who study and for the people who manage them.
          Viva, the built-in assistant, finds things and drafts changes, and you approve each one.
        </p>
        <div className="mt-8 w-full flex justify-center">
          <EmailBar id="hero-email" onValid={email => navigate(`/signup?email=${encodeURIComponent(email)}`)} />
        </div>
        <p className="mt-3 text-xs text-lira-muted">Free while we build it. No credit card needed.</p>
      </section>
      <section className={`${PAGE_WIDTH} pb-14`}><BoardPreview /></section>

      <section id="inside" className="border-t border-lira-border">
        <div className={`${PAGE_WIDTH} grid gap-9 md:grid-cols-[minmax(0,.8fr)_minmax(0,1.6fr)] py-11`}>
          <h2 className="text-2xl font-bold tracking-tight">What is inside</h2>
          <dl>
            {FEATURES.map(([term, text]) => (
              <div key={term} className="grid gap-1 sm:grid-cols-[minmax(0,.7fr)_minmax(0,1.3fr)] sm:gap-5 py-3.5 border-t border-lira-border first:border-t-0 first:pt-0">
                <dt className="font-bold">{term}</dt>
                <dd className="text-lira-muted">{text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <MoreSection />
      <FilesSection />
      <AiBand />
      <DiscoverCards />
      <section id="data" className="border-t border-lira-border">
        <div className={`${PAGE_WIDTH} grid gap-9 md:grid-cols-[minmax(0,.8fr)_minmax(0,1.6fr)] py-11`}>
          <h2 className="text-2xl font-bold tracking-tight">Your data</h2>
          <div className="flex flex-col gap-3.5 max-w-prose text-lira-muted">
            {DATA_POINTS.map(([lead, text]) => <p key={lead}><b className="text-lira-text">{lead}</b> {text}</p>)}
          </div>
        </div>
      </section>

      <ClosingBand />
    </>
  );
}
