import { beforeEach, describe, expect, it } from 'vitest'
import { ACCENTS, DEFAULT_ACCENT, accentCss, accentVars, applyAccent, isDefaultAccent, loadAccent, parseHex, saveAccent } from './accent'

describe('accent colours', () => {
  beforeEach(() => { localStorage.clear(); document.head.innerHTML = '' })

  it('offers a good range of valid, distinct colours', () => {
    expect(ACCENTS.length).toBeGreaterThanOrEqual(12)
    expect(new Set(ACCENTS.map(a => a.hex)).size).toBe(ACCENTS.length)
    expect(ACCENTS.every(a => parseHex(a.hex) !== undefined)).toBe(true)
    expect(ACCENTS[0].hex).toBe(DEFAULT_ACCENT)
  })

  it('parses hex with or without #, rejects the rest', () => {
    expect(parseHex('#0052CC')).toEqual([0, 82, 204])
    expect(parseHex('ff0000')).toEqual([255, 0, 0])
    expect(parseHex('red')).toBeUndefined()
    expect(parseHex('#12345')).toBeUndefined()
  })

  it('uses the colour itself in light mode, and a brighter shade in dark mode', () => {
    const light = accentVars('#6554C0', false)!
    expect(light.blue).toBe('101 84 192')
    const dark = accentVars('#6554C0', true)!
    const [lr, lg, lb] = light.blue.split(' ').map(Number)
    const [dr, dg, db] = dark.blue.split(' ').map(Number)
    expect(dr + dg + db).toBeGreaterThan(lr + lg + lb)
    expect(accentVars('nope', false)).toBeUndefined()
  })

  it('makes a pale tint in light mode and a deep tint in dark mode', () => {
    const sum = (s: string) => s.split(' ').map(Number).reduce((a, b) => a + b, 0)
    expect(sum(accentVars('#DB2777', false)!.light)).toBeGreaterThan(600)
    expect(sum(accentVars('#DB2777', true)!.light)).toBeLessThan(250)
  })

  it('writes no CSS for the default blue, so nothing changes', () => {
    expect(isDefaultAccent('#0052cc')).toBe(true)
    expect(accentCss('#0052CC')).toBe('')
    expect(accentCss(undefined)).toBe('')
  })

  it('writes overrides for both themes', () => {
    const css = accentCss('#059669')
    expect(css).toContain(':root{--jira-blue:5 150 105;')
    expect(css).toContain('.dark{--jira-blue:')
    expect(css).toContain('--jira-blue-hover')
    expect(css).toContain('--jira-blue-light')
  })

  it('applies, replaces and removes the page style', () => {
    applyAccent('#059669')
    expect(document.getElementById('lira-accent')!.textContent).toContain('5 150 105')
    applyAccent('#DB2777')
    expect(document.querySelectorAll('#lira-accent')).toHaveLength(1)
    expect(document.getElementById('lira-accent')!.textContent).toContain('219 39 119')
    applyAccent(DEFAULT_ACCENT)
    expect(document.getElementById('lira-accent')).toBeNull()
  })

  it('saves the choice (so it reaches data/settings.json) and loads it back', () => {
    expect(loadAccent()).toBe(DEFAULT_ACCENT)
    saveAccent('#8b5cf6')
    expect(localStorage.getItem('lira_accent')).toBe('#8B5CF6')
    expect(loadAccent()).toBe('#8B5CF6')
    expect(document.getElementById('lira-accent')).not.toBeNull()
  })
})
