import { keepPlace } from '../../../utils/keepPlace';
import { CopyButton } from '../../common/CopyButton';
import { descriptionToText, isHtmlDescription } from '../../../utils/richText';
import { RichTextEditor } from '../../common/richtext/RichTextEditor';
import { TypeIcon } from '../../common/Icons';
import { useState } from 'react';
import { Plus, ChevronDown, Link, ListTree } from 'lucide-react';
import type { IssueType, LinkedIssue } from '../../../types/issue';
import { TicketPicker } from '../../common/TicketPicker';
import { LinkedIssues } from '../LinkedIssues';
import { ISSUE_TYPE_CONFIG } from '../../../types/issue';
import { childTypeOf } from '../../../utils/hierarchy';
import { LINK_CHOICES, linkCandidates, type LinkType } from '../../../utils/ticketLinks';
import { IssueSubtasks } from '../IssueSubtasks';
import { IssueAttachments } from '../IssueAttachments';
import { IssueActivityFeed } from '../IssueActivityFeed';
import { ChildIssues } from '../ChildIssues';
import { safeArr } from './issueOptions';
import type { IssueDetailState } from './useIssueDetail';

type ChildProps = Pick<IssueDetailState, 'childCollapsed' | 'setChildCollapsed' | 'childIssues' | 'childCount' | 'doneChildCount' | 'childProgress' | 'onNavigateToIssue'> & { onAdd: () => void };
type Picker = 'child' | 'link' | null;
const ADD = 'flex items-center gap-1.5 text-xs text-lira-muted hover:text-lira-blue mt-2 py-1 transition-colors cursor-pointer';

/** A section heading that folds its content: a chevron, the title and an optional count. */
function SectionToggle({ title, collapsed, onToggle, count }: { title: string; collapsed: boolean; onToggle: (el: HTMLElement) => void; count?: string }) {
  return (
    <button
      onClick={e => onToggle(e.currentTarget)}
      className="flex items-center gap-1.5 w-full text-sm font-semibold text-lira-text mb-2 hover:text-lira-blue transition-colors"
    >
      <ChevronDown className={`w-4 h-4 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
      {title}
      {count && <span className="ml-1 text-xs text-lira-muted font-normal">{count}</span>}
    </button>
  );
}

/** "Child issue" and "Link issue": each opens its picker. A subtask has no level below it, so it has no Child issue button. */
function QuickActions({ type, onPick }: { type: IssueType; onPick: (which: Picker) => void }) {
  const button = 'flex items-center gap-1.5 px-3 py-1.5 text-sm text-lira-muted border border-lira-border rounded-md hover:bg-gray-50 hover:text-lira-blue transition-all cursor-pointer';
  return (
    <div className="flex items-center gap-2">
      {childTypeOf(type) && (
        <button type="button" onClick={() => onPick('child')} className={button} title="Add or create a child issue">
          <Plus className="w-3.5 h-3.5" /> Child issue
        </button>
      )}
      <button type="button" onClick={() => onPick('link')} className={button} title="Link this ticket to others">
        <Link className="w-3.5 h-3.5" /> Link issue
      </button>
    </div>
  );
}

/** Linked parent pill (Subtask -> Task, Story -> Epic, Task -> Story); click opens the parent. */
function ParentPill({ parent, onOpen }: { parent: NonNullable<IssueDetailState['resolvedParent']>; onOpen: () => void }) {
  return (
    <div className="mb-1.5">
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border border-gray-300 hover:border-gray-400 bg-white hover:bg-gray-50 rounded-md text-lira-text font-normal transition-colors group/parent shadow-2xs"
        title={`Parent: ${parent.key} — ${parent.title}. Click to open parent.`}
      >
        <TypeIcon type={parent.type} />
        <span className="font-semibold text-lira-text font-mono text-2xs">{parent.key}</span>
        <span className="text-gray-300">|</span>
        <span className="text-lira-text max-w-sm truncate">{parent.title}</span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 group-hover/parent:text-lira-blue transition-colors ml-0.5" />
      </button>
    </div>
  );
}

/** The title: a heading you click to edit, or a box where Enter or leaving saves and Escape cancels. */
function TitleField({ s }: { s: IssueDetailState }) {
  if (!s.editingTitle) {
    return (
      <h1 className="text-2xl font-bold text-lira-text cursor-text hover:bg-lira-blue-light/50 rounded px-1 -mx-1 py-0.5 transition-colors leading-tight" onClick={() => s.setEditingTitle(true)}>
        {s.local.title}
      </h1>
    );
  }
  return (
    <input
      autoFocus
      value={s.titleVal}
      onChange={e => s.setTitleVal(e.target.value)}
      onBlur={s.handleTitleSave}
      onKeyDown={e => { if (e.key === 'Enter') s.handleTitleSave(); if (e.key === 'Escape') { e.stopPropagation(); s.setEditingTitle(false); s.setTitleVal(s.issue?.title ?? s.local.title); } }}
      className="w-full text-2xl font-bold text-lira-text border-b-2 border-lira-blue outline-none pb-1 bg-transparent leading-tight"
    />
  );
}

function DescriptionSection({ s }: { s: IssueDetailState }) {
  const { local, descVal, descCollapsed } = s;
  return (
    <section>
      <div className="flex items-center mb-2">
        <button
          onClick={e => keepPlace(e.currentTarget, () => s.setDescCollapsed(c => !c))}
          className="flex items-center gap-1.5 flex-1 text-left text-sm font-semibold text-lira-text hover:text-lira-blue transition-colors group"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${descCollapsed ? '-rotate-90' : ''}`} />
          Description
        </button>
        <CopyButton label="Copy description" getText={() => descriptionToText(descVal)} getHtml={() => (descVal && isHtmlDescription(descVal) ? descVal : undefined)} />
      </div>
      {!descCollapsed && (
        <div>
          <RichTextEditor
            value={descVal}
            onChange={s.setDescVal}
            attachments={safeArr(local.attachments)}
            onAttachmentsChange={a => s.patch({ attachments: a })}
            placeholder="Add a description..."
            minHeight={160}
          />
        </div>
      )}
    </section>
  );
}

