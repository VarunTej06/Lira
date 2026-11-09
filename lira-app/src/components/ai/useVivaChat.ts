import { useEffect, useRef, useState } from 'react';
import type { Space } from '../../types/space';
import { processUserMessage, confirmAndRun, undoAction, type ChatMessage } from '../../services/aiAgentService';

const welcomeMessage = (spaceCount: number): ChatMessage => ({
  id: 'welcome',
  sender: 'assistant',
  text: `**Hi, I'm Viva AI.**\n\nI can **read and write** across all **${spaceCount} spaces** — search tickets, build status tables, create tickets, move them between statuses and sprints, and generate subtasks.\n\nTry one of these:`,
  timestamp: new Date(),
  suggestedActions: [
    'Show all spaces with number of tickets in each To do, Backlog, In Progress and Done',
    'What is in progress across all spaces?',
    'Show all Epics across spaces',
    'Create a task "Review sprint goals" in Lira',
    'Plan next sprint from my backlog',
    'Write my standup',
    'Show the risk radar',
  ],
});

const reply = (text: string): ChatMessage => ({ id: String(Date.now()), sender: 'assistant', text, timestamp: new Date() });

/** The conversation with Viva: sending, confirming a previewed change, and undoing one. */
export function useVivaChat(opts: { activeSpace: Space | undefined; spaces: Space[]; confirmWrites: boolean; isOpen: boolean; initialPrompt?: string | null; onClearInitialPrompt?: () => void }) {
  const { activeSpace, spaces, confirmWrites, isOpen, initialPrompt, onClearInitialPrompt } = opts;
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(() => [welcomeMessage(spaces.length)]);
  const [loading, setLoading] = useState(false);
  const addMessage = (m: ChatMessage) => setMessages(prev => [...prev, m]);
  const patch = (id: string, change: (m: ChatMessage) => ChatMessage) => setMessages(prev => prev.map(m => (m.id === id ? change(m) : m)));

  const send = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;
    addMessage({ id: String(Date.now()), sender: 'user', text, timestamp: new Date() });
    setInput('');
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      addMessage(await processUserMessage(text, activeSpace, spaces, 'agent', { confirmWrites })); // 'agent' = read and write
    } catch (err) {
      console.error('[Viva AI] request failed', err);
      addMessage(reply('**Something went wrong.** Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  /** Confirm or cancel a change Viva has previewed. */
  const resolvePending = async (msg: ChatMessage, confirm: boolean) => {
    if (!msg.pending || msg.pending.state !== 'waiting') return;
    const mark = (state: 'confirmed' | 'cancelled') => patch(msg.id, m => (m.pending ? { ...m, pending: { ...m.pending, state } } : m));
    if (!confirm) return mark('cancelled');
    mark('confirmed');
    setLoading(true);
    try {
      addMessage(await confirmAndRun(msg.pending.prompt, activeSpace, spaces));
    } catch (err) {
      console.error('[Viva AI] confirmed action failed', err);
      addMessage(reply('**That did not work.** Nothing was changed.'));
    } finally {
      setLoading(false);
    }
  };

  /** Put back what an action changed. */
  const undo = async (msg: ChatMessage) => {
    if (!msg.undo || msg.undo.state !== 'available') return;
    const n = await undoAction(msg.undo.id);
    patch(msg.id, m => (m.undo ? { ...m, undo: { ...m.undo, state: 'undone' as const } } : m));
    addMessage(reply(n === null ? 'I can no longer undo that one (it was too long ago, or the page was reloaded).' : `**Undone.** ${n} ticket${n === 1 ? '' : 's'} put back as they were.`));
  };

  // Send a prompt handed in from elsewhere (for example the app launcher) as soon as the chat opens
  const latest = useRef({ send, onClearInitialPrompt });
  useEffect(() => { latest.current = { send, onClearInitialPrompt }; });
  useEffect(() => {
    if (isOpen && initialPrompt) {
      latest.current.send(initialPrompt);
      latest.current.onClearInitialPrompt?.();
    }
  }, [isOpen, initialPrompt]);

  return { input, setInput, messages, loading, send, resolvePending, undo, clear: () => setMessages([welcomeMessage(spaces.length)]) };
}
