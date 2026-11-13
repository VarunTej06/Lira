import { SpaceIcon } from '../common/SpaceIcon';
import { issueLink, projectLink, sprintLink } from '../../utils/links';
import React, { useMemo } from 'react';
import { Sparkles, AlertTriangle, Clock, CheckCircle2, ListTodo, ArrowRight, FolderKanban, CalendarClock, Activity } from 'lucide-react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import type { Project } from '../../types/project';
import {
  allSprintKeys, currentSprintKey, daysLeft, isDone, issuesInSprint, sprintName, sprintStats,
} from '../../utils/sprintUtils';
import { formatRelativeDate } from '../../utils/dateUtils';
import { TicketRow } from '../sprints/sprintParts';
import { CountUp, SequenceBar } from '../common/motion';
import { isMine } from '../../utils/currentUser';
import { currentTime, currentTimeMs } from '../../utils/clock';

interface ForYouPageProps {
  spaces: Space[];
  issues: Issue[];
  projects: Project[];
  onIssueClick: (issue: Issue) => void;
  onOpenSpace: (spaceId: number) => void;
  onOpenProject: (project: Project) => void;
  onOpenSprint: (key: string) => void;
  onCreateIssue: () => void;
}

const PRIORITY_RANK: Record<string, number> = { highest: 0, high: 1, medium: 2, low: 3, lowest: 4 };
const DAY = 86_400_000;

const Card: React.FC<{ title: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, action, children }) => (
  <section className="bg-white border border-lira-border rounded-2xl overflow-hidden">
    <header className="flex items-center justify-between px-4 py-3 border-b border-lira-border">
      <h2 className="text-sm font-semibold text-lira-text flex items-center gap-2">{icon}{title}</h2>
      {action}
    </header>
    {children}
  </section>
);


