import { ArrowRight, Check, RotateCcw, Target, Undo2, User, X, Zap } from 'lucide-react';
import type { ChatMessage } from '../../services/aiAgentService';
import type { Issue } from '../../types/issue';
import { LiraAIAvatar } from './LiraAIAvatar';
import { ChatMarkdown } from './ChatMarkdown';
import { motion } from '../common/motionPresets';

const SMALL_BUTTON = 'px-3 py-1 rounded-lg text-2xs font-semibold cursor-pointer';
const OPEN_BUTTON = 'px-2 py-0.5 bg-white border rounded-lg text-3xs-plus font-semibold flex items-center gap-1 transition-all flex-shrink-0 cursor-pointer';

interface Props {
  msg: ChatMessage;
  maximized: boolean;
  onSend: (text: string) => void;
  onResolve: (msg: ChatMessage, confirm: boolean) => void;
  onUndo: (msg: ChatMessage) => void;
  onOpenDashboard: (id: string) => void;
  onSelectIssue?: (issue: Issue) => void;
}

/** The goal Viva worked out from the question. */
function RefinedGoal({ goal }: { goal: string }) {
  return (
    <div className="mb-2.5 px-2.5 py-1.5 rounded-xl bg-cyan-50/90 border border-cyan-200/90 text-xs">
      <div className="flex items-center gap-1 text-cyan-800 font-bold text-3xs uppercase tracking-wider mb-0.5"><Target className="w-3 h-3" /> Refined goal</div>
      <p className="text-2xs text-slate-800 font-medium leading-snug">{goal}</p>
    </div>
  );
}

type Pending = NonNullable<ChatMessage['pending']>;

/** Confirm and Cancel while a change waits for an answer, then what was decided. */
function ConfirmRow({ pending, onResolve }: { pending: Pending; onResolve: (confirm: boolean) => void }) {
  return (
    <div className="mt-2.5 flex items-center gap-2" data-testid="viva-confirm">
      {pending.state === 'waiting' ? (
        <>
          <button type="button" onClick={() => onResolve(true)} className={`${SMALL_BUTTON} bg-lira-blue text-lira-on-blue`}>Confirm</button>
          <button type="button" onClick={() => onResolve(false)} className={`${SMALL_BUTTON} bg-white border border-lira-border text-lira-text`}>Cancel</button>
        </>
      ) : (
        <span className="text-2xs text-lira-muted inline-flex items-center gap-1">
          {pending.state === 'confirmed' ? <><Check className="w-3 h-3" /> Confirmed</> : <><X className="w-3 h-3" /> Cancelled, nothing changed</>}
        </span>
      )}
    </div>
  );
}

type UndoState = NonNullable<ChatMessage['undo']>;

/** The Undo button after a change, then "Undone". */
function UndoRow({ undo, onUndo }: { undo: UndoState; onUndo: () => void }) {
  return (
    <div className="mt-2.5 flex items-center gap-2" data-testid="viva-undo">
      {undo.state === 'available' ? (
        <button type="button" onClick={() => onUndo()} className={`${SMALL_BUTTON} bg-white border border-lira-border text-lira-text flex items-center gap-1`}>
          <RotateCcw className="w-3 h-3" /> Undo ({undo.changed} ticket{undo.changed === 1 ? '' : 's'})
        </button>
      ) : <span className="inline-flex items-center gap-1 text-2xs text-lira-muted"><Undo2 className="w-3 h-3" /> Undone</span>}
    </div>
  );
}

