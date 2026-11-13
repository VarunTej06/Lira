import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../../services/aiAgentService';
import type { Issue } from '../../types/issue';
import { byText, cleanup, click, mount, q, qa } from '../../test/render';
import { ChatBubble } from './ChatBubble';

afterEach(cleanup);

const message = (over: Partial<ChatMessage> = {}): ChatMessage => ({ id: 'm1', sender: 'assistant', text: 'Hello there', timestamp: new Date(0), ...over }) as ChatMessage;
const ticket = { id: 5, key: 'LIRA-5', title: 'Fix the board' } as Issue;

function show(msg: ChatMessage, extra: Partial<Parameters<typeof ChatBubble>[0]> = {}) {
  const handlers = { onSend: vi.fn(), onResolve: vi.fn(), onUndo: vi.fn(), onOpenDashboard: vi.fn() };
  mount(<ChatBubble msg={msg} maximized={false} {...handlers} {...extra} />);
  return handlers;
}

describe('ChatBubble', () => {
  it('shows the text of a message', () => {
    show(message());
    expect(document.body.textContent).toContain('Hello there');
  });

  it('shows the refined goal on an assistant message only', () => {
    const refinedPrompt = { optimizedGoal: 'List open bugs', originalInput: 'bugs' } as ChatMessage['refinedPrompt'];
    show(message({ refinedPrompt }));
    expect(document.body.textContent).toContain('Refined goal');
    expect(document.body.textContent).toContain('List open bugs');
    cleanup();
    show(message({ sender: 'user', refinedPrompt }));
    expect(document.body.textContent).not.toContain('Refined goal');
  });

  describe('a change waiting for an answer', () => {
    const waiting = () => message({ pending: { prompt: 'move it', state: 'waiting' } });

    it('offers Confirm and Cancel and reports the choice', async () => {
      const h = show(waiting());
      await click(byText('button', 'Confirm'));
      expect(h.onResolve).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'm1' }), true);
      await click(byText('button', 'Cancel'));
      expect(h.onResolve).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'm1' }), false);
    });

    it('says what was decided once answered, with no buttons left', () => {
      show(message({ pending: { prompt: 'x', state: 'confirmed' } }));
      expect(q('[data-testid="viva-confirm"]')!.textContent).toContain('Confirmed');
      expect(byText('button', 'Confirm')).toBeUndefined();
      cleanup();
      show(message({ pending: { prompt: 'x', state: 'cancelled' } }));
      expect(q('[data-testid="viva-confirm"]')!.textContent).toContain('Cancelled, nothing changed');
    });
  });

  describe('undo', () => {
    it('offers Undo with the number of tickets changed, and asks to undo this message', async () => {
      const h = show(message({ undo: { state: 'available', changed: 2 } as ChatMessage['undo'] }));
      const button = byText('button', /Undo \(2 tickets\)/)!;
      expect(button).toBeTruthy();
      await click(button);
      expect(h.onUndo).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }));
    });

    it('uses the singular for one ticket', () => {
      show(message({ undo: { state: 'available', changed: 1 } as ChatMessage['undo'] }));
      expect(byText('button', /Undo \(1 ticket\)/)).toBeTruthy();
    });

    it('says "Undone" afterwards', () => {
      show(message({ undo: { state: 'undone', changed: 2 } as ChatMessage['undo'] }));
      expect(q('[data-testid="viva-undo"]')!.textContent).toContain('Undone');
      expect(qa('button', q('[data-testid="viva-undo"]')!)).toHaveLength(0);
    });
  });

  describe('links', () => {
    it('opens the dashboard Viva built', async () => {
      const h = show(message({ actionTaken: { type: 'dashboard', dashboardId: 'd1', details: 'Sprint health' } as ChatMessage['actionTaken'] }));
      expect(q('[data-testid="viva-dashboard"]')!.textContent).toContain('Sprint health');
      await click(q('[data-testid="viva-open-dashboard"]'));
      expect(h.onOpenDashboard).toHaveBeenCalledWith('d1');
    });

    it('shows no dashboard link without a dashboard id', () => {
      show(message({ actionTaken: { type: 'dashboard', details: 'x' } as ChatMessage['actionTaken'] }));
      expect(q('[data-testid="viva-dashboard"]')).toBeNull();
    });

    it('opens the ticket Viva created, when the screen can open tickets', async () => {
      const onSelectIssue = vi.fn();
      show(message({ actionTaken: { type: 'created_issue', issue: ticket } as ChatMessage['actionTaken'] }), { onSelectIssue });
      expect(document.body.textContent).toContain('LIRA-5');
      expect(document.body.textContent).toContain('Fix the board');
      await click(byText('button', /^Open/));
      expect(onSelectIssue).toHaveBeenCalledWith(ticket);
    });

    it('shows no ticket card when the screen cannot open tickets', () => {
      show(message({ actionTaken: { type: 'created_issue', issue: ticket } as ChatMessage['actionTaken'] }));
      expect(document.body.textContent).not.toContain('LIRA-5');
    });
  });

  describe('suggested follow-ups', () => {
    it('sends the text of the one clicked', async () => {
      const h = show(message({ suggestedActions: ['Show blocked tickets', 'Plan next sprint'] }));
      await click(byText('button', /Plan next sprint/));
      expect(h.onSend).toHaveBeenCalledWith('Plan next sprint');
    });

    it('shows nothing for an empty list', () => {
      show(message({ suggestedActions: [] }));
      expect(qa('button')).toHaveLength(0);
    });
  });

  it('puts a message from the person on the right, without the Viva avatar', () => {
    show(message({ sender: 'user' }));
    expect(q('.items-end')).not.toBeNull();
  });
});
