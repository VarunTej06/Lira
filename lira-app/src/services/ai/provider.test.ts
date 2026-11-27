import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setActiveOrg } from '../../utils/hostedOrg';
import { getAiProvider, setAiProvider } from './settings';
import { askConfiguredModel } from './provider';

const hosted = vi.hoisted(() => ({ on: true }));
vi.mock('../../utils/edition', async importOriginal => ({ ...(await importOriginal<typeof import('../../utils/edition')>()), isHosted: () => hosted.on }));
const api = vi.hoisted(() => ({ askVivaOnServer: vi.fn() }));
vi.mock('../workspaceApi', () => api);

const req = { userPrompt: 'What is open?', activeSpace: { id: 7 } as never, allSpaces: [], allIssues: [] };

beforeEach(() => { hosted.on = true; localStorage.clear(); api.askVivaOnServer.mockReset(); setActiveOrg('org-1'); });
afterEach(() => setActiveOrg(null));

describe('which model answers in the hosted edition', () => {
  it('is the server unless chosen otherwise, and never a key kept in the browser', () => {
    expect(getAiProvider()).toBe('server');
    localStorage.setItem('lira_gemini_api_key', 'AIza-old-key');
    expect(getAiProvider()).toBe('server');
    setAiProvider('local');
    expect(getAiProvider()).toBe('local');
  });
  it('does not offer the server in the local edition', () => {
    hosted.on = false;
    setAiProvider('server');
    expect(getAiProvider()).toBe('local');
  });
});

describe('asking the Liraspaces server', () => {
  beforeEach(() => setAiProvider('server'));

  it('sends the question and the space being looked at, and shows the answer', async () => {
    api.askVivaOnServer.mockResolvedValue({ ok: true, data: { answer: 'Two are open.', provider: 'openai', model: 'm' } });
    const msg = await askConfiguredModel(req);
    expect(api.askVivaOnServer).toHaveBeenCalledWith('org-1', { question: 'What is open?', spaceId: 7 });
    expect(msg).toMatchObject({ sender: 'assistant', text: 'Two are open.' });
  });
  it('cuts a very long question to what the server accepts', async () => {
    api.askVivaOnServer.mockResolvedValue({ ok: true, data: { answer: 'x', provider: 'p', model: 'm' } });
    await askConfiguredModel({ ...req, userPrompt: 'q'.repeat(5000) });
    expect(api.askVivaOnServer.mock.calls[0][1].question).toHaveLength(2000);
  });
  it('gives up, so the built-in engine answers, when the server refuses or no workspace is open', async () => {
    api.askVivaOnServer.mockResolvedValue({ ok: false, status: 503, message: 'not set up' });
    await expect(askConfiguredModel(req)).rejects.toThrow(/503/);
    setActiveOrg(null);
    expect(await askConfiguredModel(req)).toBeNull();
  });
});