/** A link to the dashboard Viva just built. */
function DashboardCard({ details, onOpen }: { details?: string; onOpen: () => void }) {
  return (
    <div className="mt-2.5 p-2 bg-lira-blue-light/70 rounded-xl border border-lira-border flex items-center justify-between gap-2" data-testid="viva-dashboard">
      <span className="text-2xs font-semibold text-lira-text truncate">{details}</span>
      <button type="button" onClick={() => onOpen()} data-testid="viva-open-dashboard" className={`${OPEN_BUTTON} hover:bg-lira-blue hover:text-lira-on-blue text-lira-blue border-lira-border`}>
        Open dashboard <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}

/** A link to the ticket Viva created or looked at. */
function IssueCard({ issue, onOpen }: { issue: Issue; onOpen: () => void }) {
  return (
    <div className="mt-2.5 p-2 bg-lira-blue-light/70 rounded-xl border border-lira-border flex items-center justify-between gap-2">
      <div className="min-w-0">
        <span className="font-mono font-bold text-3xs text-lira-blue block truncate">{issue.key}</span>
        <span className="text-2xs font-semibold text-lira-text truncate block">{issue.title}</span>
      </div>
      <button type="button" onClick={() => onOpen()} className={`${OPEN_BUTTON} hover:bg-lira-blue hover:text-lira-on-blue text-lira-blue border-lira-blue/30`}>
        Open <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}

/** Follow-up questions Viva suggests; clicking one sends it. */
function SuggestedActions({ actions, onSend }: { actions: string[]; onSend: (text: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2 ml-8">
      {actions.map((action, i) => (
        <motion.button
          key={i}
          type="button"
          onClick={() => onSend(action)}
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 460, damping: 28, delay: 0.12 + i * 0.07 }}
          className="px-2.5 py-1 bg-white hover:bg-lira-blue-light text-lira-blue hover:text-lira-text border border-lira-border rounded-full text-3xs-plus font-medium transition-all hover:-translate-y-0.5 hover:shadow-md flex items-center gap-1 cursor-pointer"
        >
          <Zap className="w-3 h-3" /> {action}
        </motion.button>
      ))}
    </div>
  );
}

const BUBBLE_USER = 'bg-lira-blue text-lira-on-blue rounded-tr-md shadow-sm font-medium';
const BUBBLE_VIVA = 'bg-white text-lira-text rounded-tl-md shadow-card border border-lira-border/80';

/** What Viva attached to a message: confirm buttons, undo, a link to a dashboard, a ticket card. */
function Attachments({ msg, onResolve, onUndo, onOpenDashboard, onSelectIssue }: Pick<Props, 'msg' | 'onResolve' | 'onUndo' | 'onOpenDashboard' | 'onSelectIssue'>) {
  const issue = msg.actionTaken?.issue;
  const dashboardId = msg.actionTaken?.type === 'dashboard' ? msg.actionTaken.dashboardId : undefined;
  return (
    <>
      {msg.pending && <ConfirmRow pending={msg.pending} onResolve={confirm => onResolve(msg, confirm)} />}
      {msg.undo && <UndoRow undo={msg.undo} onUndo={() => onUndo(msg)} />}
      {dashboardId && <DashboardCard details={msg.actionTaken!.details} onOpen={() => onOpenDashboard(dashboardId)} />}
      {issue && onSelectIssue && <IssueCard issue={issue} onOpen={() => onSelectIssue(issue)} />}
    </>
  );
}

/** One message in the chat: the text, then whatever Viva attached to it (confirm buttons, undo, links, suggestions). */
export function ChatBubble({ msg, maximized, onSend, onResolve, onUndo, onOpenDashboard, onSelectIssue }: Props) {
  const fromUser = msg.sender === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, x: fromUser ? 24 : -24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      className={`flex flex-col ${fromUser ? 'items-end' : 'items-start'}`}
    >
      <div className={`flex items-start gap-2 ${maximized ? 'max-w-[85%]' : 'max-w-[94%]'}`}>
        {!fromUser && <div className="flex-shrink-0 mt-0.5"><LiraAIAvatar size={26} hasSparkles={false} /></div>}
        <div className={`p-3 rounded-2xl leading-relaxed transition-[font-size] ${maximized ? 'text-sm' : 'text-xs'} ${fromUser ? BUBBLE_USER : BUBBLE_VIVA}`}>
          {msg.refinedPrompt && !fromUser && <RefinedGoal goal={msg.refinedPrompt.optimizedGoal} />}
          <ChatMarkdown text={msg.text} />
          <Attachments msg={msg} onResolve={onResolve} onUndo={onUndo} onOpenDashboard={onOpenDashboard} onSelectIssue={onSelectIssue} />
        </div>
        {fromUser && <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5 text-lira-text"><User className="w-3.5 h-3.5" /></div>}
      </div>

      {msg.suggestedActions && msg.suggestedActions.length > 0 && <SuggestedActions actions={msg.suggestedActions} onSend={onSend} />}
    </motion.div>
  );
}
