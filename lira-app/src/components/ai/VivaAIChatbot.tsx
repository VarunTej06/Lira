import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Send, Trash2, Sparkles, Maximize2, Minimize2, Settings } from 'lucide-react';
import type { Space } from '../../types/space';
import type { Issue } from '../../types/issue';
import { getAiProvider, getOpenAiConfig, getConfirmWrites, type AiProvider } from '../../services/aiAgentService';
import { LiraAIAvatar } from './LiraAIAvatar';
import { ChatBubble } from './ChatBubble';
import { VivaSettings } from './VivaSettings';
import { useVivaChat } from './useVivaChat';
import { AnimatePresence, motion } from '../common/motionPresets';

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

const MODEL_LABEL = (provider: AiProvider, model: string) => ({ local: 'Local engine', gemini: 'Gemini-powered', openai: `Model: ${model}` }[provider]);

const HeaderButton: React.FC<{ title: string; onClick: () => void; active?: boolean; children: React.ReactNode }> = ({ title, onClick, active, children }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={title}
    className={`p-2 rounded-xl transition-all cursor-pointer hover:scale-105 active:scale-95 ${active ? 'text-amber-300 bg-white/15 ring-1 ring-amber-400/40' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
  >
    {children}
  </button>
);

export const VivaAIChatbot: React.FC<VivaAIChatbotProps> = ({
  isOpen, onClose, onToggle, activeSpace, spaces, onSelectIssue, initialPrompt, onClearInitialPrompt,
}) => {
  const navigate = useNavigate();
  const [maximized, setMaximized] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // Chosen in the settings but also shown in the header and used when sending, so they live here
  const [provider, setProvider] = useState<AiProvider>(getAiProvider());
  const [oai, setOai] = useState(getOpenAiConfig());
  const [confirmWrites, setConfirmWrites] = useState(getConfirmWrites());
  const chat = useVivaChat({ activeSpace, spaces, confirmWrites, isOpen, initialPrompt, onClearInitialPrompt });

  const messagesEnd = useRef<HTMLDivElement>(null);
  const inputBox = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && !showSettings) setTimeout(() => inputBox.current?.focus(), 200);
  }, [isOpen, showSettings, maximized]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.messages, chat.loading, maximized]);

  // Escape leaves the maximised view first, then closes
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (maximized) setMaximized(false); else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, maximized, onClose]);

  const panelStyle: React.CSSProperties = maximized
    ? { width: 'min(700px, calc(100vw - 2.5rem))', height: 'min(720px, calc(100vh - 7.5rem))' }
    : { width: '420px', height: 'min(540px, calc(100vh - 8.5rem))' };
  // The panel grows out of / shrinks back into the round launcher: origin = launcher centre,
  // which sits 25px left of the panel's right edge and 35px below its bottom edge.
  const panelOrigin = 'calc(100% - 25px) calc(100% + 35px)';

  return (
    <>
      <div className="fixed bottom-5 right-5 z-40 select-none">
        <div className="relative group">
          <button
            type="button"
            onClick={onToggle}
            className={`relative rounded-2xl flex items-center justify-center p-0 cursor-pointer shadow-xl transition-all duration-300 hover:scale-110 active:scale-95 animate-float-subtle animate-pulse-glow ${isOpen ? 'ring-2 ring-lira-blue shadow-lira-blue/40 rotate-6' : ''}`}
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
            <div className="opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 absolute right-16 top-1/2 -translate-y-1/2 whitespace-nowrap px-3 py-1.5 bg-lira-nav text-white text-xs font-semibold rounded-xl shadow-xl border border-white/10 flex items-center gap-1.5 translate-x-1 group-hover:translate-x-0">
              <Sparkles className="w-3.5 h-3.5 text-cyan-300" /><span>Ask Viva AI</span>
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
            className="fixed bottom-20 right-5 z-50 max-w-[calc(100vw-2.5rem)] bg-white/95 backdrop-blur-2xl border border-lira-border shadow-[0_24px_60px_-12px_rgba(0,0,0,0.3)] rounded-3xl overflow-hidden flex flex-col font-sans ring-1 ring-black/10 transition-[width,height] duration-300 ease-[cubic-bezier(.4,0,.2,1)]"
          >
            <div className="h-[68px] bg-lira-nav text-white flex items-center justify-between px-4 sm:px-5 flex-shrink-0 select-none relative">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative flex-shrink-0">
                  <LiraAIAvatar size={34} hasSparkles={false} />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-lira-nav" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm tracking-tight whitespace-nowrap">Viva AI</span>
                    <span className="px-1.5 py-0.5 text-4xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 rounded-full">Read &amp; Write</span>
                  </div>
                  <p className="text-2xs text-white/75 font-medium truncate mt-0.5">{MODEL_LABEL(provider, oai.model)} · {spaces.length} spaces connected</p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <HeaderButton title="Settings" active={showSettings} onClick={() => setShowSettings(v => !v)}><Settings className="w-4 h-4" /></HeaderButton>
                <HeaderButton title="Clear chat" onClick={chat.clear}><Trash2 className="w-4 h-4" /></HeaderButton>
                <HeaderButton title={maximized ? 'Restore size' : 'Maximise'} onClick={() => setMaximized(v => !v)}>{maximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}</HeaderButton>
                <HeaderButton title="Close" onClick={onClose}><X className="w-4 h-4" /></HeaderButton>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-lira-nav-accent/60 to-transparent" />
            </div>

            {showSettings ? (
              <VivaSettings
                spaces={spaces} activeSpace={activeSpace} maximized={maximized} onBack={() => setShowSettings(false)}
                provider={provider} setProvider={setProvider} oai={oai} setOai={setOai} confirmWrites={confirmWrites} setConfirmWrites={setConfirmWrites}
              />
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-4 bg-lira-bg/40">
                  <div className={`space-y-4 mx-auto w-full ${maximized ? 'max-w-2xl' : ''}`}>
                    {chat.messages.map(msg => (
                      <ChatBubble
                        key={msg.id} msg={msg} maximized={maximized} onSend={chat.send} onResolve={chat.resolvePending} onUndo={chat.undo}
                        onOpenDashboard={id => navigate(`/dashboards/${id}`)} onSelectIssue={onSelectIssue}
                      />
                    ))}

                    {chat.loading && (
                      <motion.div initial={{ opacity: 0, y: 12, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 30 }} className="flex items-start gap-2 max-w-[85%] py-1 select-none">
                        <div className="flex-shrink-0 mt-0.5"><LiraAIAvatar size={26} hasSparkles={true} /></div>
                        <div className="px-3.5 py-2 bg-lira-nav rounded-2xl rounded-tl-md border border-lira-border shadow-md text-white flex items-center gap-2.5">
                          <div className="flex items-center gap-1 py-0.5">
                            <span className="w-2 h-2 rounded-full bg-lira-nav-accent animate-typing-dot-1" />
                            <span className="w-2 h-2 rounded-full bg-lira-nav-accent animate-typing-dot-2" />
                            <span className="w-2 h-2 rounded-full bg-lira-nav-accent animate-typing-dot-3" />
                          </div>
                          <span className="text-2xs font-medium text-white/80 tracking-wide">Viva AI is thinking…</span>
                        </div>
                      </motion.div>
                    )}
                    <div ref={messagesEnd} />
                  </div>
                </div>

                <div className="p-3 bg-white border-t border-lira-border flex-shrink-0">
                  <form onSubmit={e => { e.preventDefault(); chat.send(); }} className={`flex items-center gap-2 mx-auto w-full ${maximized ? 'max-w-3xl' : ''}`}>
                    <input
                      ref={inputBox}
                      type="text"
                      value={chat.input}
                      onChange={e => chat.setInput(e.target.value)}
                      placeholder="Ask anything, or tell me what to do (e.g. “Create a bug in Atmos”)…"
                      className="flex-1 pl-4 pr-4 py-2.5 text-xs border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-lira-blue/50 focus:border-lira-blue transition-all"
                      disabled={chat.loading}
                    />
                    <button type="submit" disabled={!chat.input.trim() || chat.loading} className="p-2.5 bg-lira-blue hover:bg-lira-blue-hover text-lira-on-blue rounded-2xl disabled:opacity-40 transition-all shadow-md hover:scale-105 active:scale-95 flex-shrink-0 cursor-pointer" title="Send">
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
