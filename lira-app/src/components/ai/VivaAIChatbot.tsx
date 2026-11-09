import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Send, Trash2, ArrowRight, Sparkles, User, Maximize2, Minimize2, Settings, Shield, Key, FileText, RotateCcw, Check, Database, Target, Undo2, Zap } from 'lucide-react';
import type { Space } from '../../types/space';
import type { Issue } from '../../types/issue';
import {
  processUserMessage, type ChatMessage,
  getSystemInstruction, setSystemInstruction, DEFAULT_SYSTEM_INSTRUCTION,
  getGeminiApiKey, setGeminiApiKey, confirmAndRun, undoAction,
  getAiProvider, setAiProvider, getOpenAiConfig, setOpenAiConfig, getConfirmWrites, setConfirmWrites, type AiProvider,
} from '../../services/aiAgentService';
import { LiraAIAvatar } from './LiraAIAvatar';
import { AnimatePresence, motion } from '../common/motion';

interface VivaAIChatbotProps {
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
  activeSpace: Space | undefined;
  spaces: Space[];
  onSelectIssue?: (issue: Issue) => void;
  /** Prompt to send as soon as the chat opens (e.g. from the app launcher). */
  initialPrompt?: string | null;
  onClearInitialPrompt?: () => void;
}

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

export const VivaAIChatbot: React.FC<VivaAIChatbotProps> = ({
  isOpen, onClose, onToggle, activeSpace, spaces, onSelectIssue, initialPrompt, onClearInitialPrompt,
}) => {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(() => [welcomeMessage(spaces.length)]);
  const [loading, setLoading] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [instructionText, setInstructionText] = useState(getSystemInstruction());
  const [apiKeyInput, setApiKeyInput] = useState(getGeminiApiKey());
  const [showApiKey, setShowApiKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [provider, setProvider] = useState<AiProvider>(getAiProvider());
  const [oai, setOai] = useState(getOpenAiConfig());
  const [confirmWrites, setConfirmWritesState] = useState(getConfirmWrites());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && !showSettings) setTimeout(() => inputRef.current?.focus(), 200);
  }, [isOpen, showSettings, maximized]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, maximized]);

  // Escape closes (or leaves maximised view first)
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (maximized) setMaximized(false);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, maximized, onClose]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;
    setMessages(prev => [...prev, { id: String(Date.now()), sender: 'user', text, timestamp: new Date() }]);
    setInput('');
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      // 'agent' mode = full read + write access
      const response = await processUserMessage(text, activeSpace, spaces, 'agent', { confirmWrites });
      setMessages(prev => [...prev, response]);
    } catch (err) {
      console.error('[Viva AI] request failed', err);
      setMessages(prev => [
        ...prev,
        { id: String(Date.now()), sender: 'assistant', text: '**Something went wrong.** Please try again.', timestamp: new Date() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  /** Confirm or cancel a change Viva has previewed. */
  const resolvePending = async (msg: ChatMessage, confirm: boolean) => {
    if (!msg.pending || msg.pending.state !== 'waiting') return;
    const mark = (state: 'confirmed' | 'cancelled') =>
      setMessages(prev => prev.map(m => (m.id === msg.id && m.pending ? { ...m, pending: { ...m.pending, state } } : m)));
    if (!confirm) { mark('cancelled'); return; }
    mark('confirmed');
    setLoading(true);
    try {
      const response = await confirmAndRun(msg.pending.prompt, activeSpace, spaces);
      setMessages(prev => [...prev, response]);
    } catch (err) {
      console.error('[Viva AI] confirmed action failed', err);
      setMessages(prev => [...prev, { id: String(Date.now()), sender: 'assistant', text: '**That did not work.** Nothing was changed.', timestamp: new Date() }]);
    } finally {
      setLoading(false);
    }
  };

  /** Put back what an action changed. */
  const undo = async (msg: ChatMessage) => {
    if (!msg.undo || msg.undo.state !== 'available') return;
    const n = await undoAction(msg.undo.id);
    setMessages(prev => [
      ...prev.map(m => (m.id === msg.id && m.undo ? { ...m, undo: { ...m.undo, state: 'undone' as const } } : m)),
      { id: String(Date.now()), sender: 'assistant', text: n === null ? 'I can no longer undo that one (it was too long ago, or the page was reloaded).' : `**Undone.** ${n} ticket${n === 1 ? '' : 's'} put back as they were.`, timestamp: new Date() },
    ]);
  };

  // Auto-send a prompt handed in from elsewhere (e.g. the app launcher)
  useEffect(() => {
    if (isOpen && initialPrompt) {
      handleSend(initialPrompt);
      onClearInitialPrompt?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialPrompt]);

  const saveSettings = () => {
    setSystemInstruction(instructionText);
    setGeminiApiKey(apiKeyInput.trim());
    setAiProvider(provider);
    setOpenAiConfig(oai);
    setConfirmWrites(confirmWrites);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const panelStyle: React.CSSProperties = maximized
    ? { width: 'min(700px, calc(100vw - 2.5rem))', height: 'min(720px, calc(100vh - 7.5rem))' }
    : { width: '420px', height: 'min(540px, calc(100vh - 8.5rem))' };
  // The panel grows out of / shrinks back into the round launcher: origin = launcher centre,
  // which sits 25px left of the panel's right edge and 35px below its bottom edge.
  const panelOrigin = 'calc(100% - 25px) calc(100% + 35px)';

  return (
    <>
      {/* Floating avatar launcher */}
      <div className="fixed bottom-5 right-5 z-40 select-none">
        <div className="relative group">
          <button
            type="button"
            onClick={onToggle}
            className={`relative rounded-2xl flex items-center justify-center p-0 cursor-pointer shadow-xl transition-all duration-300 hover:scale-110 active:scale-95 animate-float-subtle animate-pulse-glow ${
              isOpen ? 'ring-2 ring-purple-500 shadow-purple-500/40 rotate-6' : ''
            }`}
            title="Viva AI"
            aria-label="Toggle Viva AI chat"
          >
            <LiraAIAvatar size={50} hasSparkles={true} />
            <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white shadow-xs" />
            </span>
          </button>

          {!isOpen && (
            <div className="opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 absolute right-16 top-1/2 -translate-y-1/2 whitespace-nowrap px-3 py-1.5 bg-[#1D2125] text-white text-xs font-semibold rounded-xl shadow-xl border border-white/10 flex items-center gap-1.5 translate-x-1 group-hover:translate-x-0">
              <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
              <span>Ask Viva AI</span>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
      {isOpen && (
        <motion.div
          key="viva-panel"
          role="dialog"
          aria-label="Viva AI"
          initial={{ opacity: 0, scale: 0.2, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.2, y: 50, transition: { duration: 0.22, ease: [0.5, 0, 0.75, 0] } }}
          transition={{ type: 'spring', stiffness: 340, damping: 28, mass: 0.9 }}
          style={{ ...panelStyle, transformOrigin: panelOrigin }}
          className="fixed bottom-20 right-5 z-50 max-w-[calc(100vw-2.5rem)] bg-white/95 backdrop-blur-2xl border border-purple-500/25 shadow-[0_24px_60px_-12px_rgba(99,102,241,0.35)] rounded-3xl overflow-hidden flex flex-col font-sans ring-1 ring-black/10 transition-[width,height] duration-300 ease-[cubic-bezier(.4,0,.2,1)]"
        >
          {/* Header */}
          <div className="h-[68px] bg-gradient-to-r from-[#0C1018] via-[#1A1F3A] to-[#0C1018] text-white flex items-center justify-between px-4 sm:px-5 flex-shrink-0 select-none relative">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative flex-shrink-0">
                <LiraAIAvatar size={34} hasSparkles={false} />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#0C1018]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm tracking-tight whitespace-nowrap">Viva AI</span>
                  <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 rounded-full">
                    Read &amp; Write
                  </span>
                </div>
                <p className="text-[11px] text-indigo-200/75 font-medium truncate mt-0.5">
                  {{ local: 'Local engine', gemini: 'Gemini-powered', openai: `Model: ${oai.model}` }[provider]} · {spaces.length} spaces connected
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <HeaderButton title="Settings" active={showSettings} onClick={() => setShowSettings(v => !v)}>
                <Settings className="w-4 h-4" />
              </HeaderButton>
              <HeaderButton title="Clear chat" onClick={() => setMessages([welcomeMessage(spaces.length)])}>
                <Trash2 className="w-4 h-4" />
              </HeaderButton>
              <HeaderButton title={maximized ? 'Restore size' : 'Maximise'} onClick={() => setMaximized(v => !v)}>
                {maximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </HeaderButton>
              <HeaderButton title="Close" onClick={onClose}>
                <X className="w-4 h-4" />
              </HeaderButton>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-400/60 to-transparent" />
          </div>

          {showSettings ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/70 text-lira-text animate-fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-purple-600" />
                  <h3 className="font-bold text-sm">Viva AI settings</h3>
                </div>
                <button type="button" onClick={() => setShowSettings(false)} className="text-xs text-lira-blue hover:underline font-semibold cursor-pointer">
                  Back to chat →
                </button>
              </div>

              <div className="bg-white border border-lira-border rounded-2xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-xs font-bold uppercase tracking-wide">Connected spaces ({spaces.length})</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {spaces.map(s => (
                    <span key={s.id} className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border flex items-center gap-1 ${
                      s.id === activeSpace?.id ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-gray-100 text-gray-700 border-gray-200'
                    }`}>
                      <span>{s.icon}</span><span>{s.name}</span><span className="font-mono text-gray-400">[{s.key}]</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-lira-border rounded-2xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-purple-600" />
                    <label className="text-xs font-bold uppercase tracking-wide">System instruction</label>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setInstructionText(DEFAULT_SYSTEM_INSTRUCTION); setSystemInstruction(DEFAULT_SYSTEM_INSTRUCTION); }}
                    className="text-[10px] text-lira-muted hover:text-purple-600 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset default
                  </button>
                </div>
                <textarea
                  rows={maximized ? 12 : 8}
                  value={instructionText}
                  onChange={e => setInstructionText(e.target.value)}
                  className="w-full text-xs font-mono border border-gray-200 rounded-xl p-2.5 bg-gray-50/50 focus:outline-none focus:border-purple-500 leading-relaxed"
                />
              </div>

              <div className="bg-white border border-lira-border rounded-2xl p-3 space-y-2">
                <label className="flex items-start gap-2 text-xs cursor-pointer">
                  <input type="checkbox" className="mt-0.5" checked={confirmWrites} onChange={e => setConfirmWritesState(e.target.checked)} />
                  <span><span className="font-bold uppercase tracking-wide">Confirm before changing anything</span><br /><span className="text-lira-muted">Viva shows what it will do and waits for Confirm. Every change can be undone.</span></span>
                </label>
              </div>

              <div className="bg-white border border-lira-border rounded-2xl p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <label htmlFor="viva-provider" className="text-xs font-bold uppercase tracking-wide">Model</label>
                </div>
                <select
                  id="viva-provider"
                  value={provider}
                  onChange={e => setProvider(e.target.value as AiProvider)}
                  className="w-full text-xs border border-gray-300 rounded-xl px-2.5 py-2 bg-white"
                >
                  <option value="local">Built-in engine (no network)</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI-compatible server (Ollama, LM Studio, ...)</option>
                </select>
                {provider === 'openai' && (
                  <div className="space-y-2">
                    <input aria-label="Base URL" value={oai.baseUrl} onChange={e => setOai({ ...oai, baseUrl: e.target.value })} placeholder="http://localhost:11434/v1" className="w-full text-xs border border-gray-300 rounded-xl px-2.5 py-2" />
                    <input aria-label="Model name" value={oai.model} onChange={e => setOai({ ...oai, model: e.target.value })} placeholder="llama3.1" className="w-full text-xs border border-gray-300 rounded-xl px-2.5 py-2" />
                    <input aria-label="API key" type="password" value={oai.apiKey} onChange={e => setOai({ ...oai, apiKey: e.target.value })} placeholder="API key (not needed for a local server)" className="w-full text-xs border border-gray-300 rounded-xl px-2.5 py-2" />
                  </div>
                )}
                <p className="text-[10px] text-lira-muted">Changes to tickets are always made by the built-in engine, so they can be previewed and undone. The model answers questions.</p>
              </div>

              <div className="bg-white border border-lira-border rounded-2xl p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Key className="w-3.5 h-3.5 text-amber-500" />
                  <label className="text-xs font-bold uppercase tracking-wide">Gemini API key (used when Google Gemini is the model)</label>
                </div>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={e => setApiKeyInput(e.target.value)}
                    placeholder="AIzaSy… (leave empty to use the built-in local engine)"
                    className="w-full text-xs border border-gray-300 rounded-xl pl-2.5 pr-14 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                  <button type="button" onClick={() => setShowApiKey(v => !v)} className="absolute right-2 top-2 text-[10px] text-lira-muted hover:text-lira-text cursor-pointer">
                    {showApiKey ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={saveSettings}
                className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                {saved ? <><Check className="w-4 h-4 text-emerald-300" /> Saved</> : 'Save settings'}
              </button>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 bg-lira-bg/40">
                <div className={`space-y-4 mx-auto w-full ${maximized ? 'max-w-2xl' : ''}`}>
                  {messages.map(msg => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 16, x: msg.sender === 'user' ? 24 : -24, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                      className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div className={`flex items-start gap-2 ${maximized ? 'max-w-[85%]' : 'max-w-[94%]'}`}>
                        {msg.sender === 'assistant' && (
                          <div className="flex-shrink-0 mt-0.5"><LiraAIAvatar size={26} hasSparkles={false} /></div>
                        )}
                        <div
                          className={`p-3 rounded-2xl leading-relaxed transition-[font-size] ${maximized ? 'text-sm' : 'text-xs'} ${
                            msg.sender === 'user'
                              ? 'bg-lira-blue text-white rounded-tr-md shadow-sm font-medium'
                              : 'bg-white text-lira-text rounded-tl-md shadow-card border border-lira-border/80'
                          }`}
                        >
                          {msg.refinedPrompt && msg.sender === 'assistant' && (
                            <div className="mb-2.5 px-2.5 py-1.5 rounded-xl bg-cyan-50/90 border border-cyan-200/90 text-xs">
                              <div className="flex items-center gap-1 text-cyan-800 font-bold text-[10px] uppercase tracking-wider mb-0.5">
                                <Target className="w-3 h-3" /> Refined goal
                              </div>
                              <p className="text-[11px] text-slate-800 font-medium leading-snug">{msg.refinedPrompt.optimizedGoal}</p>
                            </div>
                          )}

                          {renderMarkdown(msg.text)}

                          {msg.pending && (
                            <div className="mt-2.5 flex items-center gap-2" data-testid="viva-confirm">
                              {msg.pending.state === 'waiting' ? (
                                <>
                                  <button type="button" onClick={() => resolvePending(msg, true)} className="px-3 py-1 bg-lira-blue text-white rounded-lg text-[11px] font-semibold cursor-pointer">Confirm</button>
                                  <button type="button" onClick={() => resolvePending(msg, false)} className="px-3 py-1 bg-white border border-lira-border text-lira-text rounded-lg text-[11px] font-semibold cursor-pointer">Cancel</button>
                                </>
                              ) : (
                                <span className="text-[11px] text-lira-muted">{msg.pending.state === 'confirmed' ? <span className="inline-flex items-center gap-1"><Check className="w-3 h-3" /> Confirmed</span> : <span className="inline-flex items-center gap-1"><X className="w-3 h-3" /> Cancelled, nothing changed</span>}</span>
                              )}
                            </div>
                          )}

                          {msg.undo && (
                            <div className="mt-2.5 flex items-center gap-2" data-testid="viva-undo">
                              {msg.undo.state === 'available' ? (
                                <button type="button" onClick={() => undo(msg)} className="px-3 py-1 bg-white border border-lira-border text-lira-text rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer">
                                  <RotateCcw className="w-3 h-3" /> Undo ({msg.undo.changed} ticket{msg.undo.changed === 1 ? '' : 's'})
                                </button>
                              ) : <span className="inline-flex items-center gap-1 text-[11px] text-lira-muted"><Undo2 className="w-3 h-3" /> Undone</span>}
                            </div>
                          )}

                          {msg.actionTaken?.type === 'dashboard' && msg.actionTaken.dashboardId && (
                            <div className="mt-2.5 p-2 bg-purple-50/70 rounded-xl border border-purple-200/60 flex items-center justify-between gap-2" data-testid="viva-dashboard">
                              <span className="text-[11px] font-semibold text-lira-text truncate">{msg.actionTaken.details}</span>
                              <button
                                type="button"
                                onClick={() => { navigate(`/dashboards/${msg.actionTaken!.dashboardId}`); }}
                                data-testid="viva-open-dashboard"
                                className="px-2 py-0.5 bg-white hover:bg-purple-600 hover:text-white text-purple-700 border border-purple-300 rounded-lg text-[10.5px] font-semibold flex items-center gap-1 transition-all flex-shrink-0 cursor-pointer"
                              >
                                Open dashboard <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
                          )}

                          {msg.actionTaken?.issue && onSelectIssue && (
                            <div className="mt-2.5 p-2 bg-blue-50/70 rounded-xl border border-blue-200/60 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <span className="font-mono font-bold text-[10px] text-lira-blue block truncate">{msg.actionTaken.issue.key}</span>
                                <span className="text-[11px] font-semibold text-lira-text truncate block">{msg.actionTaken.issue.title}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => onSelectIssue(msg.actionTaken!.issue!)}
                                className="px-2 py-0.5 bg-white hover:bg-lira-blue hover:text-white text-lira-blue border border-lira-blue/30 rounded-lg text-[10.5px] font-semibold flex items-center gap-1 transition-all flex-shrink-0 cursor-pointer"
                              >
                                Open <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                        {msg.sender === 'user' && (
                          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5 text-lira-text">
                            <User className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>

                      {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2 ml-8">
                          {msg.suggestedActions.map((action, i) => (
                            <motion.button
                              key={i}
                              type="button"
                              onClick={() => handleSend(action)}
                              initial={{ opacity: 0, y: 10, scale: 0.9 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              transition={{ type: 'spring', stiffness: 460, damping: 28, delay: 0.12 + i * 0.07 }}
                              className="px-2.5 py-1 bg-white hover:bg-purple-50 text-purple-700 hover:text-purple-900 border border-purple-200 rounded-full text-[10.5px] font-medium transition-all hover:-translate-y-0.5 hover:shadow-md flex items-center gap-1 cursor-pointer"
                            >
                              <Zap className="w-3 h-3" /> {action}
                            </motion.button>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ))}

                  {loading && (
                    <motion.div
                      initial={{ opacity: 0, y: 12, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                      className="flex items-start gap-2 max-w-[85%] py-1 select-none"
                    >
                      <div className="flex-shrink-0 mt-0.5"><LiraAIAvatar size={26} hasSparkles={true} /></div>
                      <div className="px-3.5 py-2 bg-gradient-to-r from-[#0C1018] via-[#1A1F3A] to-[#0C1018] rounded-2xl rounded-tl-md border border-purple-500/30 shadow-md text-white flex items-center gap-2.5">
                        <div className="flex items-center gap-1 py-0.5">
                          <span className="w-2 h-2 rounded-full bg-purple-400 animate-typing-dot-1" />
                          <span className="w-2 h-2 rounded-full bg-purple-400 animate-typing-dot-2" />
                          <span className="w-2 h-2 rounded-full bg-purple-400 animate-typing-dot-3" />
                        </div>
                        <span className="text-[11px] font-medium text-purple-200/90 tracking-wide">Viva AI is thinking…</span>
                      </div>
                    </motion.div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input */}
              <div className="p-3 bg-white border-t border-lira-border flex-shrink-0">
                <form
                  onSubmit={e => { e.preventDefault(); handleSend(); }}
                  className={`flex items-center gap-2 mx-auto w-full ${maximized ? 'max-w-3xl' : ''}`}
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Ask anything, or tell me what to do (e.g. “Create a bug in Atmos”)…"
                    className="flex-1 pl-4 pr-4 py-2.5 text-xs border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                    disabled={loading}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || loading}
                    className="p-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl disabled:opacity-40 transition-all shadow-md hover:scale-105 active:scale-95 flex-shrink-0 cursor-pointer"
                    title="Send"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </>
          )}
        </motion.div>
      )}
      </AnimatePresence>
    </>
  );
};

const HeaderButton: React.FC<{ title: string; onClick: () => void; active?: boolean; children: React.ReactNode }> = ({
  title, onClick, active, children,
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={title}
    className={`p-2 rounded-xl transition-all cursor-pointer hover:scale-105 active:scale-95 ${
      active ? 'text-amber-300 bg-white/15 ring-1 ring-amber-400/40' : 'text-white/60 hover:text-white hover:bg-white/10'
    }`}
  >
    {children}
  </button>
);

/** Lightweight markdown & table renderer for chat messages */
function renderMarkdown(content: string): React.ReactNode {
  if (content.includes('|') && content.includes('\n|')) {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let inTable = false;
    let tableRows: string[][] = [];

    const flushTable = (key: string) => {
      if (tableRows.length === 0) return;
      const headers = tableRows[0];
      const bodyRows = tableRows.slice(1).filter(r => !r.every(c => c.match(/^:?-+:?$/)));
      elements.push(
        <div key={key} className="overflow-x-auto my-2 rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-[11px] divide-y divide-gray-200">
            <thead className="bg-gray-50/80 font-bold text-gray-700">
              <tr>{headers.map((h, i) => <th key={i} className="px-2 py-1 text-left font-semibold">{formatInline(h)}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bodyRows.map((row, ri) => (
                <tr key={ri} className="hover:bg-purple-50/30 transition-colors">
                  {row.map((cell, ci) => <td key={ci} className="px-2 py-1 text-gray-700">{formatInline(cell)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
    };

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        inTable = true;
        tableRows.push(trimmed.split('|').slice(1, -1).map(c => c.trim()));
      } else {
        if (inTable) { flushTable(`table-${idx}`); inTable = false; }
        if (trimmed) elements.push(<div key={idx} className="my-0.5 leading-relaxed">{formatInline(line)}</div>);
      }
    });
    if (inTable) flushTable('table-end');
    return <div className="space-y-0.5 font-sans">{elements}</div>;
  }

  return (
    <div className="space-y-1 font-sans leading-relaxed">
      {content.split('\n').map((line, i) => <div key={i}>{formatInline(line)}</div>)}
    </div>
  );
}

function formatInline(str: string): React.ReactNode {
  const parts = str.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="px-1 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200/60 font-mono text-[10px]">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}
