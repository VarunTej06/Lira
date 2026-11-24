import { useCallback, useEffect, useState } from 'react';
import { listVotes, putVote } from '../../services/storyVotesApi';
import { isHosted } from '../../utils/edition';
import { activeOrg } from '../../utils/hostedOrg';
import { localVotesOf, type StoryBox, type Vote } from '../../utils/storybox';

const POLL_MS = 10_000;

/**
 * The points in a story box and a way to give your own. Hosted: they are on the server, read again every few seconds while the box is
 * open so other people's points appear, and the server decides who may vote. Local: the one person's points are kept in the box.
 */
export function useBoxVotes(box: StoryBox | undefined, saveLocal: (votes: Record<string, number>) => void) {
  const [remote, setRemote] = useState<Vote[]>([]);
  const [problem, setProblem] = useState('');
  const org = activeOrg();
  const hosted = isHosted() && org !== null;
  const id = box?.id; const open = box?.status === 'open';

  const reload = useCallback(async () => {
    if (!hosted || !id || !org) return;
    const r = await listVotes(org, id);
    if (r.ok) setRemote(r.data);
  }, [hosted, id, org]);

  useEffect(() => {
    if (!hosted || !id || !org) return;
    let current = true;
    const ask = () => { void listVotes(org, id).then(r => { if (current && r.ok) setRemote(r.data); }); };
    ask();
    const timer = open ? setInterval(ask, POLL_MS) : undefined;
    return () => { current = false; clearInterval(timer); };
  }, [hosted, open, id, org]);

  async function vote(ticketId: number, points: number | null) {
    setProblem('');
    if (!box) return;
    if (!hosted) {
      const next = { ...(box.localVotes ?? {}) };
      if (points === null) delete next[String(ticketId)]; else next[String(ticketId)] = points;
      saveLocal(next);
      return;
    }
    const r = await putVote(org, box.id, ticketId, points);
    if (r.ok) await reload(); else setProblem(r.message);
  }

  return { votes: hosted ? remote : box ? localVotesOf(box) : [], vote, problem };
}
