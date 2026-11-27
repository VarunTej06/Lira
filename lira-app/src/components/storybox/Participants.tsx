import { Users } from 'lucide-react';
import type { Person } from '../../utils/storyRound';

const timeOf = (iso: string): string => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const roleOf = (role: string): string => (role === 'owner' || role === 'admin' ? 'Facilitator' : 'Voter');

/** Who is taking part in this round, whether they have voted and when, and, once revealed, what they gave. Points stay hidden until then. */
export function Participants({ people, points, revealed, waiting = false }: { people: readonly Person[]; points: ReadonlyMap<string, number>; revealed: boolean; /** No ticket is up yet, so nobody has anything to give. */ waiting?: boolean }) {
  if (people.length === 0) return null;
  const voted = people.filter(p => p.voted).length;
  return (
    <section aria-label="Participants" className="border border-lira-border rounded-2xl overflow-hidden bg-white">
      <header className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-lira-border">
        <Users className="w-3.5 h-3.5 text-lira-muted" /><h3 className="text-xs font-semibold text-lira-text uppercase tracking-wide">Participants</h3>
        <span className="text-2xs text-lira-muted">{waiting ? `${people.length} taking part. Voting starts when a ticket is put up` : `${voted} of ${people.length} have voted`}</span>
      </header>
      <table className="w-full text-left text-xs">
        <thead className="bg-gray-50 text-lira-muted"><tr><th className="px-3 py-2 font-semibold">Person</th><th className="px-3 py-2 font-semibold">Role</th><th className="px-3 py-2 font-semibold">Status</th><th className="px-3 py-2 font-semibold">Points</th></tr></thead>
        <tbody className="divide-y divide-lira-border">
          {people.map(p => (
            <tr key={p.userId}>
              <td className="px-3 py-2 font-medium">{p.name}</td>
              <td className="px-3 py-2 text-lira-muted">{roleOf(p.role)}</td>
              <td className="px-3 py-2">{waiting ? 'Ready' : p.voted ? `Voted${p.votedAt ? ` at ${timeOf(p.votedAt)}` : ''}` : revealed ? 'Did not vote' : 'Waiting'}</td>
              <td className="px-3 py-2 font-semibold">{waiting ? '–' : revealed ? (points.get(p.userId) ?? '–') : 'Hidden'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
