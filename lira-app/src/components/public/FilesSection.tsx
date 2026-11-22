import { Link } from 'react-router-dom';
import { BTN_GHOST, PAGE_WIDTH } from './styles';

const INCLUDES = ['Boards', 'Sprints', 'Roadmaps', 'Dashboards', 'Documents', 'Forms', 'Viva'] as const;

const CARD = 'rounded-lg p-3 flex flex-col gap-2 text-ui border';
const PLAIN = 'bg-lira-surface border-lira-border';
const DARK = 'bg-lira-nav text-white border-lira-nav';
const LINE = 'h-2 rounded bg-gray-200';

function Picture() {
  return (
    <div role="img" aria-label="Sample ticket, document, form and Viva chat side by side" className="bg-gray-100 rounded-xl p-5 sm:p-8 grid grid-cols-2 gap-3 min-w-0">
      <div className={`${CARD} ${PLAIN}`}><b>OPS-31 Draft the Q1 review notes</b><span className="text-xs text-lira-muted">Work, in progress</span></div>
      <div className={`${CARD} ${PLAIN}`}><b>Document: Q1 review</b><span className={`${LINE} w-full`} /><span className={`${LINE} w-4/5`} /><span className={`${LINE} w-3/5`} /></div>
      <div className={`${CARD} ${PLAIN}`}><b>Form: Request access</b><span className="border border-lira-border rounded px-2 py-1 text-xs text-lira-muted">Name</span><span className="border border-lira-border rounded px-2 py-1 text-xs text-lira-muted">Reason</span></div>
      <div className={`${CARD} ${DARK}`}><b>Viva</b><span className="text-xs text-white/80">Draft ready for your approval</span></div>
    </div>
  );
}

/** "Liraspaces is better with documents and files": what a space holds beside tickets. There is no pricing link. */
export function FilesSection() {
  return (
    <section className="border-t border-lira-border" aria-labelledby="files-title">
      <div className={`${PAGE_WIDTH} py-14 grid gap-10 lg:grid-cols-2 items-center`}>
        <div className="flex flex-col gap-5">
          <p className="text-lg"><b>Spaces</b> <span className="text-lira-muted">in Liraspaces</span></p>
          <h2 id="files-title" className="text-3xl sm:text-5xl font-bold tracking-tight text-balance">Liraspaces is better with documents and files</h2>
          <p className="text-lira-muted text-base max-w-prose">
            Keep the notes, forms and attachments next to the tickets they belong to. A space holds the whole piece of work,
            from the first idea to the last file.
          </p>
          <div>
            <p className="text-xs font-bold tracking-widest mb-3">INCLUDES</p>
            <ul className="flex flex-wrap gap-x-6 gap-y-3">
              {INCLUDES.map(name => (
                <li key={name} className="flex items-center gap-2.5 text-base">
                  <span aria-hidden="true" className="w-9 h-9 rounded-lg bg-lira-nav text-white font-bold flex items-center justify-center">{name[0]}</span>{name}
                </li>
              ))}
            </ul>
          </div>
          <div><Link to="/signup" className={`${BTN_GHOST} rounded-xl`}>Try them all free</Link></div>
        </div>
        <Picture />
      </div>
    </section>
  );
}
