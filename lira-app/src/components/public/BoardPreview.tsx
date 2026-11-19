import { SAMPLE_BOARD, SAMPLE_SIDEBAR, SAMPLE_TABS } from './landingContent';

/** A drawn sample of the product for the landing page: a space with its tabs and a board of example tickets. It is a picture, not the live app. */
export function BoardPreview() {
  return (
    <div role="img" aria-label="Sample space in Liraspaces: a board with example tickets and a draft from Viva waiting for approval" className="bg-app-frame rounded-xl p-3 sm:p-5 min-w-0">
      <div className="grid grid-cols-1 md:grid-cols-[8rem_minmax(0,1fr)] bg-lira-surface border border-lira-border rounded-lg overflow-hidden text-2xs sm:text-xs">
        <div className="hidden md:flex flex-col gap-1 bg-lira-nav text-white/85 p-2.5">
          {SAMPLE_SIDEBAR.map(name => (
            <div key={name} className={`px-2.5 py-2 rounded ${name === 'Board' ? 'bg-white/15 font-bold' : ''}`}>{name}</div>
          ))}
        </div>
        <div className="p-3 sm:p-4 min-w-0">
          <div className="flex flex-wrap justify-between gap-2 mb-1 text-sm">
            <b>AZ-104 certification</b>
            <span className="text-lira-muted text-xs">Sprint 4</span>
          </div>
          <div className="flex gap-4 border-b border-lira-border mb-3 overflow-hidden">
            {SAMPLE_TABS.map(tab => (
              <span key={tab} className={`py-2 ${tab === 'Board' ? 'font-bold border-b-2 border-lira-blue' : 'text-lira-muted'}`}>{tab}</span>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SAMPLE_BOARD.map(([column, tickets]) => (
              <div key={column} className="bg-gray-100 rounded-lg p-2 flex flex-col gap-2 min-w-0">
                <div className="flex justify-between font-bold text-lira-muted px-0.5">{column}<span>{tickets.length}</span></div>
                {tickets.map(([key, title, kind]) => (
                  <div key={title} className="bg-lira-surface border border-lira-border rounded-md p-2.5 flex flex-col gap-2">
                    <span className="leading-snug">{title}</span>
                    <span className="flex justify-between text-lira-muted"><b className="text-lira-text">{key}</b><span>{kind}</span></span>
                    {title === 'Sprint 12 goal check' && (
                      <span className="rounded bg-lira-blue text-lira-on-blue px-2 py-1 font-bold">Viva: draft ready for your approval</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
