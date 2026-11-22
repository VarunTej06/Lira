/** The three pictures of "More than project management", drawn in the theme's colours. They show the product; they are not the live app. */
const CARD = 'bg-lira-surface border border-lira-border rounded-lg';

export function SearchPanel() {
  const results = [['AZ-104', 'Virtual networks lab', 'Study space'], ['OPS-28', 'Sprint 12 goal check', 'Work space'], ['RM-3', 'Platform roadmap', 'Roadmaps']] as const;
  return (
    <div role="img" aria-label="Sample search listing a ticket, a sprint ticket and a roadmap" className="bg-lira-blue-light rounded-xl p-5 sm:p-8">
      <div className={`${CARD} p-4 flex flex-col gap-3`}>
        <p className="font-bold text-base text-center">All your work, one search</p>
        <div className="border border-lira-border rounded px-3 py-2 text-lira-muted text-ui">Search tickets, projects and roadmaps</div>
        {results.map(([key, title, where]) => (
          <div key={key} className="flex items-center justify-between gap-3 text-ui border-t border-lira-border pt-2">
            <span className="min-w-0"><b>{key}</b> <span className="text-lira-muted">{title}</span></span>
            <span className="text-xs text-lira-muted shrink-0">{where}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VivaPanel() {
  return (
    <div role="img" aria-label="Sample chat with Viva: a question about yesterday's work and an answer with a ticket" className="bg-gray-100 rounded-xl p-5 sm:p-8">
      <div className={`${CARD} p-4 flex flex-col gap-3`}>
        <p className="font-bold">Viva</p>
        <p className="self-end max-w-xs bg-lira-blue text-lira-on-blue rounded-lg px-3 py-2 text-ui">Show me what I worked on yesterday</p>
        <p className="text-ui">Here is your latest ticket.</p>
        <p className="self-start border border-lira-border rounded px-2.5 py-1.5 text-ui"><b>OPS-24</b> Roadmap review with the team <span className="ml-1 text-xs font-bold text-lira-muted">DONE</span></p>
        <div className="border border-lira-border rounded-lg px-3 py-3 text-lira-muted text-ui">Describe what you want to know or do next</div>
      </div>
    </div>
  );
}

const LANES = [['Now', 'w-2/3', 'bg-lira-blue'], ['Next', 'w-1/2 ml-8', 'bg-lira-nav'], ['Later', 'w-2/5 ml-16', 'bg-lira-nav']] as const;
const BARS = ['h-6', 'h-10', 'h-8', 'h-14', 'h-12'] as const;

export function PlanPanel() {
  return (
    <div role="img" aria-label="Sample roadmap lanes for Now, Next and Later, and a bar chart" className="bg-lira-nav text-white rounded-xl p-5 sm:p-8">
      <div className="flex flex-col gap-3">
        {LANES.map(([lane, width, colour]) => (
          <div key={lane} className="flex flex-col gap-1">
            <span className="text-xs text-white/70">{lane}</span>
            <div className={`${width} ${colour} rounded h-6 border border-white/20`} />
          </div>
        ))}
        <div className="flex items-end gap-2 h-16 mt-3 border-b border-white/25" aria-hidden="true">
          {BARS.map((h, i) => <div key={i} className={`flex-1 ${h} ${i === 3 ? 'bg-logo-gold' : 'bg-white/40'} rounded-t`} />)}
        </div>
        <span className="text-xs text-white/70">Weekly dashboard snapshot</span>
      </div>
    </div>
  );
}
