import type { Person } from '../../utils/storyRound';

const timeOf = (iso: string): string => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const roleOf = (role: string): string => (role === 'owner' || role === 'admin' ? 'Facilitator' : 'Voter');

/** Who is taking part in this round, whether they have voted and when, and, once revealed, what they gave. Points stay hidden until then. */
export function Participants({ people, points, revealed }: { people: readonly Person[]; points: ReadonlyMap<string, number>; revealed: boolean }) {
  if (people.length === 0) return null;
  const voted = people.filter(p => p.voted).length;
  return (
    <section aria-label="Participants" className="text-ui">
      <h3 className="font-bold mb-1">Participants <span className="font-normal text-lira-muted">{voted} of {people.length} have voted</span></h3>
      <table className="w-full text-left">
        <thead className="text-lira-muted"><tr><th className="py-1 pr-3 font-medium">Person</th><th className="py-1 pr-3 font-medium">Role</th><th className="py-1 pr-3 font-medium">Status</th><th className="py-1 font-medium">Points</th></tr></thead>
        <tbody>
          {people.map(p => (
            <tr key={p.userId} className="border-t border-lira-border">
              <td className="py-1.5 pr-3 font-medium">{p.name}</td>
              <td className="py-1.5 pr-3 text-lira-muted">{roleOf(p.role)}</td>
              <td className="py-1.5 pr-3">{p.voted ? `Voted${p.votedAt ? ` at ${timeOf(p.votedAt)}` : ''}` : revealed ? 'Did not vote' : 'Waiting'}</td>
              <td className="py-1.5">{revealed ? (points.get(p.userId) ?? '–') : 'Hidden'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
