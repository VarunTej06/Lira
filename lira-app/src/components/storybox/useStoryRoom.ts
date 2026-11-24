import { useCallback, useEffect, useMemo, useState } from 'react';
import { confirmRound, getRoom, putVote, roundAction } from '../../services/storyVotesApi';
import { currentTimeMs } from '../../utils/clock';
import { isHosted } from '../../utils/edition';
import { activeOrg } from '../../utils/hostedOrg';
import type { StoryBox } from '../../utils/storybox';
import { localConfirm, localReveal, localRevote, localRoom, localStart, localVote, type Room } from '../../utils/storyRound';
import { loadProfile } from '../../utils/userPrefs';

const POLL_OPEN_MS = 2_000;
const POLL_CLOSED_MS = 20_000;
const NO_ROOM: Room = { rounds: [], votes: [], people: [], activeTicketId: null, offsetMs: 0 };

/**
 * The planning room of a story box: who is voting on which ticket, the clock, and the actions. Hosted: the server holds the rounds and
 * the points (and hides everyone's until they are revealed); this reads them again every couple of seconds while the box is open and
 * counts down to the server's clock. Local: the one person's rounds are kept in the box itself.
 */
export function useStoryRoom(box: StoryBox, onChange: (box: StoryBox) => void) {
  const org = activeOrg();
  const hosted = isHosted() && org !== null;
  const [remote, setRemote] = useState<Room>(NO_ROOM);
  const [problem, setProblem] = useState('');
  const [nowMs, setNowMs] = useState(currentTimeMs);
  const open = box.status === 'open';
  const id = box.id;

  const reload = useCallback(async () => {
    if (!hosted || !org) return;
    const sent = currentTimeMs();
    const r = await getRoom(org, id);
    if (r.ok) setRemote({ rounds: r.data.rounds, votes: r.data.votes, people: r.data.people, activeTicketId: r.data.activeTicketId, offsetMs: Date.parse(r.data.now) - sent });
  }, [hosted, org, id]);

  useEffect(() => {
    if (!hosted) return;
    const first = window.setTimeout(() => { void reload(); }, 0);
    const timer = window.setInterval(() => { void reload(); }, open ? POLL_OPEN_MS : POLL_CLOSED_MS);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, [hosted, open, reload]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(currentTimeMs()), 500);
    return () => window.clearInterval(timer);
  }, []);

  const room = useMemo(() => (hosted ? remote : localRoom(box, nowMs, loadProfile().name || 'You')), [hosted, remote, box, nowMs]);

  async function run(call: () => Promise<{ ok: true } | { ok: false; message: string }>): Promise<boolean> {
    setProblem('');
    const r = await call();
    if (!r.ok) { setProblem(r.message); return false; }
    await reload();
    return true;
  }
  const keep = (next: StoryBox | null, refusal = 'Another ticket is being voted on. Finish it first.') => { if (next) onChange(next); else setProblem(refusal); return next !== null; };

  return {
    room, nowMs, problem,
    start: (t: number) => (hosted ? run(() => roundAction(org, id, t, 'start')) : Promise.resolve(keep(localStart(box, t, currentTimeMs())))),
    reveal: (t: number) => (hosted ? run(() => roundAction(org, id, t, 'reveal')) : Promise.resolve(keep(localReveal(box, t)))),
    revote: (t: number) => (hosted ? run(() => roundAction(org, id, t, 'revote')) : Promise.resolve(keep(localRevote(box, t, currentTimeMs())))),
    finalise: (t: number, points: number) => (hosted ? run(() => confirmRound(org, id, t, points)) : Promise.resolve(keep(localConfirm(box, t, points)))),
    vote: (t: number, points: number | null) => (hosted ? run(() => putVote(org, id, t, points)) : Promise.resolve(keep(localVote(box, t, points, currentTimeMs())))),
  };
}
