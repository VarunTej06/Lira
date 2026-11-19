import type { ReactNode } from 'react';
import { PlanPanel, SearchPanel, VivaPanel } from './FeaturePanels';
import { PAGE_WIDTH } from './styles';

const ROWS: readonly { title: string; text: string; panel: ReactNode }[] = [
  { title: 'Search', text: 'Find any ticket, project or roadmap from one search bar, and open it straight from the result.', panel: <SearchPanel /> },
  { title: 'Viva', text: 'Ask what you worked on, what is late, or what to do next. Viva answers from your own spaces and drafts changes that wait for your approval.', panel: <VivaPanel /> },
  { title: 'Roadmaps and dashboards', text: 'Plan epics over time with Now, Next and Later, and keep weekly dashboard snapshots as files you own.', panel: <PlanPanel /> },
];

/** "More than project management": three features, each with its picture, set in alternating rows. */
export function MoreSection() {
  return (
    <section className="border-t border-lira-border" aria-labelledby="more-title">
      <div className={`${PAGE_WIDTH} py-14 flex flex-col gap-12`}>
        <div className="max-w-3xl">
          <h2 id="more-title" className="text-3xl sm:text-5xl font-bold tracking-tight mb-4 text-balance">More than project management</h2>
          <p className="text-lira-muted text-lg">Turn your record of work into a way of acting on it. Search, an assistant and plans all work on the same tickets.</p>
        </div>
        {ROWS.map((row, i) => (
          <div key={row.title} className="grid gap-8 md:grid-cols-2 items-center">
            <div className={i % 2 === 1 ? 'md:order-2' : ''}>{row.panel}</div>
            <div className={`${i % 2 === 1 ? 'md:order-1' : ''} flex flex-col gap-3`}>
              <h3 className="text-3xl font-bold tracking-tight">{row.title}</h3>
              <p className="text-lira-muted text-base max-w-prose">{row.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