/** The ticket's own files plus the files attached to its comments. */
function AttachmentsSection({ s }: { s: IssueDetailState }) {
  const own = safeArr(s.local.attachments);
  const fromComments = safeArr(s.local.comments).flatMap(c => safeArr(c.attachments).map(attachment => ({ attachment, author: c.author || 'User', at: c.createdAt })));
  const total = own.length + fromComments.length;
  return (
    <section>
      <SectionToggle title="Attachments" collapsed={s.attCollapsed} count={total > 0 ? `(${total})` : undefined} onToggle={el => keepPlace(el, () => s.setAttCollapsed(c => !c))} />
      {!s.attCollapsed && <IssueAttachments attachments={own} onUpdate={a => s.patch({ attachments: a })} fromComments={fromComments} />}
    </section>
  );
}

/** The tickets one level down (tasks of an epic, subtasks of a task or bug): a progress bar and the list. Always shown, also when empty. */
function ChildSection({ childCollapsed, setChildCollapsed, childIssues, childCount, doneChildCount, childProgress, onNavigateToIssue, onAdd }: ChildProps) {
  return (
    <section data-testid="child-section">
      <SectionToggle title="Child issues" collapsed={childCollapsed} count={childCount > 0 ? `(${doneChildCount}/${childCount} done)` : undefined} onToggle={el => keepPlace(el, () => setChildCollapsed(c => !c))} />
      {!childCollapsed && (
        <>
          {childCount > 0 && (
            <div className="mb-3">
              <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
                <div className="bg-lira-green transition-all" style={{ width: `${childProgress}%` }} />
                <div className="bg-lira-blue transition-all" style={{ width: `${Math.max(0, 100 - childProgress)}%`, opacity: 0.2 }} />
              </div>
              <p className="text-3xs text-lira-muted mt-1">{childProgress}% Done</p>
            </div>
          )}
          <ChildIssues childIssues={childIssues} onIssueClick={issue => onNavigateToIssue?.(issue)} />
          <button type="button" onClick={onAdd} className={ADD}><Plus className="w-3.5 h-3.5" /> Add child issue</button>
        </>
      )}
    </section>
  );
}

