import { useEffect, useMemo, useState } from 'react';
import { getSummary } from '../../services/storyVotesApi';
import { isHosted } from '../../utils/edition';
import { activeOrg } from '../../utils/hostedOrg';
import type { StoryBox } from '../../utils/storybox';
import { localSummary, type BoxSummary } from '../../utils/storyOverview';

const EVERY_MS = 15_000;

/** What each box has sized, by box id. Hosted: asked of the server now and every few seconds, so a round finished by someone else shows up. Local: read from the boxes. */
export function useBoxSummaries(boxes: readonly StoryBox[]): ReadonlyMap<string, BoxSummary> {
  const org = activeOrg();
  const hosted = isHosted() && org !== null;
  const [remote, setRemote] = useState<ReadonlyMap<string, BoxSummary>>(new Map());

  useEffect(() => {
    if (!hosted || !org) return;
    let current = true;
    const ask = () => { void getSummary(org).then(r => { if (current && r.ok) setRemote(new Map(r.data.map(s => [s.boxId, { sized: s.sized, points: s.points }]))); }); };
    const first = window.setTimeout(ask, 0);
    const timer = window.setInterval(ask, EVERY_MS);
    return () => { current = false; window.clearTimeout(first); window.clearInterval(timer); };
  }, [hosted, org]);

  const local = useMemo(() => new Map(boxes.map(b => [b.id, localSummary(b)])), [boxes]);
  return hosted ? remote : local;
}
