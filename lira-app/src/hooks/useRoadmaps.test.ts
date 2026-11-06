import { beforeEach, describe, expect, it } from 'vitest'
import { readRoadmaps, writeRoadmaps } from './useRoadmaps'
import { fileForKey } from '../services/kvMirror'

describe('roadmap storage', () => {
  beforeEach(() => localStorage.clear())

  it('creates the Lira roadmap from ROADMAP.md the first time, and saves it', () => {
    const list = readRoadmaps()
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('Lira Platform Roadmap')
    expect(JSON.parse(localStorage.getItem('lira_roadmaps')!)).toHaveLength(1)
  })

  it('does not bring the seed back after the user deletes every roadmap', () => {
    readRoadmaps()
    writeRoadmaps([])
    expect(readRoadmaps()).toEqual([])
  })

  it('keeps edits', () => {
    const [rm] = readRoadmaps()
    writeRoadmaps([{ ...rm, name: 'Renamed' }])
    expect(readRoadmaps()[0].name).toBe('Renamed')
  })

  it('is saved to data/roadmaps.json', () => {
    expect(fileForKey('lira_roadmaps')).toBe('roadmaps')
  })
})

describe('older saved roadmaps', () => {
  it('get a space and a single epic link', () => {
    localStorage.clear()
    const old = {
      id: 'rm-old', name: 'Old', projectKey: 'LIRA', lanes: ['A'], milestones: [], createdAt: '2026-11-06T00:00:00.000Z',
      items: [
        { id: 'a', title: 'A', lane: 'A', status: 'planned', start: '2026-11-01', end: '2026-11-05', progress: 0, deps: [], children: [], epicKeys: ['LIRA-4', 'LIRA-5'] },
        { id: 'b', title: 'B', lane: 'A', status: 'planned', start: '2026-11-01', end: '2026-11-05', progress: 0, deps: [], children: [], epicKeys: [] },
      ],
    }
    localStorage.setItem('lira_roadmaps', JSON.stringify([old]))
    const [rm] = readRoadmaps()
    expect(rm.spaceKey).toBe('LIRA')
    expect(rm.items[0].epicKey).toBe('LIRA-4')
    expect(rm.items[1].epicKey).toBeUndefined()
    expect('epicKeys' in rm.items[0]).toBe(false)
  })
})