/** The tickets this one is linked to, and how. Always shown, also when empty. */
function LinkedSection({ s, onAdd }: { s: IssueDetailState; onAdd: () => void }) {
  const links = safeArr(s.local.linkedIssues);
  return (
    <section data-testid="linked-section">
      <h3 className="text-sm font-semibold text-lira-text mb-2">Linked issues{links.length > 0 && <span className="ml-1 text-xs text-lira-muted font-normal">({links.length})</span>}</h3>
      <LinkedIssues links={links} tickets={s.everyIssue} onOpen={issue => s.onNavigateToIssue?.(issue)} onRemove={(link: LinkedIssue) => s.handleRemoveLink(link)} />
      <button type="button" onClick={onAdd} className={ADD}><Plus className="w-3.5 h-3.5" /> Link issue</button>
    </section>
  );
}

/** The two dialogs behind "Child issue" and "Link issue". */
function Pickers({ s, picker, onClose }: { s: IssueDetailState; picker: Picker; onClose: () => void }) {
  const { local } = s;
  const childType = childTypeOf(local.type);
  const childLabel = childType ? ISSUE_TYPE_CONFIG[childType].label.toLowerCase() : '';
  return (
    <>
      {childType && (
        <TicketPicker
          open={picker === 'child'} onClose={onClose} testId="child" icon={<ListTree className="w-5 h-5" />}
          title={`Child issues of ${local.key}`}
          hint={`Name a new ${childLabel}, or tick existing ${childLabel}s of this space to put them under this ticket.`}
          candidates={s.spaceIssues.filter(i => i.type === childType && i.id !== local.id && i.parentId !== local.id)}
          homeSpaceId={local.spaceId}
          create={{ label: `Create ${childLabel}`, placeholder: `Name of the new ${childLabel}`, onCreate: name => { void s.handleCreateChildIssue(name, childType); onClose(); } }}
          emptyText={`No other ${childLabel}s in this space.`}
          confirmLabel="Add as child issues"
          onPick={picked => { void s.handleAdoptChildren(picked.map(p => p.issue)); onClose(); }}
        />
      )}
      <TicketPicker
        open={picker === 'link'} onClose={onClose} testId="link" typeFilter icon={<Link className="w-5 h-5" />}
        title={`Link ${local.key} to other tickets`}
        hint="Tick one or more tickets of any type or status, and say how each relates to this one. Links are saved with Save changes."
        candidates={linkCandidates(local, s.everyIssue)} homeSpaceId={local.spaceId}
        relations={LINK_CHOICES}
        emptyText="No tickets match."
        confirmLabel="Link tickets"
        onPick={picked => { s.handleAddLinks(picked.map(p => ({ issueId: p.issue.id!, linkType: p.relation as LinkType }))); onClose(); }}
      />
    </>
  );
}

/** Title, description, attachments, child issues, linked issues, subtasks and activity. */
export function IssueMain(s: IssueDetailState) {
  const { local, resolvedParent, onNavigateToIssue } = s;
  const [picker, setPicker] = useState<Picker>(null);
  return (
    <div className="md:flex-1 md:overflow-y-auto min-w-0 px-4 md:px-6 pt-4 pb-10 space-y-5">
      <QuickActions type={local.type} onPick={setPicker} />
      {resolvedParent && <ParentPill parent={resolvedParent} onOpen={() => onNavigateToIssue?.(resolvedParent)} />}
      <TitleField s={s} />
      <DescriptionSection s={s} />
      <AttachmentsSection s={s} />
      {childTypeOf(local.type) && <ChildSection {...s} onAdd={() => setPicker('child')} />}
      <LinkedSection s={s} onAdd={() => setPicker('link')} />
      {local.type === 'task' && <IssueSubtasks subtasks={safeArr(local.subtasks)} onUpdate={subtasks => s.patch({ subtasks })} />}
      <div className="border-t border-lira-border pt-5">
        <IssueActivityFeed comments={safeArr(local.comments)} activity={safeArr(local.activity)} onAddComment={s.handleAddComment} onEditComment={s.handleEditComment} draft={s.commentDraft} onDraftChange={s.setCommentDraft} />
      </div>
      <Pickers s={s} picker={picker} onClose={() => setPicker(null)} />
    </div>
  );
}