/** Personal landing page: what's on my plate, what's late, and shortcuts into every part of Lira. */
export const ForYouPage: React.FC<ForYouPageProps> = ({
  spaces, issues, projects, onIssueClick, onOpenSpace, onOpenProject, onOpenSprint, onCreateIssue,
}) => {
  const spaceById = useMemo(() => new Map(spaces.map(s => [s.id!, s])), [spaces]);
  const sprintKeys = useMemo(() => allSprintKeys(issues), [issues]);
  const cur = currentSprintKey();

  const mine = useMemo(() => issues.filter(i => isMine(i) && i.type !== 'epic'), [issues]);
  const myOpen = useMemo(
    () => mine.filter(i => !isDone(i)).sort((a, b) =>
      (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2) ||
      (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) - (b.dueDate ? new Date(b.dueDate).getTime() : Infinity)),
    [mine]
  );

  const now = currentTimeMs();
  const overdue = myOpen.filter(i => i.dueDate && new Date(i.dueDate).getTime() < now);
  const dueSoon = myOpen.filter(i => {
    if (!i.dueDate) return false;
    const t = new Date(i.dueDate).getTime();
    return t >= now && t <= now + 7 * DAY;
  });
  const doneThisSprint = mine.filter(i => isDone(i) && issuesInSprint([i], cur).length > 0).length;

  const recent = useMemo(
    () => [...issues].filter(i => i.type !== 'epic')
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
      .slice(0, 6),
    [issues]
  );

  const curStats = sprintStats(issuesInSprint(issues, cur)); // one pass over the tickets: cheaper than keeping a memo in step
  const activity = useMemo(() => {
    const rows: { issue: Issue; text: string; at: Date }[] = [];
    issues.forEach(i => (i.activity || []).forEach(a => {
      if (a.type === 'comment') return;
      rows.push({ issue: i, text: a.description, at: new Date(a.createdAt) });
    }));
    return rows.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 8);
  }, [issues]);

  const hour = currentTime().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const stats = [
    { label: 'Assigned to me', value: myOpen.length, icon: <ListTodo className="w-4 h-4" />, tone: 'text-lira-blue bg-lira-blue-light' },
    { label: 'Overdue', value: overdue.length, icon: <AlertTriangle className="w-4 h-4" />, tone: 'text-red-600 bg-red-50' },
    { label: 'Due in 7 days', value: dueSoon.length, icon: <Clock className="w-4 h-4" />, tone: 'text-amber-600 bg-amber-50' },
    { label: 'Done this sprint', value: doneThisSprint, icon: <CheckCircle2 className="w-4 h-4" />, tone: 'text-emerald-600 bg-emerald-50' },
  ];

  const empty = (text: string) => <p className="px-4 py-8 text-center text-sm text-lira-muted">{text}</p>;

  return (
    <div className="flex-1 overflow-y-auto bg-lira-bg">
      <div className="max-w-6xl mx-auto p-6 space-y-5">
        {/* Greeting */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-lira-text flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" /> {greeting}, Varun
            </h1>
            <p className="text-sm text-lira-muted mt-0.5">
              {currentTime().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · {sprintName(cur)} · {daysLeft(cur)} days left
            </p>
          </div>
          <button onClick={onCreateIssue} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-lira-blue text-lira-on-blue text-sm font-semibold hover:bg-lira-blue-hover transition-colors cursor-pointer">
            + Create ticket
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map(s => (
            <div key={s.label} className="bg-white border border-lira-border rounded-2xl px-4 py-3 flex items-center gap-3">
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.tone}`}>{s.icon}</span>
              <div>
                <div className="text-2xl font-semibold text-lira-text leading-none"><CountUp value={s.value} /></div>
                <div className="text-2xs text-lira-muted mt-1">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <Card title="Assigned to me" icon={<ListTodo className="w-4 h-4 text-lira-blue" />}
              action={<span className="text-xs text-lira-muted"><CountUp value={myOpen.length} suffix=" open" /></span>}>
              {myOpen.length === 0 ? empty('Nothing assigned to you — enjoy the quiet.') :
                myOpen.slice(0, 8).map(i => (
                  <TicketRow key={i.id} issue={i} space={spaceById.get(i.spaceId)} showSpace showSprint sprintOptions={sprintKeys} onClick={onIssueClick} />
                ))}
            </Card>

            {(overdue.length > 0 || dueSoon.length > 0) && (
              <Card title="Overdue & due soon" icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}>
                {[...overdue, ...dueSoon].slice(0, 6).map(i => (
                  <TicketRow key={i.id} issue={i} space={spaceById.get(i.spaceId)} showSpace showSprint sprintOptions={sprintKeys} onClick={onIssueClick} />
                ))}
              </Card>
            )}

            <Card title="Recently worked on" icon={<Clock className="w-4 h-4 text-lira-muted" />}>
              {recent.map(i => (
                <TicketRow key={i.id} issue={i} space={spaceById.get(i.spaceId)} showSpace showSprint sprintOptions={sprintKeys} onClick={onIssueClick} />
              ))}
            </Card>
          </div>

          <div className="space-y-5">
            <Card title={sprintName(cur)} icon={<CalendarClock className="w-4 h-4 text-teal-500" />}
              action={<button onClick={() => onOpenSprint(cur)} {...sprintLink(cur)} className="text-xs text-lira-blue hover:underline cursor-pointer flex items-center gap-1">Open <ArrowRight className="w-3 h-3" /></button>}>
              <div className="p-4 space-y-3">
                <div className="flex justify-between text-xs text-lira-muted">
                  <span><CountUp value={curStats.done} /> of {curStats.total} done</span>
                  <span className="font-semibold text-lira-text"><CountUp value={curStats.percent} suffix="%" /></span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  {/* one smooth movement from left to right: green, and straight on into blue */}
                  <SequenceBar className="h-full" segments={[
                    { percent: curStats.total ? (curStats.done / curStats.total) * 100 : 0, className: 'bg-green-500' },
                    { percent: curStats.total ? (curStats.inprogress / curStats.total) * 100 : 0, className: 'bg-blue-500' },
                  ]} />
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[['To Do', curStats.todo + curStats.backlog], ['In progress', curStats.inprogress], ['Blocked', curStats.blocked], ['Done', curStats.done]].map(([l, v]) => (
                    <div key={l as string} className="rounded-xl bg-gray-50 border border-lira-border py-2">
                      <div className="text-lg font-semibold text-lira-text"><CountUp value={v as number} /></div>
                      <div className="text-3xs text-lira-muted">{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card title="Your spaces">
              <div className="p-2 grid grid-cols-1 gap-1">
                {spaces.map(s => {
                  const open = issues.filter(i => i.spaceId === s.id && i.type !== 'epic' && !isDone(i)).length;
                  return (
                    <button key={s.id} onClick={() => onOpenSpace(s.id!)}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors text-left cursor-pointer">
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ backgroundColor: s.color + '26', color: s.color }}><SpaceIcon icon={s.icon} /></span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-lira-text truncate">{s.name}</span>
                        <span className="block text-2xs text-lira-muted"><CountUp value={open} suffix=" open" /></span>
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-lira-muted" />
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card title="Projects" icon={<FolderKanban className="w-4 h-4 text-violet-500" />}>
              <div className="p-2">
                {projects.length === 0 ? empty('No projects yet') : projects.map(p => (
                  <button key={p.id} onClick={() => onOpenProject(p)} {...projectLink(p.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors text-left cursor-pointer">
                    <span className="w-8 h-8 rounded-lg bg-lira-blue text-lira-on-blue text-3xs font-bold flex items-center justify-center">{p.key.slice(0, 2)}</span>
                    <span className="flex-1 min-w-0 text-sm font-medium text-lira-text truncate">{p.name}</span>
                  </button>
                ))}
              </div>
            </Card>

            <Card title="Recent activity" icon={<Activity className="w-4 h-4 text-lira-muted" />}>
              {activity.length === 0 ? empty('No activity yet') : activity.map((a, idx) => (
                <button key={idx} onClick={() => onIssueClick(a.issue)} {...issueLink(a.issue)}
                  className="w-full text-left px-4 py-2 border-b border-lira-border last:border-0 hover:bg-gray-50 transition-colors cursor-pointer">
                  <div className="text-xs text-lira-text truncate"><span className="font-mono text-lira-muted">{a.issue.key}</span> {a.text}</div>
                  <div className="text-3xs text-lira-muted">{formatRelativeDate(a.at)}</div>
                </button>
              ))}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
