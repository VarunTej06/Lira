import React, { useState, useRef, useEffect } from 'react';
import {
  X, Send, Trash2, ArrowRight,
  Sparkles, User, Zap
} from 'lucide-react';
import type { Space } from '../../types/space';
import type { Issue } from '../../types/issue';
import { processUserMessage, type ChatMessage } from '../../services/aiAgentService';
import { LiraAIAvatar } from './LiraAIAvatar';

interface LiraInfoChatbotProps {
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
  onOpenAgent: (prompt?: string) => void;
  activeSpace: Space | undefined;
  spaces: Space[];
  onSelectIssue?: (issue: Issue) => void;
}

export const LiraInfoChatbot: React.FC<LiraInfoChatbotProps> = ({
  isOpen,
  onClose,
  onToggle,
  onOpenAgent,
  activeSpace,
  spaces,
  onSelectIssue,
}) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      sender: 'assistant',
      text: `👋 **Welcome to Lira Info Chatbot!**\n\nI am your **Read-Only Information & Search Assistant**. I can fetch data, search tickets, and generate status breakdown tables across all **${spaces.length} spaces**.\n\n*(To execute write tasks like creating or moving tickets, use the Lira AI Agent in the top bar!)*\n\nTry clicking a prompt below:`,
      timestamp: new Date(),
      suggestedActions: [
        'Show all spaces with number of tickets in each To do, Backlog, In Progress and Done',
        'What tasks are in Atmos?',
        'What is in progress across all spaces?',
        'Show all Epics across spaces',
      ],
    },
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'user',
      text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Natural social media typing indicator delay
      await new Promise(resolve => setTimeout(resolve, 600));
      const response = await processUserMessage(text, activeSpace, spaces, 'info');
      setMessages(prev => [...prev, response]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now()),
          sender: 'assistant',
          text: `⚠️ **Chatbot Error**: Failed to retrieve information. Please try again.`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────
          1. FLOATING AVATAR TRIGGER (Bottom-Right Corner)
          Fixed at bottom-5 right-5. Gentle floating bob & glowing pulse.
         ───────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-5 right-5 z-40 select-none">
        <div className="relative group">
          <button
            type="button"
            onClick={onToggle}
            className={`relative rounded-2xl flex items-center justify-center p-0 cursor-pointer shadow-xl transition-all duration-300 hover:scale-108 active:scale-95 animate-float-subtle animate-pulse-glow ${
              isOpen ? 'ring-3 ring-purple-500 shadow-purple-500/40' : ''
            }`}
            title="Lira Info Chatbot (Read-Only Search & Analytics)"
            aria-label="Toggle Lira Info Chatbot"
          >
            <LiraAIAvatar size={50} hasSparkles={true} />

            {/* Online Pulse Dot */}
            <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white shadow-xs" />
            </span>
          </button>

          {/* Micro-hover Tooltip (when closed) */}
          {!isOpen && (
            <div className="opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 absolute right-16 top-1/2 -translate-y-1/2 whitespace-nowrap px-3 py-1.5 bg-[#1D2125] text-white text-xs font-semibold rounded-xl shadow-xl border border-white/10 flex items-center gap-1.5 translate-x-1 group-hover:translate-x-0">
              <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
              <span>Lira Info Chatbot</span>
              <span className="text-[10px] text-cyan-300 font-mono">ℹ️ Read-Only</span>
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. FLOATING CURVED DIALOGUE CARD (Read-Only Info Assistant)
          Docked above the avatar at bottom-20 right-5, curved on all sides.
         ───────────────────────────────────────────────────────────── */}
      {isOpen && (
        <div className="fixed bottom-20 right-5 z-50 w-[440px] max-w-[calc(100vw-2.5rem)] h-[510px] max-h-[calc(100vh-8.5rem)] bg-white/95 backdrop-blur-2xl border border-cyan-500/25 shadow-[0_20px_50px_-10px_rgba(6,182,212,0.25)] rounded-3xl overflow-hidden flex flex-col font-sans transition-all duration-300 ease-out origin-bottom-right ring-1 ring-black/10">
          {/* Header (Refined Pro Dark Bar) */}
          <div className="h-[72px] bg-gradient-to-r from-[#0C1018] via-[#141C2A] to-[#0C1018] text-white flex items-center justify-between px-4 sm:px-5 flex-shrink-0 select-none border-b border-white/10 relative">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative flex-shrink-0">
                <LiraAIAvatar size={34} hasSparkles={false} />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-cyan-400 rounded-full border-2 border-[#0C1018] shadow-xs" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm tracking-tight text-white whitespace-nowrap">
                    Lira Info Chatbot
                  </span>
                  <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/35 rounded-full flex-shrink-0">
                    Read-Only
                  </span>
                </div>
                <p className="text-[11px] text-cyan-200/75 font-medium truncate mt-0.5">
                  Cross-Space Search & Metrics
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Switch to Full Agent Button */}
              <button
                type="button"
                onClick={() => onOpenAgent()}
                className="px-3 py-1.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md flex items-center gap-1.5 transition-all hover:scale-102 active:scale-98 cursor-pointer"
                title="Switch to Lira Autonomous Agent (Read & Write)"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>Agent</span>
              </button>

              {/* Clear chat */}
              <button
                type="button"
                onClick={() => setMessages(messages.slice(0, 1))}
                className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                title="Clear Chat History"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              {/* Close button */}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                title="Close Info Chatbot"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Glowing Accent Underline */}
            <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 bg-jira-bg/40">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-start gap-2 max-w-[94%]">
                  {msg.sender === 'assistant' && (
                    <div className="flex-shrink-0 mt-0.5">
                      <LiraAIAvatar size={24} hasSparkles={false} />
                    </div>
                  )}

                  <div
                    className={`p-3 rounded-2xl text-xs leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-jira-blue text-white rounded-tr-xs shadow-sm font-medium'
                        : 'bg-white text-jira-text rounded-tl-xs shadow-card border border-jira-border/80'
                    }`}
                  >
                    {/* Refined Goal / Prompt Optimization Badge */}
                    {msg.refinedPrompt && msg.sender === 'assistant' && (
                      <div className="mb-2.5 px-2.5 py-1.5 rounded-xl bg-cyan-50/90 border border-cyan-200/90 text-xs">
                        <div className="flex items-center gap-1 text-cyan-800 font-bold text-[10px] uppercase tracking-wider mb-0.5">
                          <span className="text-xs">🎯</span> Refined Goal
                        </div>
                        <p className="text-[11px] text-slate-800 font-medium leading-snug">
                          {msg.refinedPrompt.optimizedGoal}
                        </p>
                      </div>
                    )}

                    {/* Formatted Markdown */}
                    {renderMarkdown(msg.text)}

                    {/* Switch to Agent CTA Card when user attempts a write action */}
                    {msg.actionTaken?.type === 'switch_to_agent' && (
                      <div className="mt-2.5 p-2.5 bg-purple-50/80 rounded-xl border border-purple-200/80 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-bold text-[11px] text-purple-900 block">
                            ⚡ Autonomous Execution Required
                          </span>
                          <span className="text-[10px] text-purple-700 block truncate">
                            Run in Lira AI Agent to execute write actions
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onOpenAgent(msg.actionTaken?.details)}
                          className="px-2.5 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-[10.5px] font-semibold flex items-center gap-1 transition-all shadow-xs flex-shrink-0 cursor-pointer"
                        >
                          Open Agent <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {/* Open Issue Card if issue detail inspected */}
                    {msg.actionTaken?.issue && onSelectIssue && (
                      <div className="mt-2.5 p-2 bg-blue-50/70 rounded-xl border border-blue-200/60 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-mono font-bold text-[10px] text-jira-blue block truncate">
                            {msg.actionTaken.issue.key}
                          </span>
                          <span className="text-[10.5px] font-semibold text-jira-text truncate block">
                            {msg.actionTaken.issue.title}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onSelectIssue(msg.actionTaken!.issue!)}
                          className="px-2 py-0.5 bg-white hover:bg-jira-blue hover:text-white text-jira-blue border border-jira-blue/30 rounded-lg text-[10.5px] font-semibold flex items-center gap-1 transition-all shadow-2xs flex-shrink-0 cursor-pointer"
                        >
                          Open <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {msg.sender === 'user' && (
                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5 text-jira-text">
                      <User className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>

                {/* Suggested Action Pills */}
                {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5 ml-8">
                    {msg.suggestedActions.map((action, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSend(action)}
                        className="px-2 py-0.5 bg-white hover:bg-purple-50 text-purple-700 hover:text-purple-900 border border-purple-200 rounded-full text-[10px] font-medium transition-all shadow-2xs hover:scale-102 flex items-center gap-1 cursor-pointer"
                      >
                        <span>⚡</span> {action}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Social Media Style Typing Indicator Animation */}
            {loading && (
              <div className="flex items-start gap-2 max-w-[85%] py-1 select-none">
                <div className="flex-shrink-0 mt-0.5">
                  <LiraAIAvatar size={24} hasSparkles={false} />
                </div>
                <div className="px-3.5 py-2 bg-gradient-to-r from-[#0C1018] via-[#141C2A] to-[#0C1018] rounded-2xl rounded-tl-xs border border-cyan-500/30 shadow-md text-white flex items-center gap-2.5">
                  <div className="flex items-center gap-1 py-0.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-typing-dot-1"></span>
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-typing-dot-2"></span>
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-typing-dot-3"></span>
                  </div>
                  <span className="text-[11px] font-medium text-cyan-200/90 tracking-wide">
                    Lira Avatar is typing...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="p-3 bg-white border-t border-jira-border flex-shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask info (e.g. 'Show status breakdown of all spaces')..."
                className="flex-1 pl-3.5 pr-4 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all shadow-inner"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="p-2 bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white rounded-xl disabled:opacity-40 transition-all shadow-md hover:scale-102 active:scale-98 flex-shrink-0 cursor-pointer"
                title="Send query"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <p className="text-[10px] text-jira-muted mt-1.5 text-center">
              <span>🌐 Read-Only across {spaces.length} spaces • </span>
              <button
                type="button"
                onClick={() => onOpenAgent()}
                className="text-purple-600 hover:underline font-semibold cursor-pointer"
              >
                Open Lira AI Agent for Write Actions
              </button>
            </p>
          </div>
        </div>
      )}
    </>
  );
};

/**
 * Lightweight markdown & table renderer for chatbot data tables
 */
function renderMarkdown(content: string): React.ReactNode {
  if (content.includes('|') && content.includes('\n|')) {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let inTable = false;
    let tableRows: string[][] = [];

    const flushTable = (key: string) => {
      if (tableRows.length > 0) {
        const headers = tableRows[0];
        const bodyRows = tableRows.slice(1).filter(r => !r.every(c => c.match(/^:?-+:?$/)));
        elements.push(
          <div key={key} className="overflow-x-auto my-2 rounded-xl border border-gray-200 bg-white shadow-2xs">
            <table className="min-w-full text-[10.5px] divide-y divide-gray-200">
              <thead className="bg-gray-50/80 font-bold text-gray-700">
                <tr>
                  {headers.map((h, i) => (
                    <th key={i} className="px-2 py-1 text-left font-semibold">{formatInline(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bodyRows.map((row, ri) => (
                  <tr key={ri} className="hover:bg-purple-50/30 transition-colors">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-2 py-1 text-gray-700">{formatInline(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
      }
    };

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        inTable = true;
        const cells = trimmed.split('|').slice(1, -1).map(c => c.trim());
        tableRows.push(cells);
      } else {
        if (inTable) {
          flushTable(`table-${idx}`);
          inTable = false;
        }
        if (trimmed) {
          elements.push(
            <div key={idx} className="my-0.5 leading-relaxed">
              {formatInline(line)}
            </div>
          );
        }
      }
    });

    if (inTable) flushTable('table-end');
    return <div className="space-y-0.5 font-sans">{elements}</div>;
  }

  return (
    <div className="space-y-1 font-sans leading-relaxed">
      {content.split('\n').map((line, i) => (
        <div key={i}>{formatInline(line)}</div>
      ))}
    </div>
  );
}

function formatInline(str: string): React.ReactNode {
  const parts = str.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-bold text-jira-text">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="px-1 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200/60 font-mono text-[10px]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
