import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_URL, ORIGIN, startRealDb, type RealDb } from '../testing/realDb';

const ticket = {
  title: 'Fix the board', type: 'task', status: 'todo', priority: 'medium', rank: 1000, description: '<p>x</p>',
  reporter: 'Test Person', reporterInitials: 'TP', labels: [], subtasks: [], comments: [], activity: [], linkedIssues: [], watchers: [],
};

describe.skipIf(!ADMIN_URL)('live updates over a stream, on a real database', () => {
  let db: RealDb;
  let base = '';
  beforeAll(async () => {
    db = await startRealDb();
    base = `http://127.0.0.1:${(db.app.getHttpServer().address() as { port: number }).port}`;
  });
  afterAll(async () => { await db?.stop(); });

  type Person = Awaited<ReturnType<RealDb['signUp']>>;
  let n = 0;
  const owner = () => db.signUp(`live${++n}@example.com`);
  const space = async (p: Person, key: string) =>
    ((await db.call('POST', `/api/orgs/${p.orgId}/spaces`, { key, name: key, icon: 'rocket', color: '#336699' }, p.session)).body as { id: number }).id;

  /** Opens the stream the way the page does and gives back what arrives, line by line, until closed. */
  async function listen(p: Person, orgId = p.orgId) {
    const abort = new AbortController();
    const res = await fetch(`${base}/api/orgs/${orgId}/events`, { headers: { ...p.session, Origin: ORIGIN, 'X-Requested-With': 'liraspaces' }, signal: abort.signal });
    const reader = res.body?.getReader();
    const seen: string[] = [];
    let buffer = '';
    const pump = (async () => {
      try {
        while (reader) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += new TextDecoder().decode(value);
          for (let i = buffer.indexOf('\n\n'); i >= 0; i = buffer.indexOf('\n\n')) { seen.push(buffer.slice(0, i)); buffer = buffer.slice(i + 2); }
        }
      } catch { /* closed on purpose */ }
    })();
    const next = async (count: number, ms = 3000) => {
      const until = Date.now() + ms;
      while (seen.filter(s => s.startsWith('data:')).length < count && Date.now() < until) await new Promise(r => setTimeout(r, 25));
      return seen.filter(s => s.startsWith('data:')).map(s => JSON.parse(s.slice(5)) as { kind: string; spaceId: number | null });
    };
    return { res, seen, next, closed: pump, close: async () => { abort.abort(); await pump; } };
  }
  const quiet = (ms = 400) => new Promise(r => setTimeout(r, ms));

  it('tells an open page when a ticket is made, changed or deleted in a space it may see, naming the space and nothing else', async () => {
    const p = await owner();
    const a = await space(p, 'AAA');
    const live = await listen(p);
    expect(live.res.status).toBe(200);
    expect(live.res.headers.get('content-type')).toBe('text/event-stream');
    const made = await db.call('POST', `/api/orgs/${p.orgId}/spaces/${a}/tickets`, ticket, p.session);
    const id = (made.body as { id: number; version: number }).id;
    await db.call('PATCH', `/api/orgs/${p.orgId}/tickets/${id}`, { version: 1, status: 'done' }, p.session);
    await db.call('DELETE', `/api/orgs/${p.orgId}/tickets/${id}`, { version: 2 }, p.session);
    const heard = await live.next(3);
    expect(heard).toEqual([{ kind: 'ticket', spaceId: a }, { kind: 'ticket', spaceId: a }, { kind: 'ticket', spaceId: a }]);
    expect(live.seen.join('')).not.toContain('Fix the board'); // no title or text travels
    await live.close();
  });

  it('tells other people of the organisation too, but only about spaces they may see', async () => {
    const o = await owner();
    const a = await space(o, 'AAA'); const b = await space(o, 'BBB');
    const guest = await db.addMember(o, `guest-live${n}@example.com`, 'guest');
    await db.call('POST', `/api/orgs/${o.orgId}/grants`, { subjectType: 'user', subjectId: guest.userId, kind: 'space', objectId: String(a), level: 'edit' }, o.session);
    const live = await listen(guest, o.orgId);
    await quiet(); // the grant above is also a note, which the guest hears
    const before = (await live.next(0)).length;
    await db.call('POST', `/api/orgs/${o.orgId}/spaces/${b}/tickets`, ticket, o.session); // a space the guest may not see
    await db.call('POST', `/api/orgs/${o.orgId}/spaces/${a}/tickets`, ticket, o.session);
    const heard = await live.next(before + 1);
    expect(heard.slice(before)).toEqual([{ kind: 'ticket', spaceId: a }]);
    await quiet();
    expect((await live.next(0)).filter(h => h.spaceId === b)).toEqual([]);
    await live.close();
  });

  it('keeps one organisation\'s changes from another\'s pages, and refuses a stream for an organisation the person is not in or without a session', async () => {
    const x = await owner(); const y = await owner();
    const a = await space(x, 'XXX');
    const liveY = await listen(y);
    await db.call('POST', `/api/orgs/${x.orgId}/spaces/${a}/tickets`, ticket, x.session);
    await quiet();
    expect(liveY.seen.filter(s => s.startsWith('data:'))).toEqual([]);
    await liveY.close();
    const stranger = await fetch(`${base}/api/orgs/${x.orgId}/events`, { headers: { ...y.session, Origin: ORIGIN } });
    expect(stranger.status).toBe(404);
    await stranger.body?.cancel();
    const nobody = await fetch(`${base}/api/orgs/${x.orgId}/events`, { headers: { Origin: ORIGIN } });
    expect(nobody.status).toBe(401);
    await nobody.body?.cancel();
  });

  it('stops telling someone whose session has ended, and limits how many streams one person holds open', async () => {
    const p = await owner();
    const a = await space(p, 'AAA');
    const live = await listen(p);
    const colleague = await db.addMember(p, `colleague${++n}@example.com`, 'admin');
    await db.admin.query('DELETE FROM sessions WHERE user_id = $1', [p.userId]); // logged out elsewhere
    await db.call('POST', `/api/orgs/${p.orgId}/spaces/${a}/tickets`, ticket, colleague.session);
    await quiet(600);
    expect(live.seen.filter(l => l.startsWith('data:'))).toEqual([]); // told nothing
    expect(await Promise.race([live.closed.then(() => 'ended'), quiet(500).then(() => 'open')])).toBe('ended');
    await live.close();

    const q = await owner();
    const open = [];
    for (let i = 0; i < 6; i++) open.push(await listen(q));
    expect(open.every(o => o.res.status === 200)).toBe(true);
    const seventh = await fetch(`${base}/api/orgs/${q.orgId}/events`, { headers: { ...q.session, Origin: ORIGIN } });
    expect(seventh.status).toBe(429);
    await seventh.body?.cancel();
    for (const o of open) await o.close();
  });
  it('tells open pages when a project, roadmap, dashboard, mind map or story box is saved or deleted, with nothing about what it holds', async () => {
    const o = await owner();
    const other = await owner();
    const colleague = await db.addMember(o, `obj-live${++n}@example.com`, 'admin');
    const live = await listen(colleague, o.orgId);
    const stranger = await listen(other);
    const put = (kind: string, id: string, body: object, version?: number) => db.call('PUT', `/api/orgs/${o.orgId}/objects/${kind}/${id}`, { doc: { id, ...body }, ...(version ? { version } : {}) }, o.session);
    await put('roadmap', 'rm1', { name: 'Secret roadmap name' });
    await put('mindmap', 'mm1', { name: 'A map', nodes: [] });
    await put('roadmap', 'rm1', { name: 'Renamed' }, 1);
    await db.call('DELETE', `/api/orgs/${o.orgId}/objects/mindmap/mm1`, { version: 1 }, o.session);
    const heard = await live.next(4);
    expect(heard).toEqual([1, 2, 3, 4].map(() => ({ kind: 'object', spaceId: null })));
    expect(live.seen.join('')).not.toContain('Secret roadmap name');
    await quiet();
    expect(stranger.seen.filter(l => l.startsWith('data:'))).toEqual([]); // another organisation hears nothing
    await live.close(); await stranger.close();
  });
});
