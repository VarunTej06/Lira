import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { actionCommands, pageCommands, spaceCommands, ticketCommands, type Command } from '../../utils/commandPalette';
import { isHosted } from '../../utils/edition';
import { CommandPalette } from './CommandPalette';

interface Props { spaces: Space[]; issues: Issue[]; go: (path: string) => void; openIssue: (issue: Issue) => void; createTicket: () => void; createSpace: () => void; onClose: () => void }

/** The palette with what this app has to offer: its pages, the spaces, the tickets that match the search, and two actions. */
export function AppCommandPalette({ spaces, issues, go, openIssue, createTicket, createSpace, onClose }: Props) {
  const commands = (query: string): Command[] => [
    ...pageCommands(go, isHosted()), ...spaceCommands(spaces, go), ...ticketCommands(issues, query, openIssue), ...actionCommands({ createTicket, createSpace }),
  ];
  return <CommandPalette commands={commands} onClose={onClose} />;
}
