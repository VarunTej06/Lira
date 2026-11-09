export interface ProjectRow { id: string; [field: string]: unknown }
export interface SprintRow {
  id: string
  spaceId: number | 'all'
  sprint: string // YYYY-MM (a month) or YYYY-MM-DD (a weekly / bi-weekly / N-day sprint starting that day)
  goal?: string
  completedAt?: string
  start?: string
  end?: string
  kind?: string
  planned: boolean
}
export interface TeamRow {
  id: string
  kind: 'scope' | 'member'
  owner?: string // scope teams: "space:6", "project:proj-x", "global"
  memberKeys?: string[]
  name?: string
  email?: string
}
export interface StandupRow { id: string; scopeId: string; [field: string]: unknown }
