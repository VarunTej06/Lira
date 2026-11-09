import { ArrowRight, Check, RotateCcw, Target, Undo2, User, X, Zap } from 'lucide-react';
import type { ChatMessage } from '../../services/aiAgentService';
import type { Issue } from '../../types/issue';
import { LiraAIAvatar } from './LiraAIAvatar';
import { ChatMarkdown } from './ChatMarkdown';
import { motion } from '../common/motion';

const SMALL_BUTTON = 'px-3 py-1 rounded-lg text-[11px] font-semibold cursor-pointer';
const OPEN_BUTTON = 'px-2 py-0.5 bg-white border rounded-lg text-[10.5px] font-semibold flex items-center gap-1 transition-all flex-shrink-0 cursor-pointer';

interface Props {
  msg: ChatMessage;
  maximized: boolean;
  onSend: (text: string) => void;
  onResolve: (msg: ChatMessage, confirm: boolean) => void;
  onUndo: (msg: ChatMessage) => void;
  onOpenDashboard: (id: string) => void;
  onSelectIssue?: (issue: Issue) => void;
}

/** One message in the chat: the text, then whatever Viva attached to it (confirm buttons, undo, links, suggestions). */
export function ChatBubble({ msg, maximized, onSend, onResolve, onUndo, onOpenDashboard, onSelectIssue }: Props) {
  const fromUser = msg.sender === 'user';
  const issue = msg.actionTaken?.issue;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, x: fromUser ? 24 : -24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      className={`flex flex-col ${fromUser ? 'items-end' : 'items-start'}`}
    >
      <div className={`flex items-start gap-2 ${maximized ? 'max-w-[85%]' : 'max-w-[94%]'}`}>
        {!fromUser && <div className="flex-shrink-0 mt-0.5"><LiraAIAvatar size={26} hasSparkles={false} /></div>}
        <div className={`p-3 rounded-2xl leading-relaxed transition-[font-size] ${maximized ? 'text-sm' : 'text-xs'} ${fromUser ? 'bg-lira-blue text-white rounded-tr-md shadow-sm font-medium' : 'bg-white text-lira-text rounded-tl-md shadow-card border border-lira-border/80'}`}>
          {msg.refinedPrompt && !fromUser && (
            <div className="mb-2.5 px-2.5 py-1.5 rounded-xl bg-cyan-50/90 border border-cyan-200/90 text-xs">
              <div className="flex items-center gap-1 text-cyan-800 font-bold text-[10px] uppercase tracking-wider mb-0.5"><Target className="w-3 h-3" /> Refined goal</div>
              <p className="text-[11px] text-slate-800 font-medium leading-snug">{msg.refinedPrompt.optimizedGoal}</p>
            </div>
          )}

          <ChatMarkdown text={msg.text} />

          {msg.pending && (
            <div className="mt-2.5 flex items-center gap-2" data-testid="viva-confirm">
              {msg.pending.state === 'waiting' ? (
                <>
                  <button type="button" onClick={() => onResolve(msg, true)} className={`${SMALL_BUTTON} bg-lira-blue text-white`}>Confirm</button>
                  <button type="button" onClick={() => onResolve(msg, false)} className={`${SMALL_BUTTON} bg-white border border-lira-border text-lira-text`}>Cancel</button>
                </>
              ) : (
                <span className="text-[11px] text-lira-muted inline-flex items-center gap-1">
                  {msg.pending.state === 'confirmed' ? <><Check className="w-3 h-3" /> Confirmed</> : <><X className="w-3 h-3" /> Cancelled, nothing changed</>}
                </span>
              )}
            </div>
          )}

          {msg.undo && (
            <div className="mt-2.5 flex items-center gap-2" data-testid="viva-undo">
              {msg.undo.state === 'available' ? (
                <button type="button" onClick={() => onUndo(msg)} className={`${SMALL_BUTTON} bg-white border border-lira-border text-lira-text flex items-center gap-1`}>
                  <RotateCcw className="w-3 h-3" /> Undo ({msg.undo.changed} ticket{msg.undo.changed === 1 ? '' : 's'})
                </button>
              ) : <span className="inline-flex items-center gap-1 text-[11px] text-lira-muted"><Undo2 className="w-3 h-3" /> Undone</span>}
            </div>
          )}

          {msg.actionTaken?.type === 'dashboard' && msg.actionTaken.dashboardId && (
            <div className="mt-2.5 p-2 bg-purple-50/70 rounded-xl border border-purple-200/60 flex items-center justify-between gap-2" data-testid="viva-dashboard">
              <span className="text-[11px] font-semibold text-lira-text truncate">{msg.actionTaken.details}</span>
              <button type="button" onClick={() => onOpenDashboard(msg.actionTaken!.dashboardId!)} data-testid="viva-open-dashboard" className={`${OPEN_BUTTON} hover:bg-purple-600 hover:text-white text-purple-700 border-purple-300`}>
                Open dashboard <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}

          {issue && onSelectIssue && (
            <div className="mt-2.5 p-2 bg-blue-50/70 rounded-xl border border-blue-200/60 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="font-mono font-bold text-[10px] text-lira-blue block truncate">{issue.key}</span>
                <span className="text-[11px] font-semibold text-lira-text truncate block">{issue.title}</span>
              </div>
              <button type="button" onClick={() => onSelectIssue(issue)} className={`${OPEN_BUTTON} hover:bg-lira-blue hover:text-white text-lira-blue border-lira-blue/30`}>
                Open <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        {fromUser && <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5 text-lira-text"><User className="w-3.5 h-3.5" /></div>}
      </div>

      {msg.suggestedActions && msg.suggestedActions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2 ml-8">
          {msg.suggestedActions.map((action, i) => (
            <motion.button
              key={i}
              type="button"
              onClick={() => onSend(action)}
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
  );
}
