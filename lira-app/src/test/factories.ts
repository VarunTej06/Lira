import type { Issue } from '../types/issue'
import type { Space } from '../types/space'

let n = 0

export function makeIssue(over: Partial<Issue> = {}): Issue {
  n++
  return {
    id: n,
    spaceId: 1,
    key: `TST-${n}`,
    title: `Ticket ${n}`,
    description: '',
    type: 'task',
    status: 'todo',
    priority: 'medium',
    reporter: 'VY',
    reporterInitials: 'VY',
    labels: [],
    subtasks: [],
    comments: [],
    activity: [],
    attachments: [],
    linkedIssues: [],
    rank: n,
    createdAt: new Date('2026-11-01T09:00:00'),
    updatedAt: new Date('2026-11-01T09:00:00'),
    watchers: [],
    ...over,
  }
}

export function makeSpace(over: Partial<Space> = {}): Space {
  return {
    id: 1,
    name: 'Certifications',
    key: 'CERT',
    icon: 'x',
    color: '#000',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }
}
