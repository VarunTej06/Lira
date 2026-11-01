import React, { useState, useRef, useEffect } from 'react';
import {
  X, Send, Trash2, ArrowRight,
  CheckCircle2, Settings, RotateCcw, Check,
  Key, FileText, Database, Shield, User, Zap
} from 'lucide-react';
import type { Space } from '../../types/space';
import type { Issue } from '../../types/issue';
import {
  processUserMessage,
  type ChatMessage,
  getSystemInstruction,
  setSystemInstruction,
  getGeminiApiKey,
  setGeminiApiKey,
  DEFAULT_SYSTEM_INSTRUCTION
} from '../../services/aiAgentService';
import { LiraAIAvatar } from './LiraAIAvatar';

interface LiraAIAgentConsoleProps {
  isOpen: boolean;
  onClose: () => void;
  activeSpace: Space | undefined;
  spaces: Space[];
  initialPrompt?: string | null;
  onClearInitialPrompt?: () => void;
  onSelectIssue?: (issue: Issue) => void;
}

export const LiraAIAgentConsole: React.FC<LiraAIAgentConsoleProps> = ({
  isOpen,
  onClose,
  activeSpace,
  spaces,
  initialPrompt,
  onClearInitialPrompt,
  onSelectIssue,
}) => {
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [systemInstructionText, setSystemInstructionText] = useState(getSystemInstruction());
  const [apiKeyInput, setApiKeyInput] = useState(getGeminiApiKey());
  const [showApiKey, setShowApiKey] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      sender: 'assistant',
      text: `⚡ **Welcome to Lira AI Autonomous Agent Console!**\n\nI have **full read & write autonomous capabilities** across all **${spaces.length} spaces**. I can execute commands, transition statuses, create tasks, and generate domain subtasks directly into your database.\n\nTry commanding me below:`,
      timestamp: new Date(),
      suggestedActions: [
        'Show all spaces with number of tickets in each To do, Backlog, In Progress and Done',
        'Move AP-10 to in progress',
        'What is in progress across all spaces?',
        'Create task "Configure Helm" in Atmos',
        'Show all Epics across spaces',
      ],
    },
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && !showSettings) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, showSettings]);

  useEffect(() => {
    if (!showSettings) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, showSettings]);

  // Handle incoming prompt passed from Chatbot
  useEffect(() => {
    if (isOpen && initialPrompt) {
      handleSend(initialPrompt);
      if (onClearInitialPrompt) onClearInitialPrompt();
    }
  }, [isOpen, initialPrompt]);

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
      const response = await processUserMessage(text, activeSpace, spaces, 'agent');
      setMessages(prev => [...prev, response]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now()),
          sender: 'assistant',
          text: `⚠️ **Agent Error**: Failed to execute request. Please try again.`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = () => {
    setSystemInstruction(systemInstructionText);
    setGeminiApiKey(apiKeyInput.trim());
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleResetSystemInstruction = () => {
    setSystemInstructionText(DEFAULT_SYSTEM_INSTRUCTION);
    setSystemInstruction(DEFAULT_SYSTEM_INSTRUCTION);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-16 right-5 bottom-5 z-50 w-[540px] max-w-[calc(100vw-2.5rem)] bg-white/95 backdrop-blur-2xl border border-purple-500/25 shadow-[0_25px_65px_-15px_rgba(88,28,135,0.35)] rounded-3xl overflow-hidden flex flex-col font-sans transition-all duration-300 ease-out origin-top-right ring-1 ring-black/10 select-none animate-scale-in">
      {/* Header */}
      <div className="h-[72px] bg-gradient-to-r from-[#0F1117] via-[#1B182B] to-[#0F1117] text-white flex items-center justify-between px-4 sm:px-5 flex-shrink-0 border-b border-purple-500/20 relative select-none">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0">
            <LiraAIAvatar size={35} hasSparkles={true} />
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#0F1117] shadow-xs" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-white whitespace-nowrap">
                Lira AI Agent
              </span>
              <span className="px-2 py-0.5 text-[9.5px] font-bold bg-purple-500/25 text-purple-300 border border-purple-500/40 rounded-full flex-shrink-0 shadow-xs flex items-center gap-1">
                <Zap className="w-2.5 h-2.5 text-amber-300" /> Autonomous
              </span>
              <span className="px-1.5 py-0.2 text-[8.5px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full hidden sm:inline-flex">
                {apiKeyInput ? 'Gemini 1.5' : 'Local Engine'}
              </span>
            </div>
            <p className="text-[11px] text-purple-200/75 font-medium truncate mt-0.5">
              {activeSpace ? `${activeSpace.icon} ${activeSpace.name} • Read & Write Controller` : '⚡ Cross-Space Full Autonomous Controller'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Settings button */}
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded-xl transition-all cursor-pointer ${
              showSettings ? 'text-amber-300 bg-white/20 ring-1 ring-amber-400/50' : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
            title="System Instructions & Agent Settings"
          >
            <Settings className="w-4.5 h-4.5" />
          </button>

          {/* Clear history */}
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
            title="Close Agent Console"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Glowing Purple Accent Line Under Header */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-purple-500/60 to-transparent" />
      </div>

      {/* BODY: Either Settings View or Chat Feed */}
      {showSettings ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/70 text-jira-text select-text">
          {/* Header of settings */}
          <div className="flex items-center justify-between pb-2 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-600" />
              <h3 className="font-bold text-sm text-jira-text">Agent System Instructions</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="text-xs text-jira-blue hover:underline font-semibold cursor-pointer"
            >
              Back to Console →
            </button>
          </div>

          {/* Omnipresence Space Status */}
          <div className="bg-white border border-jira-border rounded-2xl p-3 shadow-xs">
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-xs font-bold text-jira-text uppercase tracking-wide">
                Cross-Space Visibility ({spaces.length} Spaces Connected)
              </span>
            </div>
            <p className="text-[11px] text-jira-muted leading-relaxed mb-2.5">
              The AI Agent has direct real-time read and write access across all spaces:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {spaces.map(s => (
                <span
                  key={s.id}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border flex items-center gap-1 ${
                    s.id === activeSpace?.id
                      ? 'bg-purple-50 text-purple-700 border-purple-200 ring-1 ring-purple-300'
                      : 'bg-gray-100 text-gray-700 border-gray-200'
                  }`}
                >
                  <span>{s.icon}</span>
                  <span>{s.name}</span>
                  <span className="font-mono text-gray-400">[{s.key}]</span>
                </span>
              ))}
            </div>
          </div>

          {/* System Instructions Textarea */}
          <div className="bg-white border border-jira-border rounded-2xl p-3 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-purple-600" />
                <label className="text-xs font-bold text-jira-text uppercase tracking-wide">
                  System Instruction Prompt
                </label>
              </div>
              <button
                type="button"
                onClick={handleResetSystemInstruction}
                className="text-[10px] text-jira-muted hover:text-purple-600 flex items-center gap-1 transition-colors cursor-pointer"
                title="Reset to default system prompt"
              >
                <RotateCcw className="w-3 h-3" /> Reset default
              </button>
            </div>
            <textarea
              rows={9}
              value={systemInstructionText}
              onChange={e => setSystemInstructionText(e.target.value)}
              className="w-full text-xs font-mono text-jira-text border border-gray-200 rounded-xl p-2.5 bg-gray-50/50 focus:bg-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 leading-relaxed transition-all"
              placeholder="System instructions governing the AI Agent..."
            />
            <p className="text-[10px] text-jira-muted mt-1.5">
              Defines the agent's identity, cross-space directives, ticket hierarchy, and response formatting.
            </p>
          </div>

          {/* Model Engine & Optional API Key */}
          <div className="bg-white border border-jira-border rounded-2xl p-3 shadow-xs">
            <div className="flex items-center gap-1.5 mb-2">
              <Key className="w-3.5 h-3.5 text-amber-500" />
              <label className="text-xs font-bold text-jira-text uppercase tracking-wide">
                LLM Engine & API Configuration
              </label>
            </div>

            <div className="space-y-2">
              <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200/60 text-xs text-emerald-800 flex items-center justify-between">
                <div>
                  <span className="font-semibold block text-[11px]">⚡ Built-in Local Offline Engine</span>
                  <span className="text-[10px] text-emerald-700">Always active • Zero-key required • 100% private & instant</span>
                </div>
                <span className="text-xs">✅</span>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-jira-muted mb-1">
                  Google Gemini API Key (Optional for Cloud LLM reasoning)
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={e => setApiKeyInput(e.target.value)}
                    placeholder="AIzaSy... (leave empty to use local engine)"
                    className="w-full text-xs border border-gray-300 rounded-xl pl-2.5 pr-14 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-2 text-[10px] text-jira-muted hover:text-jira-text cursor-pointer"
                  >
                    {showApiKey ? 'Hide' : 'Show'}
                  </button>
                </div>
                <p className="text-[10px] text-jira-muted mt-1">
                  Obtain a free key from Google AI Studio. If left empty, LIRA uses the high-speed local agentic engine.
                </p>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleSaveSettings}
              className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Configuration Saved Successfully!</span>
                </>
              ) : (
                <span>Save AI Configuration</span>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* Chat Feed */
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-jira-bg/40 select-text">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-start gap-2 max-w-[94%]">
                  {msg.sender === 'assistant' && (
                    <div className="flex-shrink-0 mt-0.5">
                      <LiraAIAvatar size={26} hasSparkles={false} />
                    </div>
                  )}

                  <div
                    className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-jira-blue text-white rounded-tr-xs shadow-sm font-medium'
                        : 'bg-white text-jira-text rounded-tl-xs shadow-card border border-jira-border/80'
                    }`}
                  >
                    {/* Refined Goal / Prompt Optimization Badge */}
                    {msg.refinedPrompt && msg.sender === 'assistant' && (
                      <div className="mb-2.5 px-3 py-2 rounded-xl bg-purple-50/90 border border-purple-200/90 text-xs">
                        <div className="flex items-center gap-1.5 text-purple-800 font-bold text-[10px] uppercase tracking-wider mb-0.5">
                          <span className="text-xs">🎯</span> Refined Goal
                        </div>
                        <p className="text-[11px] text-slate-800 font-medium leading-snug">
                          {msg.refinedPrompt.optimizedGoal}
                        </p>
                      </div>
                    )}

                    {/* Render formatted text */}
                    {renderMarkdown(msg.text)}

                    {/* Action Card if issue created or updated */}
                    {msg.actionTaken && msg.actionTaken.issue && (
                      <div className="mt-3 p-2.5 bg-blue-50/70 rounded-xl border border-blue-200/60 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <div className="min-w-0">
                            <span className="font-mono font-bold text-[10px] text-jira-blue block truncate">
                              {msg.actionTaken.issue.key}
                            </span>
                            <span className="text-[11px] font-semibold text-jira-text truncate block">
                              {msg.actionTaken.issue.title}
                            </span>
                          </div>
                        </div>
                        {onSelectIssue && (
                          <button
                            type="button"
                            onClick={() => onSelectIssue(msg.actionTaken!.issue!)}
                            className="px-2.5 py-1 bg-white hover:bg-jira-blue hover:text-white text-jira-blue border border-jira-blue/30 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all shadow-2xs flex-shrink-0 cursor-pointer"
                          >
                            Open <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {msg.sender === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5 text-jira-text">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {/* Suggested Action Pills */}
                {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 ml-8">
                    {msg.suggestedActions.map((action, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSend(action)}
                        className="px-2.5 py-1 bg-white hover:bg-purple-50 text-purple-700 hover:text-purple-900 border border-purple-200 rounded-full text-[11px] font-medium transition-all shadow-2xs hover:scale-102 flex items-center gap-1 cursor-pointer"
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
              <div className="flex items-start gap-2.5 max-w-[85%] py-1 select-none">
                <div className="flex-shrink-0 mt-0.5">
                  <LiraAIAvatar size={26} hasSparkles={true} />
                </div>
                <div className="px-4 py-2 bg-gradient-to-r from-[#0F1117] via-[#1B182B] to-[#0F1117] rounded-2xl rounded-tl-xs border border-purple-500/35 shadow-md text-white flex items-center gap-2.5">
                  <div className="flex items-center gap-1.5 py-0.5">
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-typing-dot-1"></span>
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-typing-dot-2"></span>
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-typing-dot-3"></span>
                  </div>
                  <span className="text-[11.5px] font-medium text-purple-200/95 tracking-wide">
                    Lira Agent is typing & formulating goals...
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
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Command across any space (e.g. 'Move AP-10 to in progress')..."
                  className="w-full pl-3.5 pr-4 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all shadow-inner"
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="p-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl disabled:opacity-40 transition-all shadow-md hover:scale-102 active:scale-98 flex-shrink-0 cursor-pointer"
                title="Execute command"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <p className="text-[10px] text-jira-muted mt-1.5 text-center flex items-center justify-center gap-1.5">
              <span>⚡ Autonomous Read & Write across {spaces.length} spaces</span>
              <span>•</span>
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="text-purple-600 hover:underline font-semibold cursor-pointer"
              >
                Configure System Instructions
              </button>
            </p>
          </div>
        </>
      )}
    </div>
  );
};

/**
 * Lightweight markdown & table renderer for agent data tables
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
            <table className="min-w-full text-[11px] divide-y divide-gray-200">
              <thead className="bg-gray-50/80 font-bold text-gray-700">
                <tr>
                  {headers.map((h, i) => (
                    <th key={i} className="px-2.5 py-1.5 text-left font-semibold">{formatInline(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bodyRows.map((row, ri) => (
                  <tr key={ri} className="hover:bg-purple-50/30 transition-colors">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-2.5 py-1.5 text-gray-700">{formatInline(cell)}</td>
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
            <div key={idx} className="my-1 leading-relaxed">
              {formatInline(line)}
            </div>
          );
        }
      }
    });

    if (inTable) flushTable('table-end');
    return <div className="space-y-1 font-sans">{elements}</div>;
  }

  return (
    <div className="space-y-1.5 font-sans leading-relaxed">
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
        <code key={i} className="px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/60 font-mono text-[10.5px]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
