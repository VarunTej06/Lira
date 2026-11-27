import { useEffect, useState } from 'react';
import { listSpaceShares, setSpaceShares, type Shares, type SpaceShare } from '../../services/accessApi';

const SWITCHES: readonly [keyof Shares, string][] = [['projects', 'Projects'], ['roadmaps', 'Roadmaps'], ['dashboards', 'Dashboards'], ['sprints', 'Sprints']];

/** For one space: the people who were invited to it, and which of its linked projects, roadmaps, dashboards and sprints each of them sees. */
export function SpaceSharesPanel({ org, spaceId }: { org: string; spaceId: string }) {
  const [rows, setRows] = useState<SpaceShare[] | null>(null);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    let current = true;
    void listSpaceShares(org, spaceId).then(r => { if (current) setRows(r.ok ? r.data : []); });
    return () => { current = false; };
  }, [org, spaceId]);

  async function toggle(row: SpaceShare, key: keyof Shares, on: boolean) {
    setProblem('');
    const r = await setSpaceShares(org, spaceId, row.userId, { [key]: on });
    if (r.ok) setRows(list => (list ?? []).map(x => (x.userId === row.userId ? { ...x, [key]: on } : x)));
    else setProblem(r.message);
  }

  if (!rows || rows.length === 0) return null;
  return (
    <section aria-label="What invited people see" className="space-y-2">
      <h3 className="text-sm font-bold">People invited to this space</h3>
      <p className="text-ui text-lira-muted">Tickets and comments always come with the space. Switch off what else they should not see.</p>
      {problem && <p role="alert" className="text-ui text-red-600">{problem}</p>}
      <ul className="divide-y divide-lira-border border border-lira-border rounded-lg">
        {rows.map(row => (
          <li key={row.userId} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-ui">
            <span className="flex-1 min-w-40"><strong>{row.name}</strong><br /><span className="text-lira-muted">{row.email}</span></span>
            {SWITCHES.map(([key, label]) => (
              <label key={key} className="flex items-center gap-1.5"><input type="checkbox" aria-label={`${label} for ${row.name}`} checked={row[key]} onChange={e => { void toggle(row, key, e.target.checked); }} />{label}</label>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}
